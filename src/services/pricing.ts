/**
 * Pricing engine.
 *
 * PokeGuru does not invent money. Every figure below is a marketplace value
 * that TCGdex publishes for a *specific printing* of a *specific card*, and
 * every displayed price is traceable to:
 *
 *   source (Cardmarket / TCGplayer) → currency → variant → card id →
 *   marketplace update timestamp → FX rate + FX date
 *
 * Rules:
 *  - Cardmarket EUR is the primary source; GBP is only produced when a real,
 *    dated Frankfurter rate is available.
 *  - The printing matters. A holofoil listing is never used for a non-holo
 *    card, and vice versa, unless the card only exists in that printing.
 *  - Zero/negative placeholders are treated as missing data.
 *  - Values are marketplace *reference* prices (trend / average asking /
 *    lowest listing), never completed sales.
 *  - Anything missing is shown as "No Data Available", never estimated.
 */

import type { CardmarketBand, CardPricing, TcgCard } from "../types/pokemon";
import type { ExchangeRate } from "./currency";
import { eurToGbp } from "./currency";

export type PriceVariant = "holo" | "normal";

/** How much trust the UI should place in a headline figure. */
export type PriceConfidence = "verified" | "indicative" | "stale" | "unverified" | "unavailable";

export interface CardmarketQuote {
  currency: "EUR";
  variant: PriceVariant;
  label: string;
  /** Human description of the printing this band belongs to. */
  printing: string;
  low?: number;
  trend?: number;
  average?: number;
  average1?: number;
  average7?: number;
  average30?: number;
  updatedAt?: string;
}

export interface TcgplayerQuote {
  currency: "USD";
  variant: string;
  label: string;
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  updatedAt?: string;
}

export interface PriceBandRow {
  key: "trend" | "avg" | "low" | "avg1" | "avg7" | "avg30";
  label: string;
  hint: string;
  eur: number;
  gbp: number | null;
}

export interface CardPrice {
  cardId: string;
  /** Currency of the underlying marketplace data. */
  sourceCurrency: "EUR";
  /** Which band supplied the headline figure. */
  basis: "trend" | "avg" | "low" | "avg30" | null;
  headlineEur: number | null;
  headlineGbp: number | null;
  variant: PriceVariant;
  variantLabel: string;
  printing: string;
  confidence: PriceConfidence;
  confidenceLabel: string;
  /** Plain-English explanation of the confidence rating. */
  confidenceReason: string;
  flags: string[];
  updatedAt?: string;
  ageDays: number | null;
  bands: PriceBandRow[];
  /** Alternate printing band, when the marketplace publishes one. */
  alternate?: {
    variant: PriceVariant;
    label: string;
    trend?: number;
    average?: number;
    low?: number;
    gbp: number | null;
  };
  rate: ExchangeRate | null;
  tcgplayer: TcgplayerQuote | null;
}

const VARIANT_LABELS: Record<string, string> = {
  normal: "Normal",
  holo: "Holofoil",
  reverse: "Reverse holofoil",
  "reverse-holofoil": "Reverse holofoil",
  "1st-edition": "1st edition",
  "1st-edition-holofoil": "1st edition holofoil",
  unlimited: "Unlimited",
  "unlimited-holofoil": "Unlimited holofoil",
};

export function variantLabel(key: string): string {
  return VARIANT_LABELS[key] ?? key.replace(/-/g, " ");
}

const positive = (value?: number): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

function bandHasData(band?: CardmarketBand): boolean {
  return !!band && [positive(band.trend), positive(band.avg), positive(band.low)].some((v) => v !== undefined);
}

/**
 * Decide which Cardmarket band describes this card's own printing.
 *
 * TCGdex publishes the standard print as the un-suffixed band and the
 * holofoil print as `*-holo`. Cards that only exist as holofoil (most modern
 * "Holo Rare" cards) must use the holo band; cards with both printings use the
 * standard band, with the holo band shown as an alternate.
 */
export function resolveVariant(card: Pick<TcgCard, "variants" | "rarity">): PriceVariant {
  const variants = card.variants;
  if (variants) {
    if (variants.holo && !variants.normal) return "holo";
    if (variants.normal && !variants.holo) return "normal";
    if (variants.holo && variants.normal) return "normal";
  }
  // No printing flags: fall back to what the rarity implies.
  return /holo|rare|ultra|illustration|secret|shiny|promo/i.test(card.rarity ?? "") ? "holo" : "normal";
}

function printingDescription(variant: PriceVariant, card: TcgCard): string {
  if (variant === "holo") {
    return card.variants?.firstEdition ? "Holofoil (1st edition likely)" : "Holofoil printing";
  }
  if (card.variants?.reverse) return "Standard / reverse-holo printing";
  return "Standard printing";
}

