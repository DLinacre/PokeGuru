/**
 * Pricing normalisation.
 *
 * Primary source: Cardmarket (EUR) via TCGdex, converted to GBP with the
 * live/cached Frankfurter EUR->GBP rate. Secondary: TCGplayer (USD), shown
 * in USD only — we do not fabricate a cross-rate we have not fetched.
 *
 * These are marketplace *reference* prices (asking/trend/average), not
 * completed sales or live quotes. The UI labels them accordingly.
 */

import type { CardPricing, TcgCard } from "../types/pokemon";
import type { ExchangeRate } from "./currency";
import { eurToGbp } from "./currency";

export type PriceVariant = "holo" | "normal";

export interface CardmarketQuote {
  currency: "EUR";
  variant: PriceVariant;
  label: string;
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

/** Pick the most useful Cardmarket band for a card. */
export function pickCardmarketQuote(pricing: CardPricing | undefined): CardmarketQuote | null {
  const cm = pricing?.cardmarket;
  if (!cm) return null;

  const hasData = (band?: { low?: number; trend?: number; avg?: number }) =>
    !!band && [band.low, band.trend, band.avg].some((v) => typeof v === "number" && Number.isFinite(v));

  const candidates: PriceVariant[] = ["holo", "normal"];
  const variant = candidates.find((key) => hasData(cm[key]));
  if (!variant) return null;

  const band = cm[variant]!;
  return {
    currency: "EUR",
    variant,
    label: variant === "holo" ? "Holofoil" : "Normal",
    low: band.low,
    trend: band.trend,
    average: band.avg,
    average1: band.avg1,
    average7: band.avg7,
    average30: band.avg30,
    updatedAt: cm.updatedAt,
  };
}

/** Pick the most useful TCGplayer band. */
export function pickTcgplayerQuote(pricing: CardPricing | undefined): TcgplayerQuote | null {
  const tp = pricing?.tcgplayer;
  if (!tp?.variants) return null;

  const preferred = ["holo", "normal", "reverse", "1st-edition-holofoil", "1st-edition"];
  const keys = [...preferred.filter((k) => tp.variants[k]), ...Object.keys(tp.variants)];
  for (const key of keys) {
    const band = tp.variants[key];
    if (!band) continue;
    if ([band.market, band.mid, band.low, band.high].some((v) => typeof v === "number" && Number.isFinite(v))) {
      return {
        currency: "USD",
        variant: key,
        label: variantLabel(key),
        low: band.low,
        mid: band.mid,
        high: band.high,
        market: band.market,
        updatedAt: tp.updatedAt,
      };
    }
  }
  return null;
}

/** Best GBP reference value for a card, or null when there is no real data. */
export function getCardValueGbp(card: TcgCard, rate: ExchangeRate | null): number | null {
  const quote = pickCardmarketQuote(card.pricing);
  if (!quote) return null;
  const eur = quote.trend ?? quote.average ?? quote.low ?? null;
  return eurToGbp(eur, rate);
}

/** The EUR amount used for the headline value (matching getCardValueGbp). */
export function getHeadlineEur(quote: CardmarketQuote): number | null {
  return quote.trend ?? quote.average ?? quote.low ?? null;
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
  let date: Date;
  if (typeof value === "number") {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatUpdatedAtLong(value: string | number | undefined): string | null {
  if (value == null) return null;
  const date = typeof value === "number" ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
