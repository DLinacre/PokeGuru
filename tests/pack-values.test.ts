import { describe, expect, it } from "vitest";
import type { CardPricing, TcgCard } from "../src/types/pokemon";
import type { ExchangeRate } from "../src/services/currency";
import type { PackResult, PulledCard, RarityTier } from "../src/types/packs";
import {
  combineTotals,
  finishOf,
  quoteForPull,
  roundPence,
  summariseSession,
  summariseValues,
  toOpeningPackRecord,
  toOpeningSession,
  toPullValuation,
  valuationKey,
} from "../src/services/packValues";
import { resolveFinishQuote } from "../src/services/pricing";

/**
 * These fixtures exist only inside this file. The application never ships a
 * price or a card of its own making.
 */
const RATE: ExchangeRate = {
  rate: 0.83558,
  date: "2026-11-14",
  base: "EUR",
  quote: "GBP",
  fetchedAt: Date.now(),
  source: "network",
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function card(overrides: Partial<TcgCard> = {}): TcgCard {
  return {
    id: "sv06.5-1",
    name: "Test One",
    localId: "1",
    category: "Pokemon",
    images: {},
    set: { id: "sv06.5", name: "Shrouded Fable" },
    variants: { normal: true, reverse: true, holo: false },
    rarity: "Common",
    isDetailed: true,
    ...overrides,
  } as TcgCard;
}

function pull(overrides: Partial<PulledCard> = {}): PulledCard {
  return {
    id: "sv06.5-1",
    name: "Test One",
    localId: "1",
    setId: "sv06.5",
    setName: "Shrouded Fable",
    rarity: "Common",
    tier: "common" as RarityTier,
    treatment: "normal",
    slot: "common",
    ...overrides,
  };
}

const cardmarket = (bands: Partial<CardPricing["cardmarket"]>): CardPricing => ({
  cardmarket: {
    currency: "EUR",
    updatedAt: daysAgo(1),
    ...bands,
  },
});

/** Value one card through the public path the UI uses. */
function value(cardData: TcgCard | undefined, p: PulledCard, rate: ExchangeRate | null = RATE) {
  const finish = finishOf(p);
  const state = quoteForPull(cardData, finish);
  return { state, value: toPullValuation(p, state, rate) };
}

describe("pack values — one card", () => {
  it("values a Cardmarket trend price in GBP", () => {
    const { value: priced } = value(
      card({ pricing: cardmarket({ normal: { trend: 10, avg: 9, low: 8 } }) }),
      pull()
    );

    expect(priced.status).toBe("priced");
    expect(priced.eur).toBe(10);
    expect(priced.gbp).toBe(8.36); // 10 × 0.83558 = 8.3558
    expect(priced.basis).toBe("trend");
    expect(priced.variant).toBe("normal");
    expect(priced.source).toBe("cardmarket");
    expect(priced.fxDate).toBe(RATE.date);
    expect(priced.fxRate).toBe(RATE.rate);
    expect(priced.priceUpdatedAt).toBeTruthy();
    expect(priced.retrievedAt).toBeGreaterThan(0);
  });

  it("reports a card with no pricing data as unavailable, not £0", () => {
    const { value: unpriced } = value(card(), pull());

    expect(unpriced.status).toBe("unavailable");
    expect(unpriced.gbp).toBeNull();
    expect(unpriced.eur).toBeNull();
    expect(unpriced.reason).toMatch(/does not publish a price/i);
    expect(unpriced.flags).toContain("no-price");
  });

  it("treats an invalid or zero source price as missing", () => {
    const zero = value(card({ pricing: cardmarket({ normal: { trend: 0, avg: 0, low: 0 } }) }), pull());
    expect(zero.state.kind).toBe("none");
    expect(zero.value.status).toBe("unavailable");

    const broken = value(card({ pricing: cardmarket({ normal: { trend: Number.NaN } }) }), pull());
    expect(broken.value.status).toBe("unavailable");
    expect(broken.value.gbp).toBeNull();
  });

  it("converts EUR to GBP at the published rate and rounds to whole pence", () => {
    const { value: priced } = value(
      card({ pricing: cardmarket({ normal: { trend: 1 } }) }),
      pull()
    );
    expect(priced.gbp).toBe(roundPence(1 * RATE.rate));
    expect(priced.gbp).toBe(0.84);
    expect(roundPence(8.3558)).toBe(8.36);
    expect(roundPence(8.354)).toBe(8.35);
  });

  it("hides the GBP figure when the FX rate is unavailable", () => {
    const { value: noFx } = value(
      card({ pricing: cardmarket({ normal: { trend: 10 } }) }),
      pull(),
      null
    );
    expect(noFx.status).toBe("unavailable");
    expect(noFx.eur).toBe(10);
    expect(noFx.gbp).toBeNull();
    expect(noFx.flags).toContain("fx-missing");
  });

  it("uses the holofoil band for a holofoil pull", () => {
    const { value: holo } = value(
      card({
        variants: { holo: true, normal: false },
        rarity: "Rare Holo",
        pricing: cardmarket({ holo: { trend: 30 } }),
      }),
      pull({ rarity: "Rare Holo", tier: "holoRare", treatment: "holo" })
    );
    expect(holo.status).toBe("priced");
    expect(holo.variant).toBe("holo");
    expect(holo.printing).toMatch(/holofoil/i);
    expect(holo.eur).toBe(30);
  });

  it("never borrows a standard price for a reverse holo", () => {
    const cardData = card({
      variants: { normal: true, reverse: true },
      pricing: cardmarket({ normal: { trend: 12 } }),
    });
    const { value: reverse } = value(cardData, pull({ treatment: "reverse" }));

    expect(reverse.status).toBe("unavailable");
    expect(reverse.gbp).toBeNull();
    expect(reverse.flags).toContain("no-reverse-band");
    expect(reverse.reason).toMatch(/reverse-holofoil/i);

    // The same card in a normal finish *does* have a value, which proves the
    // two finishes are not sharing one price.
    const { value: normal } = value(cardData, pull());
    expect(normal.status).toBe("priced");
  });

  it("borrows the only published printing, and says so", () => {
    // A card that exists only as a holofoil: TCGdex files the price in `holo`.
    const onlyHolo = card({
      variants: { holo: true, normal: false },
      pricing: cardmarket({ holo: { trend: 5 } }),
    });
    const { value: normalPull } = value(onlyHolo, pull({ treatment: "normal" }));
    expect(normalPull.status).toBe("priced");
    expect(normalPull.flags).toContain("finish-assumed");
    expect(normalPull.printing).toMatch(/only one/i);
  });

  it("does not borrow the other band when the pulled finish really exists", () => {
    // Variants say the standard printing exists, so a missing normal band is a
    // genuine gap in the data — not a reason to use the holofoil price.
    const data = card({
      variants: { normal: true, holo: true },
      pricing: cardmarket({ holo: { trend: 40 } }),
    });
    const { value: normalPull } = value(data, pull({ treatment: "normal" }));
    expect(normalPull.status).toBe("unavailable");
    expect(normalPull.eur).toBeNull();
  });

  it("keys values by card id and finish", () => {
    expect(valuationKey("sv06.5-1", "normal")).toBe("sv06.5-1|normal");
    expect(valuationKey("sv06.5-1", "reverse")).not.toBe(valuationKey("sv06.5-1", "normal"));
    expect(finishOf(pull({ treatment: "reverse" }))).toBe("reverse");
  });

  it("surfaces a failed lookup as unavailable, with the failure named", () => {
    const failed = toPullValuation(pull(), { kind: "error", message: "Request failed" }, RATE);
    expect(failed.status).toBe("unavailable");
    expect(failed.flags).toContain("lookup-failed");
    expect(failed.reason).toMatch(/lookup failed/i);
  });
});

describe("pack values — aggregation", () => {
  const priced = (id: string, name: string, eur: number) =>
    toPullValuation(pull({ id, name }), { kind: "quote", quote: {
      variant: "normal",
      printing: "Standard printing",
      eur,
      basis: "trend",
      updatedAt: daysAgo(1),
      assumedPrinting: false,
      flags: [],
    } }, RATE);

  it("sums several different cards exactly as displayed", () => {
    const values = [priced("a", "A", 10), priced("b", "B", 2.5), priced("c", "C", 0.4)];
    const totals = summariseValues(values);

    expect(totals.cards).toBe(3);
    expect(totals.priced).toBe(3);
    expect(totals.unavailable).toBe(0);
    expect(totals.pending).toBe(0);
    expect(totals.totalGbp).toBe(
      roundPence(values.reduce((sum, item) => sum + (item.gbp ?? 0), 0))
    );
    expect(totals.highest?.cardId).toBe("a");
    expect(totals.lowest?.cardId).toBe("c");
    expect(totals.averageGbp).toBe(roundPence(totals.totalGbp / 3));
  });

  it("counts duplicate copies of the same card separately", () => {
    const one = priced("a", "A", 10);
    const totals = summariseValues([one, one, one]);
    expect(totals.priced).toBe(3);
    expect(totals.totalGbp).toBe(roundPence(one.gbp! * 3));
  });

  it("keeps unavailable cards out of the total, the average and the extremes", () => {
    const missing = toPullValuation(pull({ id: "x", name: "X" }), { kind: "none" }, RATE);
    const totals = summariseValues([priced("a", "A", 10), missing, priced("b", "B", 2)]);

    expect(totals.cards).toBe(3);
    expect(totals.priced).toBe(2);
    expect(totals.unavailable).toBe(1);
    expect(totals.totalGbp).toBe(roundPence(priced("a", "A", 10).gbp! + priced("b", "B", 2).gbp!));
    expect(totals.averageGbp).toBe(roundPence(totals.totalGbp / 2));
    expect(totals.lowest?.cardId).toBe("b");
  });

  it("reports a pack with nothing priced without inventing a total", () => {
    const totals = summariseValues([
      toPullValuation(pull({ id: "x" }), { kind: "none" }, RATE),
      toPullValuation(pull({ id: "y" }), { kind: "none" }, RATE),
    ]);
    expect(totals.priced).toBe(0);
    expect(totals.totalGbp).toBe(0);
    expect(totals.averageGbp).toBeNull();
    expect(totals.highest).toBeNull();
    expect(totals.lowest).toBeNull();
  });

  it("counts cards whose price has not arrived as pending", () => {
    const totals = summariseValues([priced("a", "A", 10), null, null], 3);
    expect(totals.priced).toBe(1);
    expect(totals.pending).toBe(2);
    expect(totals.totalGbp).toBe(priced("a", "A", 10).gbp);
  });

  it("combines packs and averages across packs that actually had a value", () => {
    const packOne = summariseValues([priced("a", "A", 10), priced("b", "B", 4)]);
    const packTwo = summariseValues([
      toPullValuation(pull({ id: "x" }), { kind: "none" }, RATE),
      toPullValuation(pull({ id: "y" }), { kind: "none" }, RATE),
    ]);

    const session = summariseSession([packOne, packTwo]);
    expect(session.packs).toBe(2);
    expect(session.totals.cards).toBe(4);
    expect(session.totals.priced).toBe(2);
    expect(session.totals.unavailable).toBe(2);
    expect(session.packsWithValue).toBe(1);
    expect(session.packsWithoutValue).toBe(1);
    // Averaged over packs with a known value, not over all packs.
    expect(session.averagePerPricedPack).toBe(packOne.totalGbp);
    expect(session.best?.cardId).toBe("a");
    expect(session.bestPack).toEqual({ packIndex: 0, totalGbp: packOne.totalGbp });

    const combined = combineTotals([packOne, packTwo]);
    expect(combined.totalGbp).toBe(packOne.totalGbp);
    expect(combined.cards).toBe(4);
  });
});

describe("pack values — historical snapshots", () => {
  function result(id: string, cards: PulledCard[]): PackResult {
    return {
      id,
      setId: "sv06.5",
      setName: "Shrouded Fable",
      seriesId: "sv",
      configId: "sv",
      openedAt: 1_700_000_000_000,
      seed: "seed",
      cards,
      bestTier: "common",
    };
  }

  it("freezes amounts, source and FX so later market moves cannot rewrite them", () => {
    const cardData = card({ pricing: cardmarket({ normal: { trend: 10 } }) });
    const pulled = pull();
    const { value: snapshot } = value(cardData, pulled);
    const pack = result("p1", [pulled]);

    const record = toOpeningPackRecord(pack, [snapshot]);
    expect(record.totals.totalGbp).toBe(8.36);
    expect(record.pulls[0].eur).toBe(10);
    expect(record.pulls[0].fxRate).toBe(RATE.rate);

    // "The market moves": the same card is worth 4× as much today.
    const later = value(card({ pricing: cardmarket({ normal: { trend: 40 } }) }), pulled).value;
    expect(later.gbp).toBeGreaterThan(snapshot.gbp!);

    // The recorded session is untouched by the new value.
    const session = toOpeningSession("s1", [pack], [[snapshot]], {
      setId: "sv06.5",
      setName: "Shrouded Fable",
      seriesId: "sv",
    });
    expect(session.packs[0].totals.totalGbp).toBe(8.36);
    expect(session.packs[0].pulls[0].gbp).toBe(8.36);
    expect(JSON.parse(JSON.stringify(session)).packs[0].pulls[0].gbp).toBe(8.36);
  });

  it("keeps the fact that a price was unavailable at the time", () => {
    const missing = toPullValuation(pull(), { kind: "none" }, RATE);
    const session = toOpeningSession(
      "s2",
      [result("p2", [pull()])],
      [[missing]],
      { setId: "sv06.5", setName: "Shrouded Fable", seriesId: "sv" }
    );
    expect(session.packs[0].pulls[0].status).toBe("unavailable");
    expect(session.packs[0].pulls[0].reason).toBeTruthy();
    expect(session.valuesRecorded).toBe(false);
    expect(session.totals.totalGbp).toBe(0);
    expect(session.totals.priced).toBe(0);
  });
});

describe("finish quote resolution", () => {
  it("requires an exact band match when both printings exist", () => {
    const pricing = cardmarket({ normal: { trend: 2 }, holo: { trend: 12 } });
    expect(resolveFinishQuote(pricing, { variants: { normal: true, holo: true }, rarity: "Rare" }, "normal")?.eur).toBe(2);
    expect(resolveFinishQuote(pricing, { variants: { normal: true, holo: true }, rarity: "Rare" }, "holo")?.eur).toBe(12);
    expect(resolveFinishQuote(pricing, { variants: { normal: true, holo: true }, rarity: "Rare" }, "reverse")).toBeNull();
  });

  it("falls back to an indicative basis only when that is all the market has", () => {
    const pricing = cardmarket({ normal: { low: 3 } });
    const quote = resolveFinishQuote(pricing, { variants: { normal: true }, rarity: "Common" }, "normal");
    expect(quote?.basis).toBe("low");
    expect(quote?.flags).toContain("indicative-basis");
  });
});
