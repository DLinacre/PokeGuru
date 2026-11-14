import { describe, expect, it } from "vitest";
import {
  PACK_CONFIGS,
  SERIES_ORDER,
  TIER_LABELS,
  TIER_ORDER,
  confidenceLabel,
  configById,
  isBoosterSeries,
  isBoosterSet,
  resolvePackConfig,
  seriesIdFromName,
  slotCount,
  tierFromRarity,
  tierRank,
} from "../src/data/packRules";

describe("pack rules", () => {
  it("keeps every configured pack size consistent with its slots", () => {
    for (const config of PACK_CONFIGS) {
      expect(slotCount(config), `${config.id} slot total`).toBe(config.cardsPerPack);
    }
  });

  it("gives every rule a documented source and review date", () => {
    for (const config of PACK_CONFIGS) {
      expect(config.source.label.length, config.id).toBeGreaterThan(5);
      expect(config.source.note.length, config.id).toBeGreaterThan(20);
      expect(config.checkedAt, config.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["documented", "estimated"]).toContain(config.confidence);
      expect(config.era.length, config.id).toBeGreaterThan(3);
    }
  });

  it("never reuses a configuration id", () => {
    const ids = PACK_CONFIGS.map((config) => config.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every booster series exactly once", () => {
    for (const seriesId of SERIES_ORDER) {
      expect(isBoosterSeries(seriesId), seriesId).toBe(true);
      const matches = PACK_CONFIGS.filter((config) => config.seriesIds.includes(seriesId));
      expect(matches.length, `${seriesId} matched ${matches.length} rules`).toBeGreaterThanOrEqual(1);
    }
  });

  it("resolves sets to the era rule, including overrides", () => {
    expect(resolvePackConfig({ id: "base1", seriesId: "base" })?.id).toBe("wotc-base");
    expect(resolvePackConfig({ id: "sv06.5", seriesId: "sv" })?.id).toBe("sv");
    expect(resolvePackConfig({ id: "me01", seriesId: "me" })?.id).toBe("sv");
    expect(resolvePackConfig({ id: "swsh3", seriesId: "swsh" })?.id).toBe("swsh");
    // Legendary Collection is the one WotC-era set with a reverse holo slot.
    expect(resolvePackConfig({ id: "lc", seriesId: "lc" })?.id).toBe("wotc-legendary");
    expect(resolvePackConfig({ id: "tcgp-A1", seriesId: "tcgp" })).toBeUndefined();
    expect(resolvePackConfig({ id: "basep-1", seriesId: "base" })?.id).toBe("wotc-base");
  });

  it("marks the one structure Pokémon documents as documented, the rest as estimates", () => {
    const documented = PACK_CONFIGS.filter((config) => config.confidence === "documented");
    expect(documented.map((config) => config.id)).toEqual(["sv"]);
    expect(documented[0].source.url).toContain("pokemon.com");
  });

  it("excludes non-booster products from the catalogue", () => {
    expect(isBoosterSeries("sv")).toBe(true);
    expect(isBoosterSeries("tcgp")).toBe(false);
    expect(isBoosterSeries("misc")).toBe(false);
    expect(isBoosterSeries("pop")).toBe(false);
    expect(isBoosterSeries("mc")).toBe(false);
    expect(isBoosterSeries(undefined)).toBe(false);

    expect(isBoosterSet("Shrouded Fable")).toBe(true);
    expect(isBoosterSet("Base Set")).toBe(true);
    expect(isBoosterSet("SVP Black Star Promos")).toBe(false);
    expect(isBoosterSet("Scarlet & Violet Energy")).toBe(false);
    expect(isBoosterSet("McDonald's Collection 2023")).toBe(false);
    expect(isBoosterSet("Brilliant Stars Trainer Gallery")).toBe(false);
    expect(isBoosterSet("Crown Zenith Galarian Gallery")).toBe(false);
  });

  it("maps TCGdex rarity strings onto tiers, whatever the capitalisation", () => {
    expect(tierFromRarity("Common")).toBe("common");
    expect(tierFromRarity("uncommon")).toBe("uncommon");
    expect(tierFromRarity("Rare")).toBe("rare");
    expect(tierFromRarity("Rare Holo")).toBe("holoRare");
    expect(tierFromRarity("Holo Rare V")).toBe("ultraRare");
    expect(tierFromRarity("Holo Rare VMAX")).toBe("ultraRare");
    expect(tierFromRarity("Full Art Trainer")).toBe("ultraRare");
    expect(tierFromRarity("Rare PRIME")).toBe("prime");
    expect(tierFromRarity("Holo Rare")).toBe("holoRare");
    expect(tierFromRarity("Double rare")).toBe("doubleRare");
    expect(tierFromRarity("Ultra Rare")).toBe("ultraRare");
    expect(tierFromRarity("Illustration rare")).toBe("illustrationRare");
    expect(tierFromRarity("Special illustration rare")).toBe("specialIllustrationRare");
    expect(tierFromRarity("Hyper rare")).toBe("hyperRare");
    expect(tierFromRarity("ACE SPEC Rare")).toBe("aceSpec");
    expect(tierFromRarity("Rare PRIME")).toBe("prime");
    expect(tierFromRarity("LEGEND")).toBe("legend");
    expect(tierFromRarity("Rare Holo LV.X")).toBe("lvX");
    expect(tierFromRarity("Secret Rare")).toBe("secretRare");
    expect(tierFromRarity("")).toBe("other");
    expect(tierFromRarity(undefined)).toBe("other");
    expect(tierFromRarity("Something new")).toBe("other");
  });

  it("orders every tier without duplicates so 'best pull' is stable", () => {
    expect(new Set(TIER_ORDER).size).toBe(TIER_ORDER.length);
    for (const tier of Object.keys(TIER_LABELS) as (keyof typeof TIER_LABELS)[]) {
      expect(TIER_ORDER).toContain(tier);
    }
    expect(tierRank("specialIllustrationRare")).toBeGreaterThan(tierRank("illustrationRare"));
    expect(tierRank("common")).toBeLessThan(tierRank("rare"));
  });

  it("maps published series names to ids used by the rules", () => {
    expect(seriesIdFromName("Scarlet & Violet")).toBe("sv");
    expect(seriesIdFromName("HeartGold & SoulSilver")).toBe("hgss");
    expect(seriesIdFromName("E-Card")).toBe("ecard");
    expect(seriesIdFromName("Pokémon TCG Pocket")).toBe("tcgp");
    expect(seriesIdFromName("Not a series")).toBeUndefined();
  });

  it("labels confidence honestly", () => {
    expect(confidenceLabel("documented")).toBe("Documented structure");
    expect(confidenceLabel("estimated")).toBe("Estimated model");
  });

  it("finds rules by id", () => {
    expect(configById("sv")?.cardsPerPack).toBe(10);
    expect(configById("nope")).toBeUndefined();
  });
});
