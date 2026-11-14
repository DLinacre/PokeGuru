import { describe, expect, it } from "vitest";
import {
  formatGbp,
  formatUpdatedAt,
  getCardValueGbp,
  getHeadlineEur,
  pickCardmarketQuote,
  pickTcgplayerQuote,
} from "../src/services/pricing";
import type { TcgCard } from "../src/types/pokemon";
import { CARD_DETAIL } from "./fixtures";
import type { ExchangeRate } from "../src/services/currency";

const RATE: ExchangeRate = {
  rate: 0.8,
  date: "2026-11-14",
  base: "EUR",
  quote: "GBP",
  fetchedAt: Date.now(),
  source: "network",
};

const card = (): TcgCard => ({
  id: "swsh3-136",
  name: "Furret",
  localId: "136",
  category: "Pokemon",
  images: {},
  set: { id: "swsh3", name: "Darkness Ablaze" },
  isDetailed: true,
  pricing: {
    cardmarket: {
      currency: "EUR",
      updatedAt: "2026-11-12T00:42:15.000Z",
      normal: { low: 1, trend: 2, avg: 1.5, avg30: 1.25 },
      holo: { low: 3, trend: 4 },
    },
  },
});

describe("pricing", () => {
  it("prefers the holofoil band when it has data", () => {
    const quote = pickCardmarketQuote(card().pricing);
    expect(quote).toMatchObject({ variant: "holo", label: "Holofoil", trend: 4 });
  });

  it("falls back to the normal band", () => {
    const value = card();
    value.pricing = {
      cardmarket: { currency: "EUR", normal: { low: 1, trend: 2, avg: 1.5 } },
    };
    expect(pickCardmarketQuote(value.pricing)).toMatchObject({ variant: "normal", trend: 2 });
  });

  it("returns null when no marketplace data exists (never fabricates)", () => {
    const value = card();
    value.pricing = undefined;
    expect(pickCardmarketQuote(value.pricing)).toBeNull();
    expect(pickTcgplayerQuote(value.pricing)).toBeNull();
    expect(getCardValueGbp(value, RATE)).toBeNull();
  });

  it("converts the headline EUR value with the supplied rate", () => {
    const value = card();
    expect(getHeadlineEur(pickCardmarketQuote(value.pricing)!)).toBe(4);
    expect(getCardValueGbp(value, RATE)).toBeCloseTo(3.2);
    expect(getCardValueGbp(value, null)).toBeNull();
  });

  it("maps TCGplayer variants into a USD quote", () => {
    const value: TcgCard = {
      ...card(),
      pricing: {
        tcgplayer: {
          currency: "USD",
          updatedAt: "2026-11-12T20:07:54.000Z",
          variants: {
            normal: { low: 0.02, mid: 0.17, market: 0.09 },
            reverse: { market: 0.23 },
          },
        },
      },
    };
    expect(pickTcgplayerQuote(value.pricing)).toMatchObject({
      currency: "USD",
      variant: "normal",
      market: 0.09,
      label: "Normal",
    });
  });

  it("formats GBP with en-GB currency formatting and returns null for missing values", () => {
    expect(formatGbp(12.5)).toBe("£12.50");
    expect(formatGbp(null)).toBeNull();
    expect(formatGbp(Number.NaN)).toBeNull();
  });

  it("formats marketplace update timestamps and rejects invalid values", () => {
    expect(formatUpdatedAt("2026-11-12T00:42:15.000Z")).toContain("2026");
    expect(formatUpdatedAt(undefined)).toBeNull();
    expect(formatUpdatedAt("not-a-date")).toBeNull();
  });

  it("normalises a realistic TCGdex pricing payload", () => {
    const mapped = {
      id: "swsh3-136",
      name: "Furret",
      localId: "136",
      category: "Pokemon",
      images: {},
      set: { id: "swsh3", name: "Darkness Ablaze" },
      isDetailed: true,
      pricing: {
        cardmarket: {
          currency: "EUR" as const,
          updatedAt: CARD_DETAIL.pricing.cardmarket.updated,
          normal: { low: 0.02, trend: 0.08, avg: 0.08 },
          holo: { trend: 0.21 },
        },
      },
    } satisfies TcgCard;
    expect(pickCardmarketQuote(mapped.pricing)?.variant).toBe("holo");
    expect(formatGbp(getCardValueGbp(mapped, RATE))).toBe("£0.17");
  });
});
