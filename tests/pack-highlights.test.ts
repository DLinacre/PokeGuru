import { describe, expect, it } from "vitest";
import type { PackResult, PulledCard, RarityTier } from "../src/types/packs";
import { resultHighlights } from "../src/utils/packHighlights";

function card(tier: RarityTier, index = 0): PulledCard {
  return {
    id: `sv06.5-${tier}-${index}`,
    name: `${tier} ${index}`,
    localId: String(index),
    setId: "sv06.5",
    setName: "Shrouded Fable",
    rarity: tier,
    tier,
    treatment: "normal",
    slot: "rare",
  };
}

function pack(cards: PulledCard[], index = 0): PackResult {
  return {
    id: `pack-${index}`,
    setId: "sv06.5",
    setName: "Shrouded Fable",
    seriesId: "sv",
    configId: "sv",
    openedAt: 0,
    seed: "seed",
    cards,
    bestTier: cards.reduce<RarityTier | null>((best, entry) => (best && best !== entry.tier ? best : entry.tier), null),
  };
}

describe("pack highlights", () => {
  it("reports the card count for a plain pack without inventing a hit", () => {
    const highlights = resultHighlights([pack([card("common"), card("uncommon"), card("rare")])]);
    expect(highlights.badges).toEqual(["3 cards"]);
    expect(highlights.special).toBe(false);
    expect(highlights.hits).toBe(0);
  });

  it("names the rarest tier using the era's own rarity label", () => {
    const highlights = resultHighlights([pack([card("common"), card("specialIllustrationRare")])]);
    expect(highlights.topTier).toBe("specialIllustrationRare");
    expect(highlights.badges).toContain("Best: Special illustration rare");
    expect(highlights.special).toBe(true);
  });

  it("flags a multi-rare pack only when two hits actually appear", () => {
    const singleHit = resultHighlights([pack([card("doubleRare"), card("common")])]);
    expect(singleHit.badges).not.toContain("Multi-rare pack");

    const multi = resultHighlights([pack([card("doubleRare"), card("illustrationRare", 1)])]);
    expect(multi.badges).toContain("Multi-rare pack");
    expect(multi.hits).toBe(2);
  });

  it("counts hits across a batch", () => {
    const highlights = resultHighlights([
      pack([card("doubleRare"), card("common")], 0),
      pack([card("common"), card("uncommon")], 1),
      pack([card("hyperRare"), card("common")], 2),
    ]);
    expect(highlights.hits).toBe(2);
    expect(highlights.badges[0]).toBe("2 rare or better");
    expect(highlights.topTier).toBe("hyperRare");
  });

  it("never marks a batch of plain cards as special", () => {
    const highlights = resultHighlights([pack([card("common")]), pack([card("rare")], 1)]);
    expect(highlights.special).toBe(false);
    expect(highlights.hits).toBe(0);
    expect(highlights.badges).toEqual(["0 rare or better"]);
  });
});
