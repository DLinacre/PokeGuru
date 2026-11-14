import { describe, expect, it } from "vitest";
import {
  formatGbp,
  formatUpdatedAt,
  getCardPrice,
  getCardValueGbp,
  getHeadlineEur,
  pickCardmarketQuote,
  pickTcgplayerQuote,
  priceAgeDays,
  resolveVariant,
  variantLabel,
} from "../src/services/pricing";
import type { CardPricing, TcgCard } from "../src/types/pokemon";
import type { ExchangeRate } from "../src/services/currency";

const RATE: ExchangeRate = {
  rate: 0.83558,
  date: "2026-11-14",
  base: "EUR",
  quote: "GBP",
  fetchedAt: Date.now(),
  source: "network",
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const makeCard = (overrides: Partial<TcgCard> = {}, pricing?: CardPricing): TcgCard => ({
  id: "swsh3-136",
  name: "Furret",
  localId: "136",
  category: "Pokemon",
  images: {},
  set: { id: "swsh3", name: "Darkness Ablaze" },
  isDetailed: true,
  variants: { normal: true },
  rarity: "Common",
  pricing,
  ...overrides,
});

const cardmarket = (bands: CardPricing["cardmarket"], updatedAt = daysAgo(1)): CardPricing => ({
  cardmarket: {
    currency: "EUR",
    updatedAt,
    normal: { low: 1, trend: 2, avg: 1.5, avg30: 1.25 },
    ...bands,
  },
});

describe("pricing: printing identity", () => {
  it("prices a normal card from the standard band, never the holo band", () => {
    const pricing = cardmarket({ holo: { low: 30, trend: 40 } });
    const quote = pickCardmarketQuote(pricing, makeCard());
    expect(quote).toMatchObject({ variant: "normal", trend: 2 });
    expect(getCardValueGbp(makeCard({}, pricing), RATE)).toBeCloseTo(2 * RATE.rate, 4);
  });

  it("prices a holo-only card from the holo band", () => {
    const card = makeCard({ variants: { holo: true }, rarity: "Rare Holo" });
    const pricing = cardmarket({ holo: { low: 30, trend: 40 } });
    expect(pickCardmarketQuote(pricing, card)).toMatchObject({ variant: "holo", trend: 40 });
    expect(resolveVariant(card)).toBe("holo");
  });

  it("does not borrow another printing's price when the card's own band is empty", () => {
    const card = makeCard({ variants: { normal: true } });
    const pricing: CardPricing = {
      cardmarket: { currency: "EUR", updatedAt: daysAgo(1), holo: { trend: 40 } },
    };
    const cardWithPricing = makeCard({ variants: { normal: true } }, pricing);
    expect(pickCardmarketQuote(pricing, card)).toBeNull();
    expect(getCardPrice(cardWithPricing, RATE)?.confidence).toBe("unavailable");
    expect(getCardValueGbp(cardWithPricing, RATE)).toBeNull();
  });

  it("falls back between bands only when printing flags are unknown, and flags the result", () => {
    const pricing: CardPricing = {
      cardmarket: { currency: "EUR", updatedAt: daysAgo(1), holo: { trend: 40 } },
    };
    const card = makeCard({ variants: undefined, rarity: "Rare Holo" }, pricing);
    expect(pickCardmarketQuote(pricing, card)).toMatchObject({ variant: "holo", trend: 40 });
    const price = getCardPrice(card, RATE);
    expect(price?.flags).toContain("variant-unconfirmed");
    expect(price?.confidence).not.toBe("verified");
  });

  it("infers the printing from rarity when TCGdex has no variant flags", () => {
    expect(resolveVariant({ rarity: "Rare Holo" } as TcgCard)).toBe("holo");
    expect(resolveVariant({ rarity: "Common" } as TcgCard)).toBe("normal");
    expect(resolveVariant({ variants: { normal: true, holo: true } } as TcgCard)).toBe("normal");
  });

  it("treats zero and negative placeholder bands as missing data", () => {
    const pricing: CardPricing = {
      cardmarket: { currency: "EUR", updatedAt: daysAgo(1), normal: { low: 0, trend: 0, avg: -1 } },
    };
    expect(pickCardmarketQuote(pricing, makeCard())).toBeNull();
    expect(getCardValueGbp(makeCard({}, pricing), RATE)).toBeNull();
  });

  it("returns null when no marketplace data exists, never a fabricated value", () => {
    const card = makeCard({}, undefined);
    expect(getCardPrice(card, RATE)).toBeNull();
    expect(getCardValueGbp(card, RATE)).toBeNull();
    expect(pickTcgplayerQuote(undefined)).toBeNull();
  });
});

describe("pricing: confidence metadata", () => {
  it("marks a fresh trend price as verified", () => {
    const price = getCardPrice(makeCard({}, cardmarket({}, daysAgo(1))), RATE);
    expect(price).toMatchObject({ confidence: "verified", basis: "trend", confidenceLabel: "Verified" });
    expect(price?.flags).not.toContain("stale");
  });

  it("marks a snapshot older than a week as indicative and older than a month as stale", () => {
    const dated = getCardPrice(makeCard({}, cardmarket({}, daysAgo(10))), RATE);
    expect(dated?.confidence).toBe("indicative");
    expect(dated?.flags).toContain("dated");

    const stale = getCardPrice(makeCard({}, cardmarket({}, daysAgo(45))), RATE);
    expect(stale?.confidence).toBe("stale");
    expect(stale?.flags).toContain("stale");
    expect(stale?.ageDays).toBeGreaterThan(30);
  });

  it("marks an undated snapshot as indicative and records the missing date", () => {
    const pricing: CardPricing = { cardmarket: { currency: "EUR", normal: { trend: 3 } } };
    const price = getCardPrice(makeCard({}, pricing), RATE);
    expect(price?.confidence).toBe("indicative");
    expect(price?.flags).toContain("no-update-date");
    expect(price?.ageDays).toBeNull();
  });

  it("marks a lowest-listing / long-run-average-only price as unverified", () => {
    const pricing: CardPricing = {
      cardmarket: { currency: "EUR", updatedAt: daysAgo(1), normal: { low: 4, avg30: 9 } },
    };
    const price = getCardPrice(makeCard({}, pricing), RATE);
    expect(price?.confidence).toBe("unverified");
    expect(price?.confidenceLabel).toBe("Price Unverified");
    expect(price?.basis).toBe("avg30");
  });

  it("hides GBP values and flags the reason when no exchange rate is available", () => {
    const price = getCardPrice(makeCard({}, cardmarket()), null);
    expect(price?.headlineGbp).toBeNull();
    expect(price?.headlineEur).toBe(2);
    expect(price?.flags).toContain("fx-missing");
    expect(price?.confidenceReason).toMatch(/rate is unavailable/i);
  });

  it("exposes every published band with both currencies", () => {
    const price = getCardPrice(makeCard({}, cardmarket()), RATE);
    expect(price?.bands.map((band) => band.key)).toEqual(["trend", "avg", "low", "avg30"]);
    expect(price?.bands[0]).toMatchObject({ eur: 2, gbp: 2 * RATE.rate });
  });

  it("reports the alternate printing separately instead of merging it", () => {
    const pricing = cardmarket({ holo: { trend: 40, low: 30 } });
    const price = getCardPrice(makeCard({ variants: { normal: true, holo: true } }, pricing), RATE);
    expect(price?.printing).toMatch(/standard/i);
    expect(price?.alternate).toMatchObject({ variant: "holo", trend: 40 });
    expect(price?.alternate?.gbp).toBeCloseTo(40 * RATE.rate, 4);
    expect(price?.headlineEur).toBe(2);
  });

  it("returns an explicit unavailable view when only TCGplayer data exists", () => {
    const pricing: CardPricing = {
      tcgplayer: {
        currency: "USD",
        updatedAt: daysAgo(30),
        variants: { normal: { low: 0.02, mid: 0.17, market: 0.09 } },
      },
    };
    const price = getCardPrice(makeCard({}, pricing), RATE);
    expect(price).toMatchObject({ confidence: "unavailable", headlineGbp: null });
    expect(price?.tcgplayer).toMatchObject({ market: 0.09, label: "Normal", currency: "USD" });
  });
});

describe("pricing: TCGplayer", () => {
  it("maps variants into a USD quote in a stable order", () => {
    const pricing: CardPricing = {
      tcgplayer: {
        currency: "USD",
        updatedAt: daysAgo(2),
        variants: {
          normal: { market: 0.09 },
          reverse: { market: 0.23 },
          holo: { market: 1.4 },
        },
      },
    };
    expect(pickTcgplayerQuote(pricing)).toMatchObject({ variant: "holo", market: 1.4, label: "Holofoil" });
  });

  it("returns null when TCGplayer only has empty bands", () => {
    const pricing: CardPricing = { tcgplayer: { currency: "USD", variants: { normal: {} } } };
    expect(pickTcgplayerQuote(pricing)).toBeNull();
  });
});

describe("pricing: helpers", () => {
  it("computes the snapshot age in whole days and rejects invalid dates", () => {
    expect(priceAgeDays(daysAgo(3))).toBe(3);
    expect(priceAgeDays(undefined)).toBeNull();
    expect(priceAgeDays("not-a-date")).toBeNull();
    expect(priceAgeDays(Date.now() - 5 * 86_400_000)).toBe(5);
  });

  it("keeps getHeadlineEur aligned with the GBP conversion", () => {
    const card = makeCard({}, cardmarket());
    expect(getHeadlineEur(card)).toBe(2);
    expect(getCardValueGbp(card, RATE)).toBeCloseTo(2 * RATE.rate, 4);
  });

  it("formats GBP values, missing values and labels", () => {
    expect(formatGbp(12.5)).toBe("£12.50");
    expect(formatGbp(null)).toBeNull();
    expect(formatGbp(Number.NaN)).toBeNull();
    expect(variantLabel("reverse-holofoil")).toBe("Reverse holofoil");
    expect(variantLabel("1st-edition-holofoil")).toBe("1st edition holofoil");
  });

  it("formats marketplace timestamps and rejects invalid values", () => {
    expect(formatUpdatedAt("2026-11-12T00:42:15.000Z")).toContain("2026");
    expect(formatUpdatedAt(undefined)).toBeNull();
    expect(formatUpdatedAt("not-a-date")).toBeNull();
  });
});
