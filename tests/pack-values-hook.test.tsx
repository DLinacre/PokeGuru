import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PackResult, PulledCard, RarityTier } from "../src/types/packs";
import type { TcgCard } from "../src/types/pokemon";
import type { ExchangeRate } from "../src/services/currency";

const loadCardDetails = vi.fn();

vi.mock("../src/services/tcgdex", async () => {
  const actual = await vi.importActual<object>("../src/services/tcgdex");
  return { ...actual, loadCardDetails: (...args: unknown[]) => loadCardDetails(...args) };
});

const { usePackValues } = await import("../src/hooks/usePackValues");

const RATE: ExchangeRate = {
  rate: 0.8,
  date: "2026-11-14",
  base: "EUR",
  quote: "GBP",
  fetchedAt: 0,
  source: "network",
};

function pull(id: string, treatment: PulledCard["treatment"] = "normal"): PulledCard {
  return {
    id,
    name: `Card ${id}`,
    localId: id.split("-").pop() ?? "1",
    setId: "sv06.5",
    setName: "Shrouded Fable",
    rarity: "Common",
    tier: "common" as RarityTier,
    treatment,
    slot: "common",
  };
}

function pack(id: string, cards: PulledCard[]): PackResult {
  return {
    id,
    setId: "sv06.5",
    setName: "Shrouded Fable",
    seriesId: "sv",
    configId: "sv",
    openedAt: 1,
    seed: "s",
    cards,
    bestTier: "common",
  };
}

function pricedCard(id: string, eur: number): TcgCard {
  return {
    id,
    name: `Card ${id}`,
    localId: "1",
    category: "Pokemon",
    images: {},
    set: { id: "sv06.5", name: "Shrouded Fable" },
    variants: { normal: true },
    isDetailed: true,
    pricing: { cardmarket: { currency: "EUR", updatedAt: "2026-11-13T00:00:00Z", normal: { trend: eur } } },
  } as TcgCard;
}

type Handlers = {
  onCard?: (card: TcgCard) => void;
  onError?: (id: string, error: unknown) => void;
  concurrency?: number;
  signal?: AbortSignal;
};

beforeEach(() => {
  loadCardDetails.mockReset();
});

