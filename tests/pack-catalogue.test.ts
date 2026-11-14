import { describe, expect, it } from "vitest";
import { buildCatalogue, seriesName } from "../src/services/packCatalogue";

const sets = [
  { id: "sv06.5", name: "Shrouded Fable", cardCount: { official: 64, total: 99 }, logo: "logo", symbol: "sym" },
  { id: "svp", name: "SVP Black Star Promos", cardCount: { official: 100 } },
  { id: "sve", name: "Scarlet & Violet Energy", cardCount: { official: 8 } },
  { id: "sv09", name: "Journey Together", cardCount: { official: 190 } },
  { id: "sv03.5", name: "151", cardCount: { official: 165 } },
  { id: "tiny", name: "Tiny Promo Deck", cardCount: { official: 5 } },
  { id: "mfb", name: "My First Battle", cardCount: { official: 48 } },
];

const releaseDates = (name: string) => (name === "Shrouded Fable" ? "2024-08-02" : undefined);

describe("pack catalogue", () => {
  it("keeps real expansions and drops promo, energy and deck products", () => {
    const entries = buildCatalogue([{ seriesId: "sv", sets }], releaseDates);
    const ids = entries.map((entry) => entry.setId);
    expect(ids).toContain("sv06.5");
    expect(ids).toContain("sv09");
    expect(ids).toContain("sv03.5");
    expect(ids).not.toContain("svp");
    expect(ids).not.toContain("sve");
    expect(ids).not.toContain("tiny");
    expect(ids).not.toContain("mfb");
  });

  it("resolves each expansion to its era rule", () => {
    const entries = buildCatalogue([{ seriesId: "sv", sets }], releaseDates);
    for (const entry of entries) expect(entry.configId).toBe("sv");
  });

  it("joins curated release dates by exact set name and leaves gaps blank", () => {
    const entries = buildCatalogue([{ seriesId: "sv", sets }], releaseDates);
    const shrouded = entries.find((entry) => entry.setId === "sv06.5");
    const journey = entries.find((entry) => entry.setId === "sv09");
    expect(shrouded?.releaseDate).toBe("2024-08-02");
    expect(journey?.releaseDate).toBeUndefined();
  });

  it("sorts newest first and falls back to name for undated sets", () => {
    const entries = buildCatalogue([{ seriesId: "sv", sets }], releaseDates);
    expect(entries[0].setId).toBe("sv06.5");
    expect(entries.slice(1).map((entry) => entry.setName)).toEqual(["151", "Journey Together"]);
  });

  it("ignores series that are not sold as boosters", () => {
    const entries = buildCatalogue([{ seriesId: "tcgp", sets }], releaseDates);
    expect(entries).toEqual([]);
  });

  it("provides readable series names", () => {
    expect(seriesName("hgss")).toBe("HeartGold & SoulSilver");
    expect(seriesName("nope")).toBe("nope");
  });
});