function quoteFromBand(cm: NonNullable<CardPricing["cardmarket"]>, variant: PriceVariant, card: TcgCard): CardmarketQuote | null {
  const band = cm[variant];
  if (!bandHasData(band)) return null;
  return {
    currency: "EUR",
    variant,
    label: variant === "holo" ? "Holofoil" : "Standard",
    printing: printingDescription(variant, card),
    low: positive(band?.low),
    trend: positive(band?.trend),
    average: positive(band?.avg),
    average1: positive(band?.avg1),
    average7: positive(band?.avg7),
    average30: positive(band?.avg30),
    updatedAt: cm.updatedAt,
  };
}

/** Pick the Cardmarket band that matches the card's own printing. */
export function pickCardmarketQuote(
  pricing: CardPricing | undefined,
  card?: Pick<TcgCard, "variants" | "rarity">
): CardmarketQuote | null {
  const cm = pricing?.cardmarket;
  if (!cm) return null;

  const preferred = card ? resolveVariant(card) : "normal";
  // When we know which printings exist, never borrow the other printing's
  // price — a non-holo card must not be valued using the holofoil band.
  const strict = Boolean(card?.variants);
  const order: PriceVariant[] = strict
    ? [preferred]
    : preferred === "holo"
      ? ["holo", "normal"]
      : ["normal", "holo"];
  const stub = (card ?? { variants: undefined, rarity: undefined }) as TcgCard;

  for (const variant of order) {
    const quote = quoteFromBand(cm, variant, stub);
    if (quote) return quote;
  }
  return null;
}

/** Pick the most useful TCGplayer band (USD, shown unconverted). */
export function pickTcgplayerQuote(pricing: CardPricing | undefined): TcgplayerQuote | null {
  const tp = pricing?.tcgplayer;
  if (!tp?.variants) return null;

  const preferred = ["holo", "normal", "reverse", "1st-edition-holofoil", "1st-edition"];
  const keys = [...preferred.filter((k) => tp.variants[k]), ...Object.keys(tp.variants)];
  for (const key of keys) {
    const band = tp.variants[key];
    if (!band) continue;
    if ([band.market, band.mid, band.low, band.high].some((v) => positive(v) !== undefined)) {
      return {
        currency: "USD",
        variant: key,
        label: variantLabel(key),
        low: positive(band.low),
        mid: positive(band.mid),
        high: positive(band.high),
        market: positive(band.market),
        updatedAt: tp.updatedAt,
      };
    }
  }
  return null;
}

