import type { PackResult, RarityTier } from "../types/packs";
import { TIER_LABELS, tierRank } from "../data/packRules";

/** Tier rank at which a card counts as a "hit" (double rare and above). */
export const HIT_RANK = tierRank("doubleRare");

export interface ResultHighlights {
  /** Rarity names come from each era's own vocabulary, never a generic list. */
  badges: string[];
  /** True when the rarest card is an illustration rare or better. */
  special: boolean;
  topTier: RarityTier | null;
  hits: number;
}

/**
 * Describes an opening without inventing anything: every badge is derived from
 * the cards actually generated, using the tier labels of the era's own rule.
 */
export function resultHighlights(results: PackResult[]): ResultHighlights {
  const hits = results.reduce(
    (sum, pack) => sum + pack.cards.filter((card) => tierRank(card.tier) >= HIT_RANK).length,
    0
  );

  let topTier: RarityTier | null = null;
  for (const pack of results) {
    for (const card of pack.cards) {
      if (!topTier || tierRank(card.tier) > tierRank(topTier)) topTier = card.tier;
    }
  }

  const multiRare = results.some(
    (pack) => pack.cards.filter((card) => tierRank(card.tier) >= HIT_RANK).length >= 2
  );

  const badges: string[] = [];
  if (results.length > 1) badges.push(`${hits} rare or better`);
  else badges.push(`${results[0]?.cards.length ?? 0} cards`);
  if (multiRare) badges.push("Multi-rare pack");
  if (topTier && tierRank(topTier) >= HIT_RANK) badges.push(`Best: ${TIER_LABELS[topTier]}`);

  return {
    badges,
    special: Boolean(topTier && tierRank(topTier) >= 13),
    topTier,
    hits,
  };
}
