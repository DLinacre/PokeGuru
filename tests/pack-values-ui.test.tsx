import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { TcgCard } from "../src/types/pokemon";
import type {
  PackConfig,
  PackPool,
  PackResult,
  PoolCard,
  RarityTier,
} from "../src/types/packs";

const loadCardDetails = vi.fn();

vi.mock("../src/services/tcgdex", async () => {
  const actual = await vi.importActual<object>("../src/services/tcgdex");
  return { ...actual, loadCardDetails: (...args: unknown[]) => loadCardDetails(...args) };
});

vi.mock("../src/services/currency", async () => {
  const actual = await vi.importActual<object>("../src/services/currency");
  return {
    ...actual,
    getEurToGbpRate: async () => ({
      rate: 0.8,
      date: "2026-11-14",
      base: "EUR",
      quote: "GBP",
      fetchedAt: Date.now(),
      source: "cache",
    }),
  };
});

const { default: PackOpening } = await import("../src/components/Packs/PackOpening");
const { configById } = await import("../src/data/packRules");
const { SIM_STORAGE_KEY, clearOpenings } = await import("../src/services/simStore");

function makePool(): PackPool {
  const sizes: Partial<Record<RarityTier, number>> = {
    common: 12,
    uncommon: 8,
    rare: 6,
    holoRare: 4,
    doubleRare: 3,
    ultraRare: 2,
    illustrationRare: 2,
    specialIllustrationRare: 1,
    hyperRare: 1,
    aceSpec: 1,
  };
  const tiers: PackPool["tiers"] = {};
  for (const [tier, count] of Object.entries(sizes) as [RarityTier, number][]) {
    tiers[tier] = Array.from({ length: count }, (_, index): PoolCard => ({
      id: `test1-${tier}-${index + 1}`,
      name: `${tier} ${index + 1}`,
      localId: String(index + 1),
      setId: "test1",
      setName: "Test Set",
      rarity: tier,
      tier,
      imageBase: `https://assets.tcgdex.net/en/sv/sv01/${index + 1}`,
    }));
  }
  return {
    setId: "test1",
    setName: "Test Set",
    seriesId: "sv",
    configId: "sv",
    tiers,
    unmapped: 0,
    examined: 40,
    sourceSets: ["test1"],
    builtAt: 0,
  };
}

const SV = configById("sv") as PackConfig;

/** Every card is worth €10 of Cardmarket trend, so £8 at the mocked rate. */
function priced(id: string): TcgCard {
  return {
    id,
    name: `Card ${id}`,
    localId: id.split("-").pop() ?? "1",
    category: "Pokemon",
    images: {},
    set: { id: "test1", name: "Test Set" },
    variants: { normal: true, reverse: true },
    isDetailed: true,
    pricing: {
      cardmarket: {
        currency: "EUR",
        updatedAt: "2026-11-13T00:00:00Z",
        normal: { trend: 10 },
      },
    },
  } as TcgCard;
}

function renderOpening(props: Partial<React.ComponentProps<typeof PackOpening>> = {}) {
  const onComplete = vi.fn<(results: PackResult[]) => void>();
  render(
    <MemoryRouter>
      <PackOpening
        pool={makePool()}
        config={SV}
        meta={{ setId: "test1", setName: "Test Set", seriesId: "sv", seriesName: "Scarlet & Violet" }}
        quantity={1}
        wrapperStyle="crimson"
        sound={false}
        reduceMotion
        onToggleSound={() => {}}
        onToggleMotion={() => {}}
        onComplete={onComplete}
        onExit={() => {}}
        onOpenAgain={() => {}}
        {...props}
      />
    </MemoryRouter>
  );
  return { onComplete };
}

function storedOpenings() {
  const raw = localStorage.getItem(SIM_STORAGE_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { openings?: unknown[] }).openings ?? [];
}

beforeEach(() => {
  // The store is a module singleton, so reset both the storage and its memory.
  localStorage.clear();
  clearOpenings();
  loadCardDetails.mockReset();
  loadCardDetails.mockImplementation(async (ids: string[], options: { onCard?: (card: TcgCard) => void }) => {
    for (const id of ids) options.onCard?.(priced(id));
    return new Map();
  });
});

