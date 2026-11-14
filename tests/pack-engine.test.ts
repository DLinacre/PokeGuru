import { describe, expect, it } from "vitest";
import type { PackConfig, PackPool, PoolCard, RarityTier } from "../src/types/packs";
import {
  PackGenerationError,
  computePackOdds,
  generatePack,
  generatePacks,
  seededRng,
  tierWeightTable,
} from "../src/services/packEngine";
import { PACK_CONFIGS, configById, resolvePackConfig, tierRank } from "../src/data/packRules";

const SET_ID = "test1";

function card(tier: RarityTier, index: number): PoolCard {
  return {
    id: `${SET_ID}-${tier}-${index}`,
    name: `${tier} ${index}`,
    localId: String(index),
    setId: SET_ID,
    setName: "Test Set",
    rarity: tier,
    tier,
    image: `https://assets.tcgdex.net/en/test/${index}/low.webp`,
  };
}

function pool(overrides: Partial<Record<RarityTier, number>> = {}): PackPool {
  const sizes: Partial<Record<RarityTier, number>> = {
    common: 30,
    uncommon: 20,
    rare: 12,
    holoRare: 8,
    doubleRare: 6,
    ultraRare: 5,
    illustrationRare: 4,
    specialIllustrationRare: 2,
    hyperRare: 2,
    aceSpec: 1,
    ...overrides,
  };
  const tiers: PackPool["tiers"] = {};
  for (const [tier, count] of Object.entries(sizes) as [RarityTier, number][]) {
    if (count > 0) tiers[tier] = Array.from({ length: count }, (_, index) => card(tier, index + 1));
  }
  return {
    setId: SET_ID,
    setName: "Test Set",
    seriesId: "sv",
    configId: "sv",
    tiers,
    unmapped: 0,
    examined: Object.values(sizes).reduce((sum, count) => sum + count, 0),
    sourceSets: [SET_ID],
    builtAt: Date.now(),
  };
}

const SV = configById("sv") as PackConfig;

