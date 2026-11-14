/**
 * TCGdex API adapter (https://tcgdex.dev)
 *
 * Replaces the deprecated pokemontcg.io integration. Key behaviours:
 *  - free, key-less REST API (v2, English)
 *  - brief search results are enriched on demand with full card details
 *    (prices, rarity, illustrator) using a small concurrency limiter
 *  - every response is cached with a sensible TTL and de-duplicated
 *  - unsupported sorts degrade gracefully instead of returning wrong data
 */

import type {
  Attack,
  Ability,
  CardmarketBand,
  CardPricing,
  CardSearchResult,
  SearchFilters,
  SetRef,
  TcgCard,
  TcgSet,
  TcgplayerBand,
} from "../types/pokemon";
import { ApiError, fetchJson, raceAbort } from "./http";
import { readCache } from "./cache";

export const TCGDEX_BASE = "https://api.tcgdex.net/v2/en";
const LANG = "en";

const TTL = {
  search: 10 * 60 * 1000,
  card: 6 * 60 * 60 * 1000,
  sets: 24 * 60 * 60 * 1000,
  set: 12 * 60 * 60 * 1000,
} as const;

/** Shapes returned by TCGdex (only the fields we consume). */
interface RawCardBrief {
  id: string;
  localId?: string | number;
  name: string;
  image?: string | null;
}

interface RawSetBrief {
  id: string;
  name: string;
  logo?: string | null;
  symbol?: string | null;
  cardCount?: { total?: number; official?: number };
}

interface RawSet extends RawSetBrief {
  releaseDate?: string;
  serie?: { id?: string; name?: string };
  legal?: { standard?: boolean; expanded?: boolean };
  cards?: RawCardBrief[];
}

interface RawCard extends RawCardBrief {
  category?: string;
  illustrator?: string;
  rarity?: string;
  set?: RawSetBrief;
  variants?: Record<string, boolean>;
  hp?: number;
  types?: string[];
  stage?: string;
  evolveFrom?: string;
  description?: string;
  attacks?: { name: string; cost?: string[]; damage?: number | string; effect?: string }[];
  abilities?: { name: string; effect?: string; type?: string }[];
  weaknesses?: { type: string; value?: string }[];
  resistances?: { type: string; value?: string }[];
  retreat?: number;
  rules?: string[];
  effect?: string;
  legal?: { standard?: boolean; expanded?: boolean };
  regulationMark?: string;
  updated?: string;
  pricing?: {
    cardmarket?: Record<string, unknown>;
    tcgplayer?: Record<string, unknown>;
  };
}

/** Split a TCGdex card id ("swsh3-136") into its set id ("swsh3"). */
export function setOfCardId(cardId: string): string {
  const idx = cardId.lastIndexOf("-");
  return idx > 0 ? cardId.slice(0, idx) : cardId;
}

/** Build a sized asset URL from a TCGdex asset base ("…/136"). */
export function assetUrl(
  base: string | null | undefined,
  quality?: "low" | "high",
  ext: "webp" | "png" | "jpg" = "webp"
): string | undefined {
  if (!base) return undefined;
  if (/\.(webp|png|jpg|jpeg|svg)$/i.test(base)) return base;
  return quality ? `${base}/${quality}.${ext}` : `${base}.${ext}`;
}

function normaliseSetImages(raw: { logo?: string | null; symbol?: string | null } | undefined): {
  logo?: string;
  symbol?: string;
} {
  return {
    logo: assetUrl(raw?.logo, undefined),
    symbol: assetUrl(raw?.symbol, undefined),
  };
}

