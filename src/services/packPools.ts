/**
 * Pack pool builder.
 *
 * TCGdex exposes rarity only on full card records, but it can *filter* card
 * briefs by rarity. Instead of downloading every card in a set (hundreds of
 * requests), the simulator asks for one cheap brief list per rarity bucket and
 * labels each returned card with that bucket.
 *
 * Data honesty rules:
 *  - every card comes from the selected expansion (plus its Trainer Gallery /
 *    Shiny Vault subset, which is physically inside the same packs);
 *  - cards whose rarity the API does not report are excluded, and the pool
 *    reports how many were left out;
 *  - nothing is synthesised when a request fails — the caller gets an error.
 */

import type { TcgSet } from "../types/pokemon";
import type {
  PackConfig,
  PackPool,
  PoolsByTier,
  PoolCard,
  RarityTier,
} from "../types/packs";
import { tierFromRarity } from "../data/packRules";
import { getSet, getSets, TCGDEX_BASE } from "./tcgdex";
import { ApiError, fetchJson, raceAbort } from "./http";

const POOL_TTL = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 250;
const CONCURRENCY = 6;

/** Raw TCGdex rarity strings that map onto each canonical tier. */
export const RARITY_QUERIES: Record<RarityTier, string[]> = {
  common: ["Common"],
  uncommon: ["Uncommon"],
  rare: ["Rare"],
  holoRare: ["Holo Rare", "Rare Holo"],
  doubleRare: ["Double rare"],
  ultraRare: [
    "Ultra Rare",
    "Holo Rare V",
    "Holo Rare VMAX",
    "Holo Rare VSTAR",
    "Rare Holo EX",
    "Rare Holo GX",
    "Full Art Trainer",
  ],
  illustrationRare: ["Illustration rare"],
  specialIllustrationRare: ["Special illustration rare"],
  hyperRare: ["Hyper rare", "Mega Hyper Rare"],
  aceSpec: ["ACE SPEC Rare"],
  shinyRare: ["Shiny rare", "Shiny rare V", "One Shiny", "Two Shiny"],
  shinyUltraRare: ["Shiny Ultra Rare", "Shiny rare VMAX"],
  radiant: ["Radiant Rare"],
  amazingRare: ["Amazing Rare"],
  prime: ["Rare PRIME"],
  legend: ["LEGEND"],
  lvX: ["Rare Holo LV.X"],
  secretRare: ["Secret Rare", "Black White Rare"],
  other: [],
};

/** Every tier that a configuration can produce. */
export function tiersForConfig(config: PackConfig): RarityTier[] {
  const tiers = new Set<RarityTier>(["common", "uncommon", "rare", "holoRare"]);
  for (const slot of config.slots) {
    if (slot.weights) {
      for (const tier of Object.keys(slot.weights) as RarityTier[]) tiers.add(tier);
    }
  }
  // Reverse foils only exist for cards printed in the set's normal rarity
  // range, so the four base tiers above already cover them. Asking for every
  // rarity the API knows about would triple the request count for no gain.
  tiers.delete("other");
  return [...tiers].filter((tier) => RARITY_QUERIES[tier].length > 0);
}

export class PackPoolError extends Error {
  constructor(message: string, public code: "empty" | "network" | "unsupported") {
    super(message);
    this.name = "PackPoolError";
  }
}

