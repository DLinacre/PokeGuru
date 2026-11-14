import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARD_BRIEF, CARD_DETAIL, SET_BRIEF } from "./fixtures";

type FetchCall = { url: string; init?: RequestInit };

const BASE = "https://api.tcgdex.net/v2/en";

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

async function loadAdapter() {
  vi.resetModules();
  return import("../src/services/tcgdex");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("TCGdex adapter", () => {
  it("builds exact-match filters, pagination and reads set context from the set index", async () => {
    const calls = installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url.startsWith(`${BASE}/cards?`)) return json([CARD_BRIEF]);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { searchCards } = await loadAdapter();
    const result = await searchCards({
      query: "furret",
      category: "Pokemon",
      rarity: "Uncommon",
      setId: "swsh3",
      sort: "newest",
      page: 2,
      pageSize: 24,
    });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].set.name).toBe("Darkness Ablaze");
    expect(result.cards[0].images.small).toBe("https://assets.tcgdex.net/en/swsh/swsh3/136/low.webp");
    expect(result.hasMore).toBe(false);

    const cardCall = calls.find((call) => call.url.includes("/cards?"));
    expect(cardCall).toBeDefined();
    const params = new URL(cardCall!.url).searchParams;
    expect(params.get("name")).toBe("furret");
    expect(params.get("rarity")).toBe("eq:Uncommon");
    expect(params.get("category")).toBe("eq:Pokemon");
    expect(params.get("set.id")).toBe("eq:swsh3");
    expect(params.get("pagination:page")).toBe("2");
    expect(params.get("pagination:itemsPerPage")).toBe("24");
    expect(params.get("sort:field")).toBe("releaseDate");
    expect(params.get("sort:order")).toBe("DESC");
  });

  it("marks hasMore when a full page is returned", async () => {
    const fullPage = Array.from({ length: 24 }, (_, index) => ({
      ...CARD_BRIEF,
      id: `swsh3-${index + 1}`,
      localId: String(index + 1),
    }));
    installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url.startsWith(`${BASE}/cards?`)) return json(fullPage);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { searchCards } = await loadAdapter();
    const result = await searchCards({
      query: "",
      category: "",
      rarity: "",
      setId: "",
      sort: "name",
      page: 1,
      pageSize: 24,
    });

    expect(result.cards).toHaveLength(24);
    expect(result.hasMore).toBe(true);
  });

  it("retries without a sort field when the API rejects the sort", async () => {
    const calls = installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url.includes("sort%3Afield=releaseDate")) {
        return new Response(JSON.stringify({ error: "bad sort" }), { status: 400 });
      }
      if (url.startsWith(`${BASE}/cards?`)) return json([CARD_BRIEF]);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { searchCards } = await loadAdapter();
    const result = await searchCards({
      query: "",
      category: "",
      rarity: "",
      setId: "",
      sort: "newest",
      page: 1,
      pageSize: 24,
    });

    expect(result.cards).toHaveLength(1);
    const cardCalls = calls.filter((call) => call.url.includes("/cards?"));
    expect(cardCalls.length).toBe(2);
    expect(new URL(cardCalls[1].url).searchParams.get("sort:field")).toBeNull();
  });

  it("maps full card details including Cardmarket and TCGplayer pricing", async () => {
    installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url === `${BASE}/cards/swsh3-136`) return json(CARD_DETAIL);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { getCard } = await loadAdapter();
    const { card, source } = await getCard("swsh3-136");

    expect(source).toBe("network");
    expect(card.name).toBe("Furret");
    expect(card.rarity).toBe("Uncommon");
    expect(card.illustrator).toBe("tetsuya koizumi");
    expect(card.images.large).toBe("https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp");
    expect(card.attacks?.[1]).toMatchObject({ name: "Tail Smash", damage: "90" });
    expect(card.legal).toEqual({ standard: false, expanded: true });
    expect(card.pricing?.cardmarket).toMatchObject({
      currency: "EUR",
      updatedAt: "2026-11-12T00:42:15.000Z",
      normal: { low: 0.02, trend: 0.08, avg: 0.08 },
      holo: { trend: 0.21 },
    });
    expect(card.pricing?.tcgplayer?.variants.normal.market).toBe(0.09);
    expect(card.pricing?.tcgplayer?.variants.reverse.market).toBe(0.23);
  });

  it("maps a holofoil-only card's primary price to the holofoil band", async () => {
    // Real payload shape for sv06.5-090 (Okidogi ex, Special Illustration Rare):
    // the un-suffixed Cardmarket fields carry the holofoil price and the
    // `-holo` fields are 0, so they must not be read as a standard price.
    const holoOnly = {
      ...CARD_DETAIL,
      id: "sv06.5-090",
      name: "Okidogi ex",
      localId: "090",
      variants: { firstEdition: false, holo: true, normal: false, reverse: false, wPromo: false },
      pricing: {
        cardmarket: {
          updated: "2026-11-13T22:16:19.354Z",
          unit: "EUR",
          avg: 18.16,
          low: 8,
          trend: 15.61,
          avg1: 18.33,
          avg7: 16.53,
          avg30: 17.55,
          "trend-holo": 0,
        },
        tcgplayer: {
          unit: "USD",
          updated: "2026-11-13T22:16:33.862Z",
          holofoil: { lowPrice: 17.95, midPrice: 21.37, marketPrice: 19.43 },
        },
      },
    };

    installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url === `${BASE}/cards/sv06.5-090`) return json(holoOnly);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { getCard } = await loadAdapter();
    const { card } = await getCard("sv06.5-090");
    expect(card.pricing?.cardmarket?.holo).toMatchObject({ trend: 15.61, low: 8, avg: 18.16 });
    expect(card.pricing?.cardmarket?.normal).toBeUndefined();
    expect(card.pricing?.tcgplayer?.variants.holofoil.market).toBe(19.43);

    const { getCardPrice } = await import("../src/services/pricing");
    const price = getCardPrice(card, {
      rate: 0.86,
      date: "2026-11-14",
      base: "EUR",
      quote: "GBP",
      fetchedAt: Date.now(),
      source: "network",
    });
    expect(price?.basis).toBe("trend");
    expect(price?.variant).toBe("holo");
    expect(price?.headlineGbp).toBeCloseTo(15.61 * 0.86, 4);
    expect(price?.confidence).toBe("verified");
  });

  it("surfaces 404s as a not-found API error", async () => {
    installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      return new Response(JSON.stringify({ error: "Endpoint or id not found" }), { status: 404 });
    });

    const { getCard } = await loadAdapter();
    const { ApiError } = await import("../src/services/http");
    await expect(getCard("does-not-exist")).rejects.toBeInstanceOf(ApiError);
    await expect(getCard("does-not-exist")).rejects.toMatchObject({ status: 404, kind: "not-found" });
  });

  it("serves a cached card without hitting the network twice", async () => {
    const calls = installFetch((url) => {
      if (url === `${BASE}/sets`) return json([SET_BRIEF]);
      if (url === `${BASE}/cards/swsh3-136`) return json(CARD_DETAIL);
      throw new Error(`Unexpected request: ${url}`);
    });

    const { getCard } = await loadAdapter();
    await getCard("swsh3-136");
    const second = await getCard("swsh3-136");

    expect(second.source).toBe("cache");
    expect(calls.filter((call) => call.url.endsWith("/cards/swsh3-136"))).toHaveLength(1);
  });
});