/** Age of a marketplace snapshot in whole days, or null when undated/invalid. */
export function priceAgeDays(updatedAt?: string | number): number | null {
  if (updatedAt == null) return null;
  const time =
    typeof updatedAt === "number"
      ? updatedAt < 1e12
        ? updatedAt * 1000
        : updatedAt
      : Date.parse(updatedAt);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function describeAge(ageDays: number | null): string {
  if (ageDays === null) return "the marketplace did not provide an update date";
  if (ageDays === 0) return "updated today";
  if (ageDays === 1) return "updated yesterday";
  return `updated ${ageDays} days ago`;
}

const BAND_ROWS: { key: PriceBandRow["key"]; label: string; hint: string; value: (q: CardmarketQuote) => number | undefined }[] = [
  { key: "trend", label: "Trend price", hint: "Cardmarket's published trend value", value: (q) => q.trend },
  { key: "avg", label: "Average asking price", hint: "Average of current listings", value: (q) => q.average },
  { key: "low", label: "Lowest listing", hint: "Cheapest active listing", value: (q) => q.low },
  { key: "avg1", label: "1-day average", hint: "Average over the last day", value: (q) => q.average1 },
  { key: "avg7", label: "7-day average", hint: "Average over the last week", value: (q) => q.average7 },
  { key: "avg30", label: "30-day average", hint: "Average over the last month", value: (q) => q.average30 },
];

/**
 * Build the complete, auditable price view for a card: headline value,
 * confidence, every published band and the alternate printing.
 */
export function getCardPrice(card: TcgCard, rate: ExchangeRate | null): CardPrice | null {
  const pricing = card.pricing;
  if (!pricing?.cardmarket && !pricing?.tcgplayer) return null;

  const quote = pickCardmarketQuote(pricing, card);
  const tcgplayer = pickTcgplayerQuote(pricing);

  if (!quote) {
    return {
      cardId: card.id,
      sourceCurrency: "EUR",
      basis: null,
      headlineEur: null,
      headlineGbp: null,
      variant: resolveVariant(card),
      variantLabel: resolveVariant(card) === "holo" ? "Holofoil" : "Standard",
      printing: printingDescription(resolveVariant(card), card),
      confidence: "unavailable",
      confidenceLabel: "No Data Available",
      confidenceReason: "Cardmarket does not publish a price for this printing.",
      flags: ["no-cardmarket-data"],
      ageDays: null,
      bands: [],
      rate,
      tcgplayer,
    };
  }

  // One headline rule for the whole app: trend → average → 30-day → lowest.
  const headlineBand = bandHeadline({
    trend: quote.trend,
    avg: quote.average,
    avg30: quote.average30,
    low: quote.low,
  });
  const headline = headlineBand?.value ?? null;
  const basis: CardPrice["basis"] = headlineBand?.basis ?? null;

  const ageDays = priceAgeDays(quote.updatedAt);
  const flags: string[] = [];
  let confidence: PriceConfidence = "verified";
  let confidenceReason = `Cardmarket ${describeAge(ageDays)}.`;

  if (headline != null && quote.trend == null && quote.average == null) {
    confidence = "unverified";
    confidenceReason =
      "Cardmarket only publishes a lowest-listing or long-run average for this card, so this is an indicative figure rather than a settled market value.";
    flags.push("low-only");
  } else if (ageDays == null) {
    confidence = "indicative";
    confidenceReason = "Cardmarket did not include an update date, so the freshness of this price cannot be confirmed.";
    flags.push("no-update-date");
  } else if (ageDays > 30) {
    confidence = "stale";
    confidenceReason = `This price was last updated ${ageDays} days ago, so treat it as historical rather than current.`;
    flags.push("stale");
  } else if (ageDays > 7) {
    confidence = "indicative";
    confidenceReason = `This price was last updated ${ageDays} days ago; marketplace values can move week to week.`;
    flags.push("dated");
  }

  if (!card.variants) {
    flags.push("variant-unconfirmed");
    if (confidence === "verified") {
      confidence = "indicative";
      confidenceReason +=
        " TCGdex does not list printing variants for this card, so the band used could not be confirmed against the card's own printing.";
    }
  }

  if (!rate) {
    flags.push("fx-missing");
    confidenceReason += " The EUR→GBP rate is unavailable, so GBP values are hidden.";
  }

  const headlineGbp = eurToGbp(headline, rate);

  const bands: PriceBandRow[] = BAND_ROWS.flatMap((row) => {
    const eur = positive(row.value(quote));
    if (eur === undefined) return [];
    return [{ key: row.key, label: row.label, hint: row.hint, eur, gbp: eurToGbp(eur, rate) }];
  });

  // Alternate printing, when the marketplace publishes both.
  const otherVariant: PriceVariant = quote.variant === "holo" ? "normal" : "holo";
  const otherBand = pricing.cardmarket?.[otherVariant];
  const alternate = bandHasData(otherBand)
    ? {
        variant: otherVariant,
        label: otherVariant === "holo" ? "Holofoil" : "Standard",
        trend: positive(otherBand?.trend),
        average: positive(otherBand?.avg),
        low: positive(otherBand?.low),
        gbp: eurToGbp(positive(otherBand?.trend) ?? positive(otherBand?.avg) ?? positive(otherBand?.low) ?? null, rate),
      }
    : undefined;

  const confidenceLabels: Record<PriceConfidence, string> = {
    verified: "Verified",
    indicative: "Indicative",
    stale: "Stale",
    unverified: "Price Unverified",
    unavailable: "No Data Available",
  };

  return {
    cardId: card.id,
    sourceCurrency: "EUR",
    basis,
    headlineEur: headline,
    headlineGbp,
    variant: quote.variant,
    variantLabel: quote.variant === "holo" ? "Holofoil" : "Standard",
    printing: quote.printing,
    confidence,
    confidenceLabel: confidenceLabels[confidence],
    confidenceReason,
    flags,
    updatedAt: quote.updatedAt,
    ageDays,
    bands,
    alternate,
    rate,
    tcgplayer,
  };
}

/* ------------------------------------------------------------------ */
/* Finish-aware quotes (pack openings)                                 */
/* ------------------------------------------------------------------ */

/**
 * The finish a card was physically pulled in. The pack engine records this;
 * it is *not* inferred from the price data (doing so would let a normal card
 * be valued as a reverse holo).
 */
export type PullFinish = "normal" | "reverse" | "holo";

export interface FinishQuote {
  /** Which Cardmarket band supplied the value. */
  variant: PriceVariant;
  /** Human description of the printing the value belongs to. */
  printing: string;
  /** EUR headline. */
  eur: number;
  basis: NonNullable<CardPrice["basis"]>;
  updatedAt?: string;
  /**
   * True when the marketplace publishes only one band for this card, so the
   * value is for the card's only recorded printing rather than a band that
   * provably matches the finish that was pulled.
   */
  assumedPrinting: boolean;
  /** Machine-readable caveats for the UI. */
  flags: string[];
}

const FINISH_LABELS: Record<PullFinish, string> = {
  normal: "Standard",
  reverse: "Reverse holofoil",
  holo: "Holofoil",
};

export function pullFinishLabel(finish: PullFinish): string {
  return FINISH_LABELS[finish];
}

/** Headline value of a Cardmarket band, preferring trend → average → 30d → low. */
export function bandHeadline(band?: CardmarketBand): { value: number; basis: NonNullable<CardPrice["basis"]> } | null {
  if (!band) return null;
  const trend = positive(band.trend);
  if (trend !== undefined) return { value: trend, basis: "trend" };
  const average = positive(band.avg);
  if (average !== undefined) return { value: average, basis: "avg" };
  const avg30 = positive(band.avg30);
  if (avg30 !== undefined) return { value: avg30, basis: "avg30" };
  const low = positive(band.low);
  if (low !== undefined) return { value: low, basis: "low" };
  return null;
}

/**
 * Price a card for the finish it was actually pulled in.
 *
 * The rule is deliberately strict, because a wrong finish is a wrong number:
 *
 *  - **Reverse holo** — TCGdex's Cardmarket payload only carries `normal` and
 *    `holo` bands, so there is no reverse-holofoil price to show. We return
 *    `null` instead of borrowing the standard price, which would overstate a
 *    reverse pull's value (or understate it) with someone else's number.
 *  - **Normal / holo** — only the band for that finish is used. The single
 *    documented exception is a card that exists in one printing only, where
 *    the sole published band *is* that printing's price; those are marked
 *    `assumedPrinting` so the UI can say so.
 *
 * Returns `null` when there is no defensible price for this finish.
 */
export function resolveFinishQuote(
  pricing: CardPricing | undefined,
  card: Pick<TcgCard, "variants" | "rarity"> | undefined,
  finish: PullFinish
): FinishQuote | null {
  const cm = pricing?.cardmarket;
  if (!cm) return null;
  // Cardmarket does not publish a reverse-holofoil band through TCGdex.
  if (finish === "reverse") return null;

  const normalBand = bandHasData(cm.normal) ? cm.normal : undefined;
  const holoBand = bandHasData(cm.holo) ? cm.holo : undefined;
  const wanted = finish === "holo" ? holoBand : normalBand;
  const other = finish === "holo" ? normalBand : holoBand;

  const build = (band: CardmarketBand | undefined, variant: PriceVariant, assumedPrinting: boolean): FinishQuote | null => {
    const headline = bandHeadline(band);
    if (!headline) return null;
    const flags: string[] = [];
    if (assumedPrinting) flags.push("finish-assumed");
    if (headline.basis === "low" || headline.basis === "avg30") flags.push("indicative-basis");
    if (!cm.updatedAt) flags.push("no-update-date");
    return {
      variant,
      printing: assumedPrinting
        ? `${pullFinishLabel(variant === "holo" ? "holo" : "normal")} printing — the only one TCGdex records for this card`
        : `${pullFinishLabel(finish)} printing`,
      eur: headline.value,
      basis: headline.basis,
      updatedAt: cm.updatedAt,
      assumedPrinting,
      flags,
    };
  };

  if (wanted) return build(wanted, finish, false);

  // The requested band is missing. Borrow the other band *only* when the
  // card's own printing data says this is the card's single printing.
  if (!other) return null;
  const variants = card?.variants;
  const onlyPrinting =
    (finish === "normal" && variants && !variants.normal && Boolean(variants.holo)) ||
    (finish === "holo" && variants && !variants.holo && Boolean(variants.normal)) ||
    (!variants && Boolean(card));
  if (!onlyPrinting) return null;
  return build(other, finish === "holo" ? "normal" : "holo", true);
}

/** Best GBP reference value for a card, or null when there is no real data. */
export function getCardValueGbp(card: TcgCard, rate: ExchangeRate | null): number | null {
  return getCardPrice(card, rate)?.headlineGbp ?? null;
}

/** The EUR amount used for the headline value (matching getCardValueGbp). */
export function getHeadlineEur(card: TcgCard): number | null {
  return getCardPrice(card, null)?.headlineEur ?? null;
}

export function formatGbp(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEur(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatUsd(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format an ISO timestamp (or epoch ms/seconds) as a short en-GB date. */
export function formatUpdatedAt(value: string | number | undefined): string | null {
  if (value == null) return null;
  const date = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Marketplace timestamps and ECB rate dates are UTC; format them in UTC so
  // a date is never shown a day early for users west of Greenwich.
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatUpdatedAtLong(value: string | number | undefined): string | null {
  if (value == null) return null;
  const date = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