interface RawBrief {
  id: string;
  localId?: string | number;
  name: string;
  image?: string | null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * The rarity vocabulary is published by the API itself. Reading it means the
 * simulator queries the exact strings TCGdex uses ("Holo Rare V", not the
 * "Rare Holo V" we might guess) without hard-coding a list per era.
 */
let rarityVocabulary: Promise<string[]> | null = null;

async function fetchRarityVocabulary(signal?: AbortSignal): Promise<string[]> {
  if (!rarityVocabulary) {
    rarityVocabulary = fetchJson<string[]>(`${TCGDEX_BASE}/rarities`, {
      ttlMs: POOL_TTL,
      cacheKey: "packpool:en:rarities",
    })
      .then(({ data }) => (Array.isArray(data) ? data.filter((entry): entry is string => typeof entry === "string") : []))
      .catch(() => {
        // Let a retry ask again instead of pinning the empty fallback.
        rarityVocabulary = null;
        return [];
      });
  }
  return raceAbort(rarityVocabulary, signal);
}

/** Raw rarity strings that belong to a tier, from the live vocabulary. */
export async function raritiesForTier(tier: RarityTier, signal?: AbortSignal): Promise<string[]> {
  const vocabulary = await fetchRarityVocabulary(signal);
  const fromApi = vocabulary.filter((rarity) => tierFromRarity(rarity) === tier);
  return [...new Set([...fromApi, ...(RARITY_QUERIES[tier] ?? [])])];
}

async function fetchBriefs(url: string, signal?: AbortSignal): Promise<RawBrief[]> {
  const { data } = await raceAbort(
    fetchJson<RawBrief[]>(url, {
      ttlMs: POOL_TTL,
      cacheKey: `packpool:en:${url.split("?")[1] ?? url}`,
    }),
    signal
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Sets whose cards are physically opened from this expansion's packs:
 * Trainer Gallery (`tg`), Shiny Vault (`sv`) and Galarian Gallery (`gg`)
 * subsets share the parent's booster.
 */
export function relatedSetIds(setId: string, allSetIds: string[]): string[] {
  const extras = allSetIds.filter((id) => {
    if (id === setId || !id.startsWith(setId)) return false;
    const suffix = id.slice(setId.length);
    return /^(tg|sv|gg)$/.test(suffix);
  });
  return [setId, ...extras];
}

const poolMemo = new Map<string, PackPool>();

export function clearPoolMemo(): void {
  poolMemo.clear();
}

export interface BuildPoolOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function buildPackPool(
  set: TcgSet,
  config: PackConfig,
  options: BuildPoolOptions = {}
): Promise<PackPool> {
  const { signal, onProgress } = options;
  const memoKey = `${set.id}:${config.id}`;
  const cached = poolMemo.get(memoKey);
  if (cached) return cached;

  const seriesId = set.series || "";

  // Related subsets, resolved from the cached set index (one request at most).
  let allSetIds: string[];
  try {
    const { sets } = await raceAbort(getSets(signal), signal);
    allSetIds = sets.map((entry) => entry.id);
  } catch {
    allSetIds = [set.id];
  }
  const setIds = relatedSetIds(set.id, allSetIds);

  // Pack metadata for every contributing set.
  const details = await mapWithConcurrency(setIds, 3, async (id) => {
    try {
      const { set: detail } = await getSet(id, signal);
      return detail;
    } catch (err) {
      if (id === set.id) throw err;
      return null;
    }
  });

  const primary = details[0] ?? set;
  const contributors = details.filter((entry): entry is TcgSet => Boolean(entry));
  const nameById = new Map(contributors.map((entry) => [entry.id, entry.name]));
  nameById.set(set.id, set.name);

  const tiers = tiersForConfig(config);
  const raritiesByTier = new Map<RarityTier, string[]>();
  await Promise.all(
    tiers.map(async (tier) => {
      raritiesByTier.set(tier, await raritiesForTier(tier, signal));
    })
  );

  const jobs: { setId: string; tier: RarityTier; rarity: string }[] = [];
  for (const setId of setIds) {
    for (const tier of tiers) {
      for (const rarity of raritiesByTier.get(tier) ?? []) {
        jobs.push({ setId, tier, rarity });
      }
    }
  }

  let done = 0;
  onProgress?.(0, jobs.length + 1);

  const pools: PoolsByTier = {};
  const seen = new Set<string>();
  let examined = 0;

  try {
    await mapWithConcurrency(jobs, CONCURRENCY, async (job) => {
      const params = new URLSearchParams();
      params.set("set.id", `eq:${job.setId}`);
      params.set("rarity", `eq:${job.rarity}`);
      params.set("pagination:page", "1");
      params.set("pagination:itemsPerPage", String(PAGE_SIZE));

      const briefs = await fetchBriefs(`${TCGDEX_BASE}/cards?${params.toString()}`, signal);
      for (const brief of briefs) {
        if (!brief?.id || seen.has(brief.id)) continue;
        // Guard against an upstream filter slipping in a foreign card.
        if (!brief.id.startsWith(`${job.setId}-`)) continue;
        const tier = tierFromRarity(job.rarity);
        if (tier !== job.tier) continue;
        seen.add(brief.id);
        const card: PoolCard = {
          id: brief.id,
          name: brief.name,
          localId: String(brief.localId ?? brief.id.slice(setIdLength(brief.id))),
          setId: job.setId,
          setName: nameById.get(job.setId) ?? set.name,
          rarity: job.rarity,
          tier,
          // Store the asset base; the artwork resolver appends the derivative.
          image: brief.image ?? undefined,
        };
        (pools[tier] ??= []).push(card);
      }
      done += 1;
      onProgress?.(done, jobs.length + 1);
    });

    // Energy cards (WotC-era packs included one basic Energy).
    if (config.slots.some((slot) => slot.kind === "energy")) {
      const params = new URLSearchParams();
      params.set("set.id", `eq:${set.id}`);
      params.set("category", "eq:Energy");
      params.set("pagination:page", "1");
      params.set("pagination:itemsPerPage", String(PAGE_SIZE));
      const briefs = await fetchBriefs(`${TCGDEX_BASE}/cards?${params.toString()}`, signal);
      for (const brief of briefs) {
        if (!brief?.id || seen.has(brief.id)) continue;
        seen.add(brief.id);
        (pools.other ??= []).push({
          id: brief.id,
          name: brief.name,
          localId: String(brief.localId ?? ""),
          setId: set.id,
          setName: set.name,
          rarity: "Energy",
          tier: "other",
          // Store the asset base; the artwork resolver appends the derivative.
          image: brief.image ?? undefined,
        });
      }
      done += 1;
      onProgress?.(done, jobs.length + 1);
    }
  } catch (err) {
    if (err instanceof ApiError && err.kind === "aborted") throw err;
    throw new PackPoolError(
      "The card database could not be reached, so no pack can be simulated. Nothing was generated.",
      "network"
    );
  }

  for (const entry of contributors) examined += entry.cards?.length ?? 0;

  const mapped = Object.entries(pools).reduce(
    (sum, [, cards]) => sum + (cards?.length ?? 0),
    0
  );

  if (!pools.common?.length && !pools.uncommon?.length) {
    throw new PackPoolError(
      "This expansion has no rarity data in the card database yet, so a pack cannot be simulated honestly.",
      "empty"
    );
  }

  const pool: PackPool = {
    setId: set.id,
    setName: set.name,
    seriesId,
    releaseDate: set.releaseDate ?? primary.releaseDate,
    configId: config.id,
    tiers: pools,
    unmapped: Math.max(0, examined - mapped),
    examined,
    sourceSets: setIds.filter((id) => (pools.common ?? []).some((card) => card.setId === id) || id === set.id),
    builtAt: Date.now(),
  };

  poolMemo.set(memoKey, pool);
  return pool;
}

function setIdLength(cardId: string): number {
  const index = cardId.lastIndexOf("-");
  return index > 0 ? index + 1 : 0;
}

/** All cards that can appear in a reverse-holo slot for a config. */
export function reversePool(pool: PackPool, _config?: PackConfig): PoolCard[] {
  // Reverse foils are only printed for the set's standard rarity range, so a
  // reverse slot must never hand back a secret/illustration/hyper rare.
  const allowed: RarityTier[] = ["common", "uncommon", "rare", "holoRare"];
  const seen = new Set<string>();
  const cards: PoolCard[] = [];
  for (const tier of [...new Set(allowed)]) {
    for (const card of pool.tiers[tier] ?? []) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}