function normaliseCardmarket(raw: Record<string, unknown> | undefined): CardPricing["cardmarket"] {
  if (!raw) return undefined;
  // Cardmarket publishes 0 for cards with no active listings. That is not a
  // price, so treat anything non-positive as missing data.
  const num = (v: unknown): number | undefined => {
    const parsed =
      typeof v === "number"
        ? v
        : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
          ? Number(v)
          : undefined;
    return parsed !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const band = (suffix: string): CardmarketBand => ({
    low: num(raw[`low${suffix}`]),
    trend: num(raw[`trend${suffix}`]),
    avg: num(raw[`avg${suffix}`]),
    avg1: num(raw[`avg1${suffix}`]),
    avg7: num(raw[`avg7${suffix}`]),
    avg30: num(raw[`avg30${suffix}`]),
  });

  const normal = band("");
  const holo = band("-holo");
  const bandHasData = (b: CardmarketBand) => [b.low, b.trend, b.avg].some((v) => v !== undefined);

  if (!bandHasData(normal) && !bandHasData(holo)) return undefined;

  return {
    currency: "EUR",
    updatedAt: typeof raw.updated === "string" ? raw.updated : undefined,
    normal: bandHasData(normal) ? normal : undefined,
    holo: bandHasData(holo) ? holo : undefined,
  };
}

const TCGPLAYER_BAND_KEYS = ["lowPrice", "midPrice", "highPrice", "marketPrice", "directLowPrice"] as const;

function normaliseTcgplayer(raw: Record<string, unknown> | undefined): CardPricing["tcgplayer"] {
  if (!raw) return undefined;
  const variants: Record<string, TcgplayerBand> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "updated" || key === "unit") continue;
    if (!value || typeof value !== "object") continue;
    const band = value as Record<string, unknown>;
    if (!TCGPLAYER_BAND_KEYS.some((k) => typeof band[k] === "number")) continue;
    variants[key] = {
      low: band.lowPrice as number | undefined,
      mid: band.midPrice as number | undefined,
      high: band.highPrice as number | undefined,
      market: band.marketPrice as number | undefined,
      directLow: band.directLowPrice as number | undefined,
    };
  }
  if (!Object.keys(variants).length) return undefined;
  return {
    currency: "USD",
    updatedAt: typeof raw.updated === "string" ? raw.updated : undefined,
    variants,
  };
}

function normalisePricing(raw: RawCard["pricing"]): CardPricing | undefined {
  if (!raw) return undefined;
  const pricing: CardPricing = {
    cardmarket: normaliseCardmarket(raw.cardmarket),
    tcgplayer: normaliseTcgplayer(raw.tcgplayer),
  };
  return pricing.cardmarket || pricing.tcgplayer ? pricing : undefined;
}

function baseCardFields(raw: RawCardBrief | RawCard): TcgCard {
  return {
    id: raw.id,
    name: raw.name,
    localId: String(raw.localId ?? raw.id.split("-").pop() ?? ""),
    category: "Pokemon",
    images: {
      small: assetUrl(raw.image, "low"),
      large: assetUrl(raw.image, "high"),
    },
    imageBase: raw.image ?? undefined,
    set: { id: setOfCardId(raw.id), name: "" },
    isDetailed: false,
  };
}

function mapBrief(raw: RawCardBrief, setsById: Map<string, TcgSet>): TcgCard {
  const card = baseCardFields(raw);
  const set = setsById.get(card.set.id);
  if (set) {
    card.set = { id: set.id, name: set.name, series: set.series, releaseDate: set.releaseDate };
  }
  return card;
}

/** TCGdex reports "None" when a card has no rarity; do not render that as one. */
function normaliseRarity(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return undefined;
  return trimmed;
}

function mapDetail(raw: RawCard, setsById: Map<string, TcgSet>): TcgCard {
  const card = baseCardFields(raw);
  const set = raw.set ? { id: raw.set.id, name: raw.set.name } : setsById.get(card.set.id);
  if (set) {
    const known = setsById.get(set.id);
    card.set = {
      id: set.id,
      name: set.name,
      series: known?.series,
      releaseDate: known?.releaseDate,
    };
  }

  card.category = raw.category ?? "Pokemon";
  card.rarity = normaliseRarity(raw.rarity);
  card.illustrator = raw.illustrator;
  card.hp = raw.hp;
  card.types = raw.types;
  card.stage = raw.stage;
  card.evolveFrom = raw.evolveFrom;
  card.description = raw.description;
  card.variants = raw.variants
    ? {
        normal: Boolean(raw.variants.normal),
        reverse: Boolean(raw.variants.reverse),
        holo: Boolean(raw.variants.holo),
        firstEdition: Boolean(raw.variants.firstEdition),
        wPromo: Boolean(raw.variants.wPromo),
      }
    : undefined;

  if (raw.attacks?.length) {
    card.attacks = raw.attacks.map<Attack>((attack) => ({
      name: attack.name,
      cost: attack.cost,
      damage: attack.damage != null ? String(attack.damage) : undefined,
      effect: attack.effect,
    }));
  }
  if (raw.abilities?.length) {
    card.abilities = raw.abilities.map<Ability>((ability) => ({
      name: ability.name,
      effect: ability.effect,
      type: ability.type,
    }));
  }
  card.weaknesses = raw.weaknesses;
  card.resistances = raw.resistances;
  card.retreat = typeof raw.retreat === "number" ? raw.retreat : undefined;

  const rules = [...(raw.rules ?? [])];
  if (raw.effect && !rules.includes(raw.effect)) rules.unshift(raw.effect);
  if (rules.length) card.rules = rules;

  card.legal = raw.legal
    ? { standard: Boolean(raw.legal.standard), expanded: Boolean(raw.legal.expanded) }
    : undefined;
  card.regulationMark = raw.regulationMark;
  card.updatedAt = raw.updated;
  card.pricing = normalisePricing(raw.pricing);
  card.isDetailed = true;
  return card;
}

