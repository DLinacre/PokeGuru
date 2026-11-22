import type { PackResult, PulledCard, RarityTier } from "../types/packs";
import { TIER_LABELS, tierRank } from "../data/packRules";

/**
 * Rarity thresholds used across the simulator.
 *
 * They are separate on purpose, because "best slot" and "actual pull" are not
 * the same thing:
 *
 *  - `HIT_RANK` is the modern chase threshold (double rare and above). It is
 *    what the era rules mean by a "hit" slot in Scarlet & Violet.
 *  - `NOTABLE_RANK` is "a rare or better" — the floor for showing a card in
 *    the highlight strip. A base-set Charizard is a plain rare, and it should
 *    still be celebrated as a real pull.
 */
export const HIT_RANK = tierRank("doubleRare");
/** Rarer than a plain rare — the start of what a collector calls a pull. */
export const NOTABLE_RANK = tierRank("rare");

const NOTABLE_COPY = "Rare or better";

export interface PullCounts {
  /** Cards that are a rare or better — everything worth showing off. */
  notable: number;
  /** Chase pulls for this era: double rare+ in modern sets, holo rare+ before. */
  hits: number;
  /** Everything counted as notable, rarest first, for the strip of faces. */
  cards: PulledCard[];
  /** The single best card actually pulled, whatever its rarity. */
  best: PulledCard | null;
  /** Threshold wording that matches how this era's rules label rarities. */
  notableLabel: string;
  hitLabel: string;
}

/**
 * Chase thresholds differ by era, so the summary never uses modern language on
 * an old set: a Wizards-era pack's excitement is the holo, a Scarlet & Violet
 * pack's is the double rare and above.
 *
 * `hasSeparateHolo` matters because the earliest sets do not separate holo from
 * non-holo in the card database at all — they are one combined rare pool. On
 * those sets a holo rare is simply not a distinct tier, so the threshold drops
 * to "rare or better" rather than permanently reporting zero holos.
 */
export function chaseThreshold(
  configId: string,
  hasSeparateHolo = true,
): {
  rank: number;
  label: string;
} {
  const modern = /^(sv|swsh|sm|xy|bw|mega)$/i.test(configId);
  if (modern) {
    return { rank: tierRank("doubleRare"), label: "Double rare or better" };
  }
  return hasSeparateHolo
    ? { rank: tierRank("holoRare"), label: "Holo rare or better" }
    : { rank: tierRank("rare"), label: "Rare or better" };
}

/** Options shared by the counters, so every reader agrees on the threshold. */
export interface CountOptions {
  /** False for sets whose pool does not separate holo from non-holo rares. */
  hasSeparateHolo?: boolean;
}

/**
 * What a set of packs actually produced.
 *
 * This is deliberately derived from the drawn cards only — never from the
 * slot the card came from. A pack can be dealt a "rare or better" slot and
 * still contain a plain rare, which is why an opening that shows a Charizard
 * can honestly report zero chase hits: base-set Charizard *is* a plain rare.
 */
export function pullCounts(
  results: PackResult[],
  options: CountOptions = {},
): PullCounts {
  const cards: PulledCard[] = [];
  let best: PulledCard | null = null;

  for (const pack of results) {
    for (const card of pack.cards) {
      if (tierRank(card.tier) >= NOTABLE_RANK) cards.push(card);
      if (!best || tierRank(card.tier) > tierRank(best.tier)) best = card;
    }
  }

  cards.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));

  const chase = chaseThreshold(
    results[0]?.configId ?? "",
    options.hasSeparateHolo ?? true,
  );
  return {
    notable: cards.length,
    hits: cards.filter((card) => tierRank(card.tier) >= chase.rank).length,
    cards,
    best,
    notableLabel: NOTABLE_COPY,
    hitLabel: chase.label,
  };
}

export interface ResultHighlights {
  /** Rarity names come from each era's own vocabulary, never a generic list. */
  badges: string[];
  /** True when the rarest card is an illustration rare or better. */
  special: boolean;
  topTier: RarityTier | null;
  /** Chase pulls for this era's threshold across the opening. */
  hits: number;
  /** Same value under its clearer name; kept so call sites read well. */
  chaseHits: number;
}

/**
 * Describes an opening without inventing anything: every badge is derived from
 * the cards actually generated, using the tier labels of the era's own rule.
 */
export function resultHighlights(
  results: PackResult[],
  options: CountOptions = {},
): ResultHighlights {
  const counts = pullCounts(results, options);

  let topTier: RarityTier | null = null;
  for (const pack of results) {
    for (const card of pack.cards) {
      if (!topTier || tierRank(card.tier) > tierRank(topTier))
        topTier = card.tier;
    }
  }

  const chase = chaseThreshold(
    results[0]?.configId ?? "",
    options.hasSeparateHolo ?? true,
  );
  const multiRare = results.some(
    (pack) =>
      pack.cards.filter((card) => tierRank(card.tier) >= chase.rank).length >=
      2,
  );

  const badges: string[] = [];
  if (results.length > 1) {
    badges.push(
      counts.hits > 0
        ? `${counts.hits} ${counts.hitLabel.toLowerCase()}`
        : `No ${counts.hitLabel.toLowerCase()}`,
    );
  } else {
    badges.push(`${results[0]?.cards.length ?? 0} cards`);
  }
  if (multiRare) badges.push("Multi-rare pack");
  if (topTier && tierRank(topTier) >= NOTABLE_RANK)
    badges.push(`Best: ${TIER_LABELS[topTier]}`);

  return {
    badges,
    special: Boolean(topTier && tierRank(topTier) >= 13),
    topTier,
    hits: counts.hits,
    chaseHits: counts.hits,
  };
}
