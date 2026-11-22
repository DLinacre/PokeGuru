import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { OpeningSession, PackResult, PulledCard, RarityTier } from "../src/types/packs";

const KEY = "pokeguru_pack_sim_v1";

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
    openedAt: 1_700_000_000_000,
    seed: "seed-1",
    cards,
    bestTier: "common",
  };
}

function session(overrides: Partial<OpeningSession> = {}): OpeningSession {
  return {
    id: "session-1",
    setId: "sv06.5",
    setName: "Shrouded Fable",
    seriesId: "sv",
    startedAt: 1_700_000_000_000,
    completedAt: 1_700_000_100_000,
    packs: [
      {
        packId: "p1",
        openedAt: 1_700_000_000_000,
        seed: "seed-1",
        bestTier: "common",
        pulls: [
          {
            key: "a|normal",
            cardId: "a",
            name: "Card a",
            localId: "1",
            setId: "sv06.5",
            setName: "Shrouded Fable",
            finish: "normal",
            tier: "common",
            status: "priced",
            eur: 10,
            gbp: 8.36,
            basis: "trend",
            variant: "normal",
            printing: "Standard printing",
            source: "cardmarket",
            priceUpdatedAt: "2026-11-13T00:00:00Z",
            fxDate: "2026-11-14",
            fxRate: 0.83558,
            retrievedAt: 1_700_000_050_000,
            flags: [],
          },
        ],
        totals: {
          cards: 2,
          priced: 1,
          unavailable: 1,
          pending: 0,
          totalGbp: 8.36,
          totalEur: 10,
          averageGbp: 8.36,
          highest: { cardId: "a", name: "Card a", gbp: 8.36 },
          lowest: { cardId: "a", name: "Card a", gbp: 8.36 },
        },
      },
    ],
    totals: {
      cards: 2,
      priced: 1,
      unavailable: 1,
      pending: 0,
      totalGbp: 8.36,
      totalEur: 10,
      averageGbp: 8.36,
      highest: { cardId: "a", name: "Card a", gbp: 8.36 },
      lowest: { cardId: "a", name: "Card a", gbp: 8.36 },
    },
    valuesRecorded: true,
    ...overrides,
  };
}

async function loadStore() {
  vi.resetModules();
  return import("../src/services/simStore");
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("opening history storage", () => {
  it("starts with an empty history rather than invented examples", async () => {
    const store = await loadStore();
    expect(store.getSimSnapshot().openings).toEqual([]);
    expect(store.getSimSnapshot().version).toBe(2);
  });

  it("records a session once and ignores a repeated write", async () => {
    const store = await loadStore();
    store.recordOpening(session());
    store.recordOpening(session());
    const openings = store.getSimSnapshot().openings;
    expect(openings).toHaveLength(1);
    expect(openings[0].totals.totalGbp).toBe(8.36);
  });

  it("keeps frozen values across a reload", async () => {
    const first = await loadStore();
    first.recordOpening(session());

    const second = await loadStore();
    const [stored] = second.getSimSnapshot().openings;
    expect(stored.id).toBe("session-1");
    expect(stored.packs[0].pulls[0].gbp).toBe(8.36);
    expect(stored.packs[0].pulls[0].eur).toBe(10);
    expect(stored.packs[0].pulls[0].fxRate).toBe(0.83558);
    expect(stored.packs[0].pulls[0].priceUpdatedAt).toBe("2026-11-13T00:00:00Z");
    expect(stored.totals.priced).toBe(1);
    expect(stored.valuesRecorded).toBe(true);
  });

  it("migrates a v1 payload without losing the pull history", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        cards: {},
        packsOpened: 3,
        history: [pack("p1", [pull("a"), pull("b")])],
        settings: { sound: false, reduceMotion: true, wrapperStyle: "prism" },
      })
    );

    const store = await loadStore();
    const state = store.getSimSnapshot();
    expect(state.version).toBe(2);
    expect(state.packsOpened).toBe(3);
    expect(state.history).toHaveLength(1);
    expect(state.openings).toHaveLength(1);
    expect(state.openings[0].legacy).toBe(true);
    expect(state.openings[0].valuesRecorded).toBe(false);
    // Values are absent, not zero.
    expect(state.openings[0].totals.priced).toBe(0);
    expect(state.openings[0].packs[0].pulls).toEqual([]);
    expect(state.settings.sound).toBe(false);
  });

  it("survives a corrupt payload", async () => {
    localStorage.setItem(KEY, "{not json");
    const store = await loadStore();
    expect(store.getSimSnapshot().openings).toEqual([]);
    expect(store.getSimSnapshot().packsOpened).toBe(0);
  });

  it("drops unusable stored values instead of showing them", async () => {
    const broken = session();
    // A stored value with no GBP amount cannot be a priced entry.
    (broken.packs[0].pulls[0] as unknown as Record<string, unknown>).gbp = null;
    localStorage.setItem(KEY, JSON.stringify({ version: 2, openings: [broken], history: [] }));

    const store = await loadStore();
    const stored = store.getSimSnapshot().openings[0];
    expect(stored.packs[0].pulls[0].status).toBe("unavailable");
    expect(stored.packs[0].pulls[0].gbp).toBeNull();
  });

  it("caps how many openings are kept", async () => {
    const store = await loadStore();
    for (let index = 0; index < 20; index += 1) {
      store.recordOpening(session({ id: `s${index}`, completedAt: 1_700_000_000_000 + index }));
    }
    expect(store.getSimSnapshot().openings).toHaveLength(store.OPENING_LIMIT);
    expect(store.getSimSnapshot().openings[0].id).toBe("s19");
  });

  it("can clear the history without touching the simulated collection", async () => {
    const store = await loadStore();
    store.recordPacks([pack("p9", [pull("z")])]);
    store.recordOpening(session());
    store.clearOpenings();
    expect(store.getSimSnapshot().openings).toEqual([]);
    expect(store.getSimSnapshot().packsOpened).toBe(1);
    expect(Object.keys(store.getSimSnapshot().cards)).toHaveLength(1);
  });
});

describe("opening history page", () => {
  it("shows an empty state when nothing has been opened", async () => {
    const PackHistoryPage = (await import("../src/pages/PackHistoryPage")).default;
    render(
      <MemoryRouter>
        <PackHistoryPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/no openings recorded yet/i)).toBeTruthy();
    expect(screen.queryByText(/£/)).toBeNull();
  });

  it("lists a saved session with its recorded value and coverage", async () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, openings: [session()], history: [] }));
    const PackHistoryPage = (await import("../src/pages/PackHistoryPage")).default;
    render(
      <MemoryRouter>
        <PackHistoryPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Shrouded Fable/)).toBeTruthy();
    expect(screen.getByText("£8.36")).toBeTruthy();
    expect(screen.getByText(/1 of 2 priced · 1 unavailable/)).toBeTruthy();
  });

  it("labels a migrated entry as having no recorded values", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        history: [pack("p1", [pull("a")])],
        packsOpened: 1,
      })
    );
    const PackHistoryPage = (await import("../src/pages/PackHistoryPage")).default;
    render(
      <MemoryRouter>
        <PackHistoryPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/saved before price tracking/)).toBeTruthy();
    expect(screen.queryByText(/£0\.00/)).toBeNull();
  });
});