describe("pack values in the opening UI", () => {
  it("shows a running total that counts only the cards already turned over", async () => {
    const { onComplete } = renderOpening();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    const cards = results[0].cards;
    const reverseCount = cards.filter((card) => card.treatment === "reverse").length;
    const pricedCount = cards.length - reverseCount;

    expect(screen.getByText(/Current pack value/i)).toBeTruthy();

    await waitFor(() =>
      expect(screen.getByText(`£${(pricedCount * 8).toFixed(2)}`)).toBeTruthy()
    );
    expect(
      screen.getByText(
        new RegExp(`Known value of ${pricedCount} of ${cards.length} cards`)
      )
    ).toBeTruthy();

    // Reverse holofoils have no Cardmarket band: they are counted, not priced.
    if (reverseCount > 0) {
      expect(screen.getAllByText("No price").length).toBeGreaterThanOrEqual(reverseCount);
      const unavailable = screen
        .getAllByText("Unavailable")
        .map((node) => node.nextElementSibling?.textContent);
      expect(unavailable).toContain(String(reverseCount));
    }
  });

  it("updates the total as each price arrives", async () => {
    const pending: Array<() => void> = [];
    loadCardDetails.mockImplementation(
      async (_ids: string[], _options: { onCard?: (card: TcgCard) => void }) => {
        // Hold every response until the test releases it.
        pending.push(() => {
          for (const id of _ids) _options.onCard?.(priced(id));
        });
        return new Map();
      }
    );

    const { onComplete } = renderOpening();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    // Prices are still in flight: the pack opens normally and says so.
    expect(screen.getAllByText(/Prices are still loading|Resolving/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("listitem")).toHaveLength(SV.cardsPerPack);

    pending.forEach((resolve) => resolve());
    await waitFor(() =>
      expect(screen.getByText(/Known value of [1-9]\d* of \d+ cards/)).toBeTruthy()
    );
  });

  it("keeps the pack openable when every price lookup fails", async () => {
    loadCardDetails.mockImplementation(
      async (ids: string[], options: { onError?: (id: string, error: unknown) => void }) => {
        for (const id of ids) options.onError?.(id, new Error("Network down"));
        return new Map();
      }
    );

    const { onComplete } = renderOpening();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));

    await waitFor(() =>
      expect(screen.getByText(/No Cardmarket price for any card in this pack/)).toBeTruthy()
    );
    // Every card is still revealed: pricing never blocks the toy.
    expect(screen.getAllByRole("listitem")).toHaveLength(SV.cardsPerPack);
    expect(screen.getByText(/lookup/)).toBeTruthy();
  });

  it("totals a multi-pack session and keeps every pack's own value", async () => {
    const { onComplete } = renderOpening({ quantity: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Open 3 packs" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const results = onComplete.mock.calls[0][0];
    const pricedPerPack = results.map(
      (pack) => pack.cards.filter((card) => card.treatment !== "reverse").length
    );
    const expectedTotal = pricedPerPack.reduce((sum, count) => sum + count * 8, 0);

    // Walk the session pack by pack, exactly as a user would.
    for (let index = 1; index < results.length; index += 1) {
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`Open pack ${index + 1} of 3`) })
      );
    }
    fireEvent.click(await screen.findByRole("button", { name: /See summary/ }));

    await waitFor(() =>
      expect(document.body.textContent ?? "").toMatch(
        new RegExp(`Known value of\\s*${pricedPerPack.reduce((a, b) => a + b, 0)}\\s*of\\s*30 cards`)
      )
    );
    expect(screen.getByText(/Average known value per pack/)).toBeTruthy();
    expect(screen.getByText(/Best pack/)).toBeTruthy();

    await waitFor(() => expect(storedOpenings()).toHaveLength(1));
    const [session] = storedOpenings() as Array<{
      packs: Array<{ totals: { totalGbp: number; priced: number } }>;
      totals: { totalGbp: number; cards: number; priced: number };
    }>;
    expect(session.packs).toHaveLength(3);
    expect(session.totals.cards).toBe(30);
    expect(session.totals.totalGbp).toBe(expectedTotal);
    expect(session.packs.map((pack) => pack.totals.totalGbp)).toEqual(
      pricedPerPack.map((count) => count * 8)
    );
  });

  it("writes one frozen opening record when the pack completes", async () => {
    const { onComplete } = renderOpening();
    fireEvent.click(screen.getByRole("button", { name: "Open pack" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const cards = onComplete.mock.calls[0][0][0].cards;
    const reverseCount = cards.filter((card) => card.treatment === "reverse").length;

    fireEvent.click(await screen.findByRole("button", { name: /See summary/ }));

    expect(
      await screen.findByRole("heading", { name: /Market value/ })
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.body.textContent ?? "").toMatch(/Known value of\s*\d+\s*of\s*\d+ cards/)
    );
    expect(document.body.textContent ?? "").toMatch(
      /not the full value of the opening|no Cardmarket price for the finish/i
    );

    await waitFor(() => expect(storedOpenings()).toHaveLength(1));
    const [session] = storedOpenings() as Array<{
      valuesRecorded: boolean;
      packs: Array<{ pulls: Array<{ status: string; gbp: number | null; fxRate?: number }>; totals: { priced: number; unavailable: number; totalGbp: number } }>;
    }>;
    const pack = session.packs[0];
    expect(session.valuesRecorded).toBe(true);
    expect(pack.totals.priced).toBe(cards.length - reverseCount);
    expect(pack.totals.unavailable).toBe(reverseCount);
    expect(pack.totals.totalGbp).toBe((cards.length - reverseCount) * 8);
    expect(pack.pulls[0].gbp).toBe(8);
    expect(pack.pulls[0].fxRate).toBe(0.8);
  });
});
