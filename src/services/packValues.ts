/**
 * Pack values — the single calculation layer for money in the simulator.
 *
 * Everything a pack UI shows (a card's price, the running pack total, the
 * opening summary, the session totals and the historical record) is derived
 * from the functions here, so two screens can never disagree about the same
 * pull.
 *
 * Rules that this module exists to enforce
 * ---------------------------------------
 *  - **A missing price is not £0.** Unpriced pulls carry `status:
 *    "unavailable"` with a reason; they are counted, displayed, and left out
 *    of every total rather than silently dragging it down.
 *  - **A value belongs to a finish.** The quote comes from the band that
 *    matches the finish that was actually pulled (see `resolveFinishQuote`).
 *    Reverse-holo pulls have no Cardmarket band in TCGdex's payload, so they
 *    are reported as unavailable rather than valued with the normal price.
 *  - **Totals are sums of what is shown.** Each card is converted and rounded
 *    to 2dp first, then summed, so the visible card prices add up to the
 *    visible total.
 *  - **Duplicates count.** A session sums pulled copies, not unique cards; the
 *    same card therefore contributes once per copy pulled.
 *  - **Snapshots are frozen.** `toOpeningRecord` captures the amounts, source,
 *    marketplace date and FX rate once; later market moves never rewrite it.
 */

import type { TcgCard } from "../types/pokemon";
import type {
  OpeningPackRecord,
  OpeningSession,
  PackResult,
  PackValueTotals,
  PullFinish,
  PulledCard,
  PullValuation,
  RarityTier,
} from "../types/packs";
import type { ExchangeRate } from "./currency";
import { eurToGbp } from "./currency";
import { pullFinishLabel, resolveFinishQuote, type FinishQuote } from "./pricing";

