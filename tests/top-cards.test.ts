import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INDEX_KEY,
  clearIndex,
  discoverCandidates,
  coverage,
  emptyIndex,
  entryFromCard,
  indexUpdatedAt,
  rankEntries,
  readIndex,
  writeIndex,
  type TopCardEntry,
  type TopIndex,
} from "../src/services/topCards";
import type { TcgCard } from "../src/types/pokemon";

function card(overrides: Partial<TcgCard> = {}): TcgCard {
  return {
    id: "sv03.5-199",
    name: "Charizard ex",
    localId: "199",
    category: "Pokemon",
    rarity: "Special illustration rare",
    imageBase: "https://assets.tcgdex.net/en/sv/sv03.5/199",
    images: { small: "https://assets.tcgdex.net/en/sv/sv03.5/199/low.webp" },
    set: { id: "sv03.5", name: "151", releaseDate: "2023-09-22" },
    variants: { holo: true, normal: false },
    isDetailed: true,
    pricing: {
      cardmarket: {
        updatedAt: "2026-11-13T22:16:19Z",
        holo: { trend: 240.5, avg: 260, low: 200 },
      },
    },
    ...overrides,
  } as TcgCard;
}

function entry(overrides: Partial<TopCardEntry> = {}): TopCardEntry {
  return {
    id: "sv03.5-199",
    name: "Charizard ex",
    localId: "199",
    setId: "sv03.5",
    setName: "151",
    rarity: "Special illustration rare",
    release: "2023-09-22",
    eur: 240.5,
    gbp: 205,
    rate: 0.85,
    variant: "Holofoil",
    printing: "Holofoil printing",
    updatedAt: "2026-11-13T22:16:19Z",
    confidence: "verified",
    pricedAt: 1000,
    ...overrides,
  };
}

function index(entries: TopCardEntry[], overrides: Partial<TopIndex> = {}): TopIndex {
  return {
    ...emptyIndex(),
    candidates: entries.map((value) => value.id),
    done: entries.map((value) => value.id),
    entries: Object.fromEntries(entries.map((value) => [value.id, value])),
    scannedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("entryFromCard", () => {
  it("keeps the real Cardmarket trend for the card's own printing", () => {
    const result = entryFromCard(card());
    expect(result).not.toBeNull();
    expect(result?.eur).toBe(240.5);
    expect(result?.variant).toBe("Holofoil");
    expect(result?.updatedAt).toBe("2026-11-13T22:16:19Z");
    expect(result?.imageBase).toContain("assets.tcgdex.net");
    expect(result?.release).toBe("2023-09-22");
  });

  it("refuses a card with no Cardmarket price rather than inventing one", () => {
    expect(entryFromCard(card({ pricing: undefined }))).toBeNull();
  });

  it("refuses a zero or negative trend", () => {
    expect(
      entryFromCard(
        card({
          pricing: { cardmarket: { updatedAt: "2026-11-13T22:16:19Z", holo: { trend: 0, avg: 0, low: 0 } } },
        })
      )
    ).toBeNull();
  });
});

describe("ranking", () => {
  it("ranks by EUR value, highest first, and caps at the limit", () => {
    const ranked = rankEntries(
      index([entry({ id: "a", eur: 10 }), entry({ id: "b", eur: 90 }), entry({ id: "c", eur: 50 })]),
      { rate: 0.85 },
      2
    );
    expect(ranked.entries.map((value) => value.id)).toEqual(["b", "c"]);
    expect(ranked.priced).toBe(3);
  });

  it("recomputes GBP with the live rate and keeps EUR as the source figure", () => {
    const ranked = rankEntries(index([entry({ id: "a", eur: 100, gbp: 1 })]), { rate: 0.5 }, 10);
    expect(ranked.entries[0].gbp).toBe(50);
    expect(ranked.entries[0].eur).toBe(100);
  });

  it("falls back to the stored GBP when no rate is available", () => {
    const ranked = rankEntries(index([entry({ id: "a", eur: 100, gbp: 84 })]), null, 10);
    expect(ranked.entries[0].gbp).toBe(84);
  });

  it("does not pad the list when fewer than 100 cards are priced", () => {
    const ranked = rankEntries(index([entry({ id: "a" })]), { rate: 0.85 }, 100);
    expect(ranked.entries).toHaveLength(1);
  });
});

describe("index persistence", () => {
  it("round-trips entries through localStorage", () => {
    writeIndex(index([entry()]));
    const restored = readIndex();
    expect(restored.entries["sv03.5-199"].eur).toBe(240.5);
    expect(restored.candidates).toEqual(["sv03.5-199"]);
  });

  it("drops invalid prices when reading", () => {
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify({ ...emptyIndex(), candidates: ["x"], entries: { x: { eur: 0, name: "Nope" } } })
    );
    expect(readIndex().entries).toEqual({});
  });

  it("ignores a stored index from another version", () => {
    localStorage.setItem(INDEX_KEY, JSON.stringify({ ...emptyIndex(), version: 1, candidates: ["x"] }));
    expect(readIndex().candidates).toEqual([]);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem(INDEX_KEY, "{not json");
    expect(readIndex().entries).toEqual({});
  });

  it("clears the index on request", () => {
    writeIndex(index([entry()]));
    clearIndex();
    expect(readIndex().entries).toEqual({});
  });
});

describe("coverage and freshness", () => {
  it("reports scanned, priced and percentage of the candidate pool", () => {
    const stats = coverage({ ...index([entry()]), candidates: ["a", "b", "c", "d"], done: ["a", "b"] });
    expect(stats).toMatchObject({ scanned: 2, total: 4, priced: 1 });
    expect(stats.percent).toBe(50);
  });

  it("uses the latest marketplace timestamp for the update line", () => {
    const value = indexUpdatedAt(index([entry({ updatedAt: "2026-11-13T22:16:19Z" })]));
    expect(new Date(value ?? 0).getUTCFullYear()).toBe(2026);
  });
});

describe("candidate discovery", () => {
  it("collects briefs per rarity, in order, without duplicates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/series")) {
          return new Response(JSON.stringify([{ id: "sv", name: "Scarlet & Violet" }]), { status: 200 });
        }
        if (url.pathname.includes("/series/")) {
          return new Response(JSON.stringify({ id: "sv", name: "Scarlet & Violet", sets: [] }), { status: 200 });
        }
        if (url.pathname.endsWith("/sets")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.pathname.includes("/cards")) {
          const rarity = url.searchParams.get("rarity") ?? "";
          const page = Number(url.searchParams.get("pagination:page") ?? "1");
          const briefs =
            page === 1
              ? [
                  { id: `a-${rarity.length}-1`, localId: "1", name: "One", image: "https://assets.tcgdex.net/en/sv/sv01/1" },
                  { id: `a-${rarity.length}-2`, localId: "2", name: "Two" },
                ]
              : [];
          return new Response(JSON.stringify(briefs), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      })
    );

    const progress: number[] = [];
    const result = await discoverCandidates(undefined, (done) => progress.push(done));

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(new Set(result.candidates).size).toBe(result.candidates.length);
    // Every candidate carries the rarity label it came from.
    for (const id of result.candidates) expect(typeof result.rarities[id]).toBe("string");
    // Progress reaches the total number of planned requests.
    expect(Math.max(...progress)).toBeGreaterThan(0);
  });
});