function mapSet(raw: RawSetBrief, extra?: RawSet): TcgSet {
  return {
    id: raw.id,
    name: raw.name,
    series: extra?.serie?.name ?? "",
    releaseDate: extra?.releaseDate,
    cardCount: {
      total: raw.cardCount?.total ?? extra?.cardCount?.total,
      official: raw.cardCount?.official ?? extra?.cardCount?.official,
    },
    legal: extra?.legal
      ? { standard: Boolean(extra.legal.standard), expanded: Boolean(extra.legal.expanded) }
      : undefined,
    images: normaliseSetImages(raw),
    cards: extra?.cards?.map((brief) => mapBrief(brief, new Map())),
  };
}

function cacheKey(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

/* ------------------------------------------------------------------ */
/* Sets                                                                */
/* ------------------------------------------------------------------ */

let setIndexPromise: Promise<Map<string, TcgSet>> | null = null;

/**
 * Fetch (and cache) the full set list and index it by id.
 * Used to label card briefs with their set name without extra requests.
 */
export async function getSetIndex(signal?: AbortSignal): Promise<Map<string, TcgSet>> {
  if (!setIndexPromise) {
    setIndexPromise = (async () => {
      const { data } = await fetchJson<RawSetBrief[]>(`${TCGDEX_BASE}/sets`, {
        ttlMs: TTL.sets,
        cacheKey: cacheKey("sets", LANG),
      });
      const list = Array.isArray(data) ? data : [];
      const map = new Map<string, TcgSet>();
      list.forEach((raw) => map.set(raw.id, mapSet(raw)));
      return map;
    })().catch((err) => {
      setIndexPromise = null;
      throw err;
    });
  }
  return signal ? raceAbort(setIndexPromise, signal) : setIndexPromise;
}

export async function getSets(
  signal?: AbortSignal
): Promise<{ sets: TcgSet[]; source: "network" | "cache"; cachedAt?: number }> {
  const index = await getSetIndex(signal);
  // Distinguish a genuinely network-backed index from a cached one.
  const cached = getSetCacheInfo();
  return { sets: [...index.values()], source: cached ? "cache" : "network", cachedAt: cached?.cachedAt };
}

/** Info about the cached set index, used to label cached data in the UI. */
export function getSetCacheInfo(): { cachedAt: number } | null {
  const hit = readCache<{ data: RawSetBrief[] }>(cacheKey("sets", LANG));
  return hit ? { cachedAt: hit.storedAt } : null;
}

export async function getSet(
  id: string,
  signal?: AbortSignal
): Promise<{ set: TcgSet; source: "network" | "cache"; cachedAt?: number }> {
  const { data, fromCache, cachedAt } = await raceAbort(
    fetchJson<RawSet>(`${TCGDEX_BASE}/sets/${encodeURIComponent(id)}`, {
      ttlMs: TTL.set,
      cacheKey: cacheKey("set", `${LANG}:${id}`),
    }),
    signal
  );
  const set = mapSet(data, data);
  // Fill set-name context for the briefs returned inside the set.
  if (set.cards) {
    set.cards = set.cards.map((card) => ({
      ...card,
      set: { id: set.id, name: set.name, series: set.series, releaseDate: set.releaseDate },
    }));
  }
  return { set, source: fromCache ? "cache" : "network", cachedAt };
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export interface SearchRequestOptions {
  signal?: AbortSignal;
}

function buildSearchUrl(filters: SearchFilters, includeSort: boolean): string {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query) params.set("name", query);
  if (filters.rarity) params.set("rarity", `eq:${filters.rarity}`);
  if (filters.category) params.set("category", `eq:${filters.category}`);
  if (filters.setId) params.set("set.id", `eq:${filters.setId}`);
  if (filters.number) params.set("localId", filters.number.trim().replace(/^#/, ""));
  if (filters.illustrator) params.set("illustrator", `like:${filters.illustrator}`);

  params.set("pagination:page", String(Math.max(1, filters.page)));
  params.set("pagination:itemsPerPage", String(filters.pageSize));

  if (includeSort) {
    if (filters.sort === "name") {
      params.set("sort:field", "name");
      params.set("sort:order", "ASC");
    } else if (filters.sort === "newest") {
      params.set("sort:field", "releaseDate");
      params.set("sort:order", "DESC");
    } else if (filters.sort === "oldest") {
      params.set("sort:field", "releaseDate");
      params.set("sort:order", "ASC");
    }
    // value_high / value_low are sorted client-side: the search endpoint
    // cannot order by price (briefs carry no pricing data).
  }

  return `${TCGDEX_BASE}/cards?${params.toString()}`;
}

/**
 * Search cards. Returns briefs enriched with set names from the cached set
 * index. Price/rarity details are loaded separately for the cards on screen.
 */
export async function searchCards(
  filters: SearchFilters,
  options: SearchRequestOptions = {}
): Promise<CardSearchResult & { source: "network" | "cache"; cachedAt?: number; stale?: boolean }> {
  const { signal } = options;

  const run = async (includeSort: boolean) => {
    const url = buildSearchUrl(filters, includeSort);
    return fetchJson<RawCardBrief[]>(url, {
      ttlMs: TTL.search,
      cacheKey: cacheKey("search", `${LANG}:${url.split("?")[1] ?? ""}`),
    });
  };

  let response;
  try {
    response = await raceAbort(run(true), signal);
  } catch (err) {
    // Graceful degradation: if the API rejects a sort field, retry unsorted.
    if (err instanceof ApiError && err.status >= 400 && err.status < 500 && filters.sort !== "name") {
      response = await raceAbort(run(false), signal);
    } else {
      throw err;
    }
  }

  const [{ data }, index] = await Promise.all([response, raceAbort(getSetIndex(signal), signal).catch(() => new Map<string, TcgSet>())]);

  const briefs = Array.isArray(data) ? data : [];
  const cards = briefs.map((brief) => mapBrief(brief, index));

  const totalHeader = response.headers["x-total-count"];
  const totalCount = totalHeader && Number.isFinite(Number(totalHeader)) ? Number(totalHeader) : undefined;

  return {
    cards,
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: briefs.length >= filters.pageSize,
    totalCount,
    source: response.fromCache ? "cache" : "network",
    cachedAt: response.cachedAt,
    stale: response.stale,
  };
}

export async function getCard(
  id: string,
  options: SearchRequestOptions = {}
): Promise<{ card: TcgCard; source: "network" | "cache"; cachedAt?: number }> {
  const [{ data, fromCache, cachedAt }, index] = await Promise.all([
    fetchJson<RawCard>(`${TCGDEX_BASE}/cards/${encodeURIComponent(id)}`, {
      ttlMs: TTL.card,
      cacheKey: cacheKey("card", `${LANG}:${id}`),
    }),
    raceAbort(getSetIndex(options.signal), options.signal).catch(() => new Map<string, TcgSet>()),
  ]);
  return { card: mapDetail(data, index), source: fromCache ? "cache" : "network", cachedAt };
}

/**
 * Load full details for a batch of ids (used to add prices/rarity to a page
 * of search results). Calls `onCard` as each card resolves so the grid can
 * progressively paint. Concurrency is capped to stay friendlier to the API.
 */
export async function loadCardDetails(
  ids: string[],
  handlers: {
    onCard?: (card: TcgCard) => void;
    onError?: (id: string, error: unknown) => void;
    signal?: AbortSignal;
    concurrency?: number;
  } = {}
): Promise<Map<string, TcgCard>> {
  const { onCard, onError, signal, concurrency = 5 } = handlers;
  const results = new Map<string, TcgCard>();
  const queue = [...new Set(ids)];
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (index < queue.length) {
      if (signal?.aborted) return;
      const id = queue[index++];
      try {
        const { card } = await getCard(id, { signal });
        if (signal?.aborted) return;
        results.set(id, card);
        onCard?.(card);
      } catch (err) {
        if (err instanceof ApiError && err.kind === "aborted") return;
        onError?.(id, err);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/** A random card: pick a random set, then a random card from that set. */
export async function getRandomCard(signal?: AbortSignal): Promise<TcgCard> {
  const { sets } = await getSets(signal);
  if (!sets.length) throw new ApiError("No sets available", 404, "not-found");

  // Prefer sets with a decent number of cards so we do not land on promos.
  const candidates = sets.filter((set) => (set.cardCount.total ?? 0) > 20);
  const pool = candidates.length ? candidates : sets;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const set = pool[Math.floor(Math.random() * pool.length)];
    const { data } = await fetchJson<RawSet>(`${TCGDEX_BASE}/sets/${encodeURIComponent(set.id)}`, {
      ttlMs: TTL.set,
      cacheKey: cacheKey("set", `${LANG}:${set.id}`),
    });
    const cards = data.cards ?? [];
    if (!cards.length) continue;
    const brief = cards[Math.floor(Math.random() * cards.length)];
    const { card } = await getCard(brief.id, { signal });
    return card;
  }

  throw new ApiError("Could not pick a random card. Please try again.", 0, "server");
}

export function setRefLabel(ref: SetRef | undefined): string {
  return ref?.name?.trim() || "Set not listed";
}