/** Round to whole pence. Money is only ever displayed and summed at 2dp. */
export function roundPence(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Stable key for one card in one finish. */
export function valuationKey(cardId: string, finish: PullFinish): string {
  return `${cardId}|${finish}`;
}

/** Everything the loader can know about a pull before FX is applied. */
export type QuoteState =
  | { kind: "quote"; quote: FinishQuote }
  | { kind: "none" }
  | { kind: "error"; message: string };

export type QuoteMap = Record<string, QuoteState>;

/** The finish a pulled card was physically opened in. */
export function finishOf(pull: Pick<PulledCard, "treatment">): PullFinish {
  return pull.treatment === "reverse" ? "reverse" : pull.treatment === "holo" ? "holo" : "normal";
}

/**
 * Resolve a pulled card's marketplace quote. Pure: the same card, finish and
 * pricing payload always produce the same answer.
 */
export function quoteForPull(
  card: Partial<Pick<TcgCard, "pricing" | "variants" | "rarity">> | undefined,
  finish: PullFinish
): QuoteState {
  // Cardmarket publishes no reverse-holofoil band through TCGdex, so a
  // reverse pull can never be valued from this source.
  if (finish === "reverse") return { kind: "none" };
  const quote = resolveFinishQuote(card?.pricing, card as Pick<TcgCard, "variants" | "rarity"> | undefined, finish);
  return quote ? { kind: "quote", quote } : { kind: "none" };
}

function unavailableReason(finish: PullFinish, state: QuoteState | undefined): string {
  if (state?.kind === "error") return "The price lookup failed, so no value is shown.";
  if (finish === "reverse") {
    return "Cardmarket does not publish a reverse-holofoil price for this card, so no value is shown.";
  }
  if (finish === "holo") return "Cardmarket does not publish a holofoil price for this card.";
  return "Cardmarket does not publish a price for this card's printing.";
}

const unavailableFlag = (finish: PullFinish, state: QuoteState | undefined): string =>
  finish === "reverse" ? "no-reverse-band" : state?.kind === "error" ? "lookup-failed" : "no-price";

/**
 * Turn a pulled card plus its quote state into the record every UI surface
 * reads. A card whose price is still loading simply has no valuation yet; the
 * caller counts it as awaiting rather than inventing a zero.
 */
export function toPullValuation(
  pull: PulledCard,
  state: QuoteState | undefined,
  rate: ExchangeRate | null,
  now: number = Date.now()
): PullValuation {
  const finish = finishOf(pull);
  const identity = {
    key: valuationKey(pull.id, finish),
    cardId: pull.id,
    name: pull.name,
    localId: pull.localId,
    setId: pull.setId,
    setName: pull.setName,
    finish,
    tier: pull.tier,
    retrievedAt: now,
  };

  if (state?.kind !== "quote") {
    return {
      ...identity,
      status: "unavailable",
      eur: null,
      gbp: null,
      basis: null,
      variant: null,
      printing: `${pullFinishLabel(finish)} printing`,
      source: null,
      reason: unavailableReason(finish, state),
      flags: [unavailableFlag(finish, state)],
    };
  }

  const { quote } = state;
  const gbpRaw = eurToGbp(quote.eur, rate);
  const gbp = gbpRaw == null ? null : roundPence(gbpRaw);

  if (gbp == null) {
    // The EUR value is real, but without a dated rate there is no honest GBP
    // figure, and every total in the app is GBP.
    return {
      ...identity,
      status: "unavailable",
      eur: quote.eur,
      gbp: null,
      basis: quote.basis,
      variant: quote.variant,
      printing: quote.printing,
      source: "cardmarket",
      priceUpdatedAt: quote.updatedAt,
      reason: "The EUR→GBP rate is unavailable, so this value cannot be shown in GBP.",
      flags: [...quote.flags, "fx-missing"],
    };
  }

  return {
    ...identity,
    status: "priced",
    eur: quote.eur,
    gbp,
    basis: quote.basis,
    variant: quote.variant,
    printing: quote.printing,
    source: "cardmarket",
    priceUpdatedAt: quote.updatedAt,
    fxDate: rate?.date,
    fxRate: rate?.rate,
    flags: quote.flags,
  };
}

/** Empty totals, used as the seed of every aggregation. */
export function emptyTotals(): PackValueTotals {
  return {
    cards: 0,
    priced: 0,
    unavailable: 0,
    pending: 0,
    totalGbp: 0,
    totalEur: 0,
    averageGbp: null,
    highest: null,
    lowest: null,
  };
}

/**
 * Sum a list of valuations.
 *
 * `expected` is the number of cards the caller knows exist. Anything beyond
 * the valuations provided is counted as pending, which is what lets the
 * running total say "6 of 8 priced, 2 awaiting" while prices stream in.
 */
export function summariseValues(
  values: (PullValuation | null | undefined)[],
  expected = values.length
): PackValueTotals {
  const totals = emptyTotals();
  totals.cards = Math.max(expected, values.length);

  for (const value of values) {
    if (!value) {
      totals.pending += 1;
      continue;
    }
    if (value.status !== "priced" || value.gbp == null) {
      totals.unavailable += 1;
      continue;
    }
    totals.priced += 1;
    totals.totalGbp = roundPence(totals.totalGbp + value.gbp);
    totals.totalEur = roundPence(totals.totalEur + (value.eur ?? 0));
    if (!totals.highest || value.gbp > totals.highest.gbp) {
      totals.highest = { cardId: value.cardId, name: value.name, gbp: value.gbp };
    }
    if (!totals.lowest || value.gbp < totals.lowest.gbp) {
      totals.lowest = { cardId: value.cardId, name: value.name, gbp: value.gbp };
    }
  }

  // A card counts as pending when the caller expected more cards than it has
  // valuations for; `cards` already reflects that.
  totals.pending = Math.max(totals.pending, totals.cards - values.filter(Boolean).length);

  if (totals.priced > 0) {
    totals.averageGbp = roundPence(totals.totalGbp / totals.priced);
  }
  return totals;
}

/** Combine several packs' totals into a session total. */
export function combineTotals(list: PackValueTotals[]): PackValueTotals {
  const combined = emptyTotals();
  for (const totals of list) {
    combined.cards += totals.cards;
    combined.priced += totals.priced;
    combined.unavailable += totals.unavailable;
    combined.pending += totals.pending;
    combined.totalGbp = roundPence(combined.totalGbp + totals.totalGbp);
    combined.totalEur = roundPence(combined.totalEur + totals.totalEur);
    if (totals.highest && (!combined.highest || totals.highest.gbp > combined.highest.gbp)) {
      combined.highest = totals.highest;
    }
    if (totals.lowest && (!combined.lowest || totals.lowest.gbp < combined.lowest.gbp)) {
      combined.lowest = totals.lowest;
    }
  }
  if (combined.priced > 0) combined.averageGbp = roundPence(combined.totalGbp / combined.priced);
  return combined;
}

/** Session-level figures that are not per-card arithmetic. */
export interface SessionValueSummary {
  totals: PackValueTotals;
  packs: number;
  /** Packs with at least one priced card — the honest denominator below. */
  packsWithValue: number;
  /** Packs where nothing could be priced. */
  packsWithoutValue: number;
  /** Known value averaged across packs that have one; null when none do. */
  averagePerPricedPack: number | null;
  /** The best single pull of the session, by known value. */
  best: { cardId: string; name: string; gbp: number; packIndex: number } | null;
  /** The most valuable pack of the session. */
  bestPack: { packIndex: number; totalGbp: number } | null;
  /** True when at least one pull is still awaiting a price. */
  pending: boolean;
}

/** Aggregate a whole opening session, including per-pack extremes. */
export function summariseSession(packTotals: PackValueTotals[]): SessionValueSummary {
  const totals = combineTotals(packTotals);
  let best: SessionValueSummary["best"] = null;
  let bestPack: SessionValueSummary["bestPack"] = null;
  let packsWithValue = 0;

  packTotals.forEach((pack, index) => {
    if (pack.priced > 0) {
      packsWithValue += 1;
      if (!bestPack || pack.totalGbp > bestPack.totalGbp) {
        bestPack = { packIndex: index, totalGbp: pack.totalGbp };
      }
    }
  });

  // The session's best pull is the pack with the highest card, scanned in
  // order so ties resolve to the earliest pack.
  packTotals.forEach((pack, index) => {
    if (pack.highest && (!best || pack.highest.gbp > best.gbp)) {
      best = { ...pack.highest, packIndex: index };
    }
  });

  const packs = packTotals.length;
  return {
    totals,
    packs,
    packsWithValue,
    packsWithoutValue: packs - packsWithValue,
    averagePerPricedPack: packsWithValue > 0 ? roundPence(totals.totalGbp / packsWithValue) : null,
    best,
    bestPack,
    pending: totals.pending > 0,
  };
}

/**
 * Freeze a finished pack into its historical record. Call this exactly once
 * per pack, when the opening completes: the resulting object is never
 * recomputed, which is what makes the history honest.
 */
export function toOpeningPackRecord(
  result: PackResult,
  values: (PullValuation | null | undefined)[]
): OpeningPackRecord {
  const pulls = values.filter((value): value is PullValuation => Boolean(value));
  return {
    packId: result.id,
    openedAt: result.openedAt,
    seed: result.seed,
    bestTier: result.bestTier,
    pulls,
    totals: summariseValues(pulls, result.cards.length),
  };
}

/** Build the session record persisted to local storage. */
export function toOpeningSession(
  id: string,
  results: PackResult[],
  valueLists: (PullValuation | null | undefined)[][],
  meta: { setId: string; setName: string; seriesId: string },
  now: number = Date.now()
): OpeningSession {
  // `now` is the moment the prices were frozen; it is stored on each pack.
  const packs = results.map((result, index) => toOpeningPackRecord(result, valueLists[index] ?? []));
  const totals = combineTotals(packs.map((pack) => pack.totals));
  return {
    id,
    setId: meta.setId,
    setName: meta.setName,
    seriesId: meta.seriesId,
    startedAt: results[0]?.openedAt ?? now,
    completedAt: now,
    packs,
    totals,
    // A session where nothing priced is still a real opening, but it has no
    // recorded values — say so instead of implying a £0 total.
    valuesRecorded: totals.priced > 0,
  };
}

/** Rarity tiers that mark a pull worth highlighting by value. */
export const VALUE_HIGHLIGHT_TIERS: ReadonlySet<RarityTier> = new Set([
  "doubleRare",
  "ultraRare",
  "illustrationRare",
  "specialIllustrationRare",
  "hyperRare",
  "secretRare",
  "aceSpec",
  "shinyUltraRare",
]);
