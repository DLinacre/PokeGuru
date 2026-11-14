import { beforeEach, describe, expect, it, vi } from "vitest";
import { PACK_CONFIGS, configById } from "../src/data/packRules";

const SET = {
  id: "sv06.5",
  name: "Shrouded Fable",
  logo: "https://assets.tcgdex.net/en/sv/sv06.5/logo",
  symbol: null,
  cardCount: { total: 99, official: 64 },
  releaseDate: "2024-08-02",
  serie: { id: "sv", name: "Scarlet & Violet" },
  cards: [
    { id: "sv06.5-001", localId: "001", name: "Joltik", image: "https://assets.tcgdex.net/en/sv/sv06.5/001" },
    { id: "sv06.5-050", localId: "050", name: "Eevee", image: "https://assets.tcgdex.net/en/sv/sv06.5/050" },
    { id: "sv06.5-090", localId: "090", name: "Okidogi ex", image: "https://assets.tcgdex.net/en/sv/sv06.5/090" },
  ],
};

const BY_RARITY: Record<string, unknown[]> = {
  Common: [{ id: "sv06.5-001", localId: "001", name: "Joltik", image: "https://assets.tcgdex.net/en/sv/sv06.5/001" }],
  Uncommon: [{ id: "sv06.5-050", localId: "050", name: "Eevee", image: "https://assets.tcgdex.net/en/sv/sv06.5/050" }],
  Rare: [{ id: "sv06.5-060", localId: "060", name: "Rare Thing", image: "https://assets.tcgdex.net/en/sv/sv06.5/060" }],
  "Double rare": [{ id: "sv06.5-090", localId: "090", name: "Okidogi ex", image: "https://assets.tcgdex.net/en/sv/sv06.5/090" }],
  "Special illustration rare": [
    { id: "sv06.5-095", localId: "095", name: "Pecharunt ex", image: "https://assets.tcgdex.net/en/sv/sv06.5/095" },
  ],
};

function installFetch(handler?: (url: URL) => unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (handler) {
      const custom = handler(url);
      if (custom) return new Response(JSON.stringify(custom), { status: 200 });
    }
    if (url.pathname.endsWith("/sets")) return new Response(JSON.stringify([{ id: SET.id, name: SET.name }]), { status: 200 });
    if (url.pathname.endsWith(`/sets/${SET.id}`)) return new Response(JSON.stringify(SET), { status: 200 });
    if (url.pathname.endsWith("/cards")) {
      const rarity = url.searchParams.get("rarity");
      if (rarity) {
        const value = rarity.replace(/^eq:/, "");
        const data = BY_RARITY[value] ?? [];
        return new Response(JSON.stringify(data), { status: 200, headers: { "x-total-count": String(data.length) } });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  });
}

async function load() {
  vi.resetModules();
  const pools = await import("../src/services/packPools");
  const tcgdex = await import("../src/services/tcgdex");
  return { ...pools, ...tcgdex };
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("pack pool builder", () => {
  it("builds rarity buckets from filtered briefs", async () => {
    vi.stubGlobal("fetch", installFetch());
    const { buildPackPool } = await load();
    const { set } = await (await import("../src/services/tcgdex")).getSet(SET.id);
    const pool = await buildPackPool(set, configById("sv")!);

    expect(pool.tiers.common?.map((card) => card.id)).toEqual(["sv06.5-001"]);
    expect(pool.tiers.uncommon?.map((card) => card.id)).toEqual(["sv06.5-050"]);
    expect(pool.tiers.rare?.map((card) => card.id)).toEqual(["sv06.5-060"]);
    expect(pool.tiers.doubleRare?.map((card) => card.id)).toEqual(["sv06.5-090"]);
    expect(pool.tiers.specialIllustrationRare?.[0].id).toBe("sv06.5-095");
    // Cards with no rarity in the mocked responses are reported, not guessed.
    expect(pool.sourceSets).toEqual([SET.id]);
  });

  it("never accepts a card from another expansion", async () => {
    vi.stubGlobal(
      "fetch",
      installFetch(() => undefined)
    );
    // A deliberately leaky upstream response.
    const leaky = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/sets")) return new Response(JSON.stringify([{ id: SET.id, name: SET.name }]), { status: 200 });
      if (url.pathname.endsWith(`/sets/${SET.id}`)) return new Response(JSON.stringify(SET), { status: 200 });
      if (url.pathname.endsWith("/cards") && url.searchParams.get("rarity")) {
        return new Response(
          JSON.stringify([
            { id: "sv06.5-001", localId: "001", name: "Joltik" },
            { id: "base1-4", localId: "4", name: "Charizard" },
          ]),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", leaky);

    const { buildPackPool } = await load();
    const { set } = await (await import("../src/services/tcgdex")).getSet(SET.id);
    const pool = await buildPackPool(set, configById("sv")!);
    const ids = Object.values(pool.tiers).flatMap((cards) => (cards ?? []).map((card) => card.id));
    expect(ids).not.toContain("base1-4");
    expect(ids.every((id) => id.startsWith("sv06.5-"))).toBe(true);
  });

  it("reports an honest empty state when a set has no rarity data", async () => {
    const empty = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/sets")) return new Response(JSON.stringify([{ id: SET.id, name: SET.name }]), { status: 200 });
      if (url.pathname.endsWith(`/sets/${SET.id}`)) return new Response(JSON.stringify(SET), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", empty);

    const { buildPackPool, PackPoolError } = await load();
    const { set } = await (await import("../src/services/tcgdex")).getSet(SET.id);
    await expect(buildPackPool(set, configById("sv")!)).rejects.toBeInstanceOf(PackPoolError);
  });

  it("turns network failures into a retryable error, not fake cards", async () => {
    const failing = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/sets")) return new Response(JSON.stringify([{ id: SET.id, name: SET.name }]), { status: 200 });
      if (url.pathname.endsWith(`/sets/${SET.id}`)) return new Response(JSON.stringify(SET), { status: 200 });
      return new Response("boom", { status: 500 });
    });
    vi.stubGlobal("fetch", failing);

    const { buildPackPool, PackPoolError } = await load();
    const { set } = await (await import("../src/services/tcgdex")).getSet(SET.id);
    await expect(buildPackPool(set, configById("sv")!)).rejects.toMatchObject({ code: "network" });
    expect(PackPoolError).toBeTruthy();
  });

  it("includes Trainer Gallery style subsets in the same expansion", async () => {
    const { relatedSetIds } = await load();
    const all = ["swsh9", "swsh9tg", "swsh4.5", "swsh4.5sv", "swsh12.5", "swsh12.5gg", "swsh10"];
    expect(relatedSetIds("swsh9", all)).toEqual(["swsh9", "swsh9tg"]);
    expect(relatedSetIds("swsh4.5", all)).toEqual(["swsh4.5", "swsh4.5sv"]);
    expect(relatedSetIds("swsh12.5", all)).toEqual(["swsh12.5", "swsh12.5gg"]);
    expect(relatedSetIds("swsh10", all)).toEqual(["swsh10"]);
  });

  it("lists only rarities a rule can actually use", async () => {
    const { tiersForConfig } = await load();
    const wotc = tiersForConfig(PACK_CONFIGS.find((config) => config.id === "wotc-base")!);
    expect(wotc).toContain("common");
    expect(wotc).toContain("rare");
    expect(wotc).not.toContain("illustrationRare");

    const sv = tiersForConfig(configById("sv")!);
    expect(sv).toContain("specialIllustrationRare");
    expect(sv).toContain("aceSpec");
  });
});