describe("pack generation", () => {
  it("produces the configured pack size for every era rule", () => {
    const testPool = pool();
    for (const config of PACK_CONFIGS) {
      const result = generatePack({ pool: testPool, config, seed: `size-${config.id}` });
      expect(result.cards, config.id).toHaveLength(config.cardsPerPack);
      expect(result.configId).toBe(config.id);
    }
  });

  it("only ever uses cards that belong to the selected expansion", () => {
    const testPool = pool();
    for (let index = 0; index < 30; index += 1) {
      const result = generatePack({ pool: testPool, config: SV, seed: `pool-${index}` });
      for (const pulled of result.cards) {
        expect(pulled.setId).toBe(SET_ID);
        const source = Object.values(testPool.tiers)
          .flat()
          .find((entry) => entry.id === pulled.id);
        expect(source, `${pulled.id} must come from the pool`).toBeTruthy();
        expect(pulled.tier).toBe(source?.tier);
      }
    }
  });

  it("never duplicates a physical card inside one pack", () => {
    const testPool = pool();
    for (let index = 0; index < 40; index += 1) {
      const result = generatePack({ pool: testPool, config: SV, seed: `dupe-${index}` });
      const ids = result.cards.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("always honours the guaranteed rare-or-better slot", () => {
    const testPool = pool();
    for (let index = 0; index < 60; index += 1) {
      const result = generatePack({ pool: testPool, config: SV, seed: `rare-${index}` });
      const best = result.cards.reduce((rank, entry) => Math.max(rank, tierRank(entry.tier)), 0);
      expect(best).toBeGreaterThanOrEqual(tierRank("rare"));
    }
  });

  it("never draws a rarity the rule does not allow for a restricted slot", () => {
    const testPool = pool({ doubleRare: 0, ultraRare: 0, illustrationRare: 0, specialIllustrationRare: 0, hyperRare: 0, aceSpec: 0 });
    const config: PackConfig = {
      ...SV,
      slots: [{ id: "rare", label: "Rare", kind: "rare", count: 3, weights: { rare: 1 } }],
      cardsPerPack: 3,
    };
    const result = generatePack({ pool: testPool, config, seed: "restricted" });
    expect(result.cards).toHaveLength(3);
    for (const pulled of result.cards) expect(pulled.tier).toBe("rare");
  });

  it("gives reverse slots the reverse finish and common slots the normal finish", () => {
    const swsh = configById("swsh") as PackConfig;
    const result = generatePack({ pool: pool(), config: swsh, seed: "finishes" });
    for (const pulled of result.cards) {
      if (pulled.slot === "reverse") expect(pulled.treatment).toBe("reverse");
      if (pulled.slot === "common" || pulled.slot === "uncommon") expect(pulled.treatment).toBe("normal");
    }
  });

  it("sorts the reveal so the rarest card comes last", () => {
    const result = generatePack({ pool: pool(), config: SV, seed: "order" });
    const ranks = result.cards.map((entry) => tierRank(entry.tier));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const last = result.cards[result.cards.length - 1];
    expect(tierRank(last.tier)).toBe(Math.max(...ranks));
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const first = generatePack({ pool: pool(), config: SV, seed: "reproducible" });
    const second = generatePack({ pool: pool(), config: SV, seed: "reproducible" });
    expect(second.cards.map((entry) => entry.id)).toEqual(first.cards.map((entry) => entry.id));
    expect(second.seed).toBe(first.seed);

    const other = generatePack({ pool: pool(), config: SV, seed: "different" });
    expect(other.cards.map((entry) => entry.id)).not.toEqual(first.cards.map((entry) => entry.id));
  });

  it("respects configured tier weights within statistical tolerance", () => {
    const config: PackConfig = {
      ...SV,
      slots: [
        {
          id: "rare",
          label: "Rare",
          kind: "rare",
          count: 1,
          weights: { rare: 9, specialIllustrationRare: 1 },
        },
      ],
      cardsPerPack: 1,
    };
    const rng = seededRng("weights");
    let hits = 0;
    const runs = 4000;
    for (let index = 0; index < runs; index += 1) {
      const result = generatePack({ pool: pool(), config, rng });
      if (result.cards[0].tier === "specialIllustrationRare") hits += 1;
    }
    const observed = hits / runs;
    expect(observed).toBeGreaterThan(0.075);
    expect(observed).toBeLessThan(0.125);
  });

  it("falls back honestly when a weighted rarity has no cards", () => {
    const config: PackConfig = {
      ...SV,
      slots: [
        { id: "common", label: "Common", kind: "common", count: 1 },
        { id: "rare", label: "Rare", kind: "rare", count: 1, weights: { secretRare: 1 } },
      ],
      cardsPerPack: 2,
    };
    const testPool = pool({ secretRare: 0 });
    const result = generatePack({ pool: testPool, config, seed: "fallback" });
    expect(result.cards).toHaveLength(2);
    // The documented chain for a rare slot is rare -> holo rare -> ...
    expect(result.cards.map((entry) => entry.tier)).toContain("rare");
  });

  it("refuses to generate a pack when the pool has no usable cards", () => {
    const empty = pool({ common: 0, uncommon: 0, rare: 0, holoRare: 0, doubleRare: 0, ultraRare: 0, illustrationRare: 0, specialIllustrationRare: 0, hyperRare: 0, aceSpec: 0 });
    expect(() => generatePack({ pool: empty, config: SV, seed: "empty" })).toThrow(PackGenerationError);
  });

  it("opens batches with independent randomness", () => {
    const packs = generatePacks({ pool: pool(), config: SV }, 5);
    expect(packs).toHaveLength(5);
    expect(new Set(packs.map((entry) => entry.id)).size).toBe(5);
    for (const pack of packs) expect(pack.cards).toHaveLength(SV.cardsPerPack);
  });

  it("handles rapid generation without shared state", () => {
    const testPool = pool();
    const packs = Array.from({ length: 100 }, (_, index) =>
      generatePack({ pool: testPool, config: SV, seed: `rapid-${index}` })
    );
    for (const pack of packs) {
      expect(pack.cards).toHaveLength(SV.cardsPerPack);
      expect(new Set(pack.cards.map((entry) => entry.id)).size).toBe(SV.cardsPerPack);
    }
  });
});

describe("pack odds", () => {
  it("reports a probability for every tier that can appear", () => {
    const odds = computePackOdds(pool(), SV);
    expect(odds.rows.length).toBeGreaterThan(3);
    for (const row of odds.rows) {
      expect(row.perPack).toBeGreaterThanOrEqual(0);
      expect(row.perPack).toBeLessThanOrEqual(1);
      expect(row.poolSize).toBeGreaterThan(0);
    }
    expect(odds.confidence).toBe("documented");
    expect(odds.slotSummary.reduce((sum, slot) => sum + slot.count, 0)).toBe(SV.cardsPerPack);
  });

  it("matches the generator's tier frequencies", () => {
    const testPool = pool();
    const odds = computePackOdds(testPool, SV);
    const rareRow = odds.rows.find((row) => row.tier === "rare");
    expect(rareRow).toBeTruthy();

    const runs = 2000;
    let packsWithRare = 0;
    for (let index = 0; index < runs; index += 1) {
      const result = generatePack({ pool: testPool, config: SV, seed: `odds-${index}` });
      if (result.cards.some((entry) => entry.tier === "rare")) packsWithRare += 1;
    }
    const observed = packsWithRare / runs;
    // Two independent slots (guaranteed + wildcard) plus the reverse foil can
    // surface a plain rare, so the modelled at-least-one value is compared
    // with a tolerance that reflects the small-sample noise of 2,000 packs.
    expect(Math.abs(observed - (rareRow?.perPack ?? 0))).toBeLessThan(0.12);
  });

  it("keeps measured Scarlet & Violet tier shares inside the published range", () => {
    // TCGplayer Authentication Center (8,000+ packs): Double rare 13.8%,
    // Ultra rare 6.6%, Illustration rare 7.7%, SIR 3.1%, Hyper rare 1.9%.
    const odds = computePackOdds(pool(), SV);
    const chance = (tier: RarityTier) => odds.rows.find((row) => row.tier === tier)?.perPack ?? 0;

    expect(chance("doubleRare")).toBeGreaterThan(0.1);
    expect(chance("doubleRare")).toBeLessThan(0.18);
    expect(chance("ultraRare")).toBeGreaterThan(0.03);
    expect(chance("ultraRare")).toBeLessThan(0.09);
    expect(chance("illustrationRare")).toBeGreaterThan(0.04);
    expect(chance("illustrationRare")).toBeLessThan(0.1);
    expect(chance("specialIllustrationRare")).toBeLessThan(0.05);
    expect(chance("hyperRare")).toBeLessThan(0.03);
    expect(odds.weightsBasis?.kind).toBe("measured");
    expect(odds.weightsBasis?.url).toContain("tcgplayer.com");
  });

  it("never lets a reverse holo land on a chase rarity", () => {
    const testPool = pool();
    for (let index = 0; index < 300; index += 1) {
      const result = generatePack({ pool: testPool, config: SV, seed: `reverse-${index}` });
      for (const card of result.cards.filter((entry) => entry.treatment === "reverse")) {
        expect(["common", "uncommon", "rare", "holoRare"]).toContain(card.tier);
      }
    }
  });

  it("flags a thin pool instead of hiding it", () => {
    const thin = computePackOdds(pool({ specialIllustrationRare: 1 }), SV);
    expect(thin.thin).toBe(true);
  });

  it("returns an empty weight table when configured tiers are absent", () => {
    const table = tierWeightTable({ secretRare: 1 }, pool({ secretRare: 0 }));
    expect(table).toEqual([]);
  });

  it("only applies rules to booster series sets", () => {
    expect(resolvePackConfig({ id: "sv06.5", seriesId: "sv" })?.id).toBe("sv");
    expect(resolvePackConfig({ id: "A1", seriesId: "tcgp" })).toBeUndefined();
  });
});