describe("usePackValues", () => {
  it("streams prices in progressively without blocking the reveal", async () => {
    const results = [pack("p1", [pull("a"), pull("b")])];
    let handlers: Handlers = {};
    loadCardDetails.mockImplementation(async (ids: string[], options: Handlers) => {
      handlers = options;
      // Deliberately resolve nothing yet: the pack is already on screen.
      return new Map();
    });

    const { result } = renderHook(() =>
      usePackValues({ results, rate: RATE, enabled: true })
    );

    await waitFor(() => expect(loadCardDetails).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.valueFor(pull("a"))).toBeNull();
    expect(result.current.totalsFor(results[0].cards).pending).toBe(2);

    handlers.onCard?.(pricedCard("a", 10));
    await waitFor(() => expect(result.current.valueFor(pull("a"))?.gbp).toBe(8));

    // The second card is still awaiting, and the total covers only the first.
    expect(result.current.valueFor(pull("b"))).toBeNull();
    const totals = result.current.totalsFor(results[0].cards);
    expect(totals.priced).toBe(1);
    expect(totals.pending).toBe(1);
    expect(totals.totalGbp).toBe(8);

    handlers.onCard?.(pricedCard("b", 5));
    await waitFor(() => expect(result.current.totalsFor(results[0].cards).priced).toBe(2));
    expect(result.current.totalsFor(results[0].cards).totalGbp).toBe(12);
    expect(result.current.loading).toBe(false);
  });

  it("asks for each unique card id once, even across packs", async () => {
    const results = [
      pack("p1", [pull("a"), pull("b")]),
      pack("p2", [pull("a"), pull("c")]),
    ];
    loadCardDetails.mockResolvedValue(new Map());

    const { result } = renderHook(() =>
      usePackValues({ results, rate: RATE, all: true, enabled: true })
    );

    await waitFor(() => expect(loadCardDetails).toHaveBeenCalled());
    const ids = loadCardDetails.mock.calls.flatMap((call) => call[0] as string[]);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(["a", "b", "c"]);
    expect(result.current.loading).toBe(true);
  });

  it("only requests the pack the visitor has reached", async () => {
    const results = [pack("p1", [pull("a")]), pack("p2", [pull("b")]), pack("p3", [pull("c")])];
    loadCardDetails.mockResolvedValue(new Map());

    const { rerender } = renderHook(
      ({ index }: { index: number }) =>
        usePackValues({ results, rate: RATE, activeIndex: index, enabled: true }),
      { initialProps: { index: 0 } }
    );

    await waitFor(() => expect(loadCardDetails).toHaveBeenCalled());
    expect(loadCardDetails.mock.calls[0][0]).toEqual(["a"]);

    rerender({ index: 1 });
    await waitFor(() => expect(loadCardDetails).toHaveBeenCalledTimes(2));
    expect(loadCardDetails.mock.calls[1][0]).toEqual(["b"]);
  });

  it("turns a failed lookup into an unavailable price that can be retried", async () => {
    const results = [pack("p1", [pull("a")])];
    let handlers: Handlers = {};
    loadCardDetails.mockImplementation(async (_ids: string[], options: Handlers) => {
      handlers = options;
      return new Map();
    });

    const { result } = renderHook(() =>
      usePackValues({ results, rate: RATE, enabled: true })
    );

    await waitFor(() => expect(loadCardDetails).toHaveBeenCalled());
    handlers.onError?.("a", new Error("Network down"));

    await waitFor(() => expect(result.current.valueFor(pull("a"))?.status).toBe("unavailable"));
    expect(result.current.valueFor(pull("a"))?.reason).toMatch(/lookup failed/i);
    expect(result.current.failures).toBe(1);
    expect(result.current.totalsFor(results[0].cards).priced).toBe(0);

    loadCardDetails.mockImplementation(async (_ids: string[], options: Handlers) => {
      options.onCard?.(pricedCard("a", 10));
      return new Map();
    });
    result.current.retry();
    await waitFor(() => expect(result.current.valueFor(pull("a"))?.status).toBe("priced"));
    expect(result.current.valueFor(pull("a"))?.gbp).toBe(8);
  });

  it("ignores a slow response from a previous session", async () => {
    const first = [pack("p1", [pull("a")])];
    const second = [pack("p2", [pull("z")])];
    const handlers: Handlers[] = [];
    loadCardDetails.mockImplementation(async (_ids: string[], options: Handlers) => {
      handlers.push(options);
      return new Map();
    });

    const { result, rerender } = renderHook(
      ({ results }: { results: PackResult[] }) =>
        usePackValues({ results, rate: RATE, enabled: true }),
      { initialProps: { results: first } }
    );

    await waitFor(() => expect(loadCardDetails).toHaveBeenCalledTimes(1));
    rerender({ results: second });
    await waitFor(() => expect(loadCardDetails).toHaveBeenCalledTimes(2));

    // The first session's request finishes late.
    handlers[0].onCard?.(pricedCard("a", 99));
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(result.current.valueFor(pull("a"))).toBeNull();
    expect(result.current.valueFor(pull("z"))).toBeNull();
    expect(result.current.totalsFor(second[0].cards).priced).toBe(0);
  });

  it("revalues existing quotes when the FX rate arrives", async () => {
    const results = [pack("p1", [pull("a")])];
    loadCardDetails.mockImplementation(async (_ids: string[], options: Handlers) => {
      options.onCard?.(pricedCard("a", 10));
      return new Map();
    });

    const { result, rerender } = renderHook(
      ({ rate }: { rate: ExchangeRate | null }) =>
        usePackValues({ results, rate, enabled: true }),
      { initialProps: { rate: null as ExchangeRate | null } }
    );

    await waitFor(() => expect(result.current.valueFor(pull("a"))?.status).toBe("unavailable"));
    expect(result.current.valueFor(pull("a"))?.eur).toBe(10);

    rerender({ rate: RATE });
    await waitFor(() => expect(result.current.valueFor(pull("a"))?.gbp).toBe(8));
    expect(result.current.valueFor(pull("a"))?.status).toBe("priced");
  });
});
