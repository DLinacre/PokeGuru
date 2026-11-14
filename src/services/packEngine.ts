/**
 * Pack generation engine.
 *
 * Pure functions only — no DOM, no storage, no network. The same code powers
 * real openings (crypto RNG) and the test-suite (seeded RNG), so a seed
 * reproduces a pack exactly and the tests exercise the production path.
 */

import type {
  PackConfig,
  PackOdds,
  PackPool,
  PackResult,
  PackSlotRule,
  PulledCard,
  PullTreatment,
  RarityTier,
} from "../types/packs";
import {
  TIER_LABELS,
  confidenceLabel,
  tierRank,
} from "../data/packRules";
import { reversePool } from "./packPools";

export interface Rng {
  next: () => number;
}

/* ------------------------------------------------------------------ */
/* Randomness                                                          */
/* ------------------------------------------------------------------ */

/** xmur3 string hash → 32-bit seed. */
function xmur3(input: string): () => number {
  let h = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    h = Math.imul(h ^ input.charCodeAt(index), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Deterministic, well-distributed PRNG used for tests and replay. */
export function seededRng(seed: string): Rng {
  let state = xmur3(seed)();
  return {
    next: () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Browser randomness for genuine openings. Uses the platform CSPRNG when it
 * exists and falls back to Math.random only in environments without one
 * (e.g. jsdom in tests) — the fallback never changes the configured odds.
 */
export function cryptoRng(): Rng {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint32Array(1);
    return {
      next: () => {
        cryptoApi.getRandomValues(buffer);
        return buffer[0] / 4294967296;
      },
    };
  }
  return { next: () => Math.random() };
}

/** URL-safe random seed, e.g. for shareable replay links. */
export function randomSeed(): string {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2, 12);
}

export class PackGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackGenerationError";
  }
}

/* ------------------------------------------------------------------ */
/* Picking                                                             */
/* ------------------------------------------------------------------ */

function pickIndex(length: number, rng: Rng): number {
  // `next()` is in [0, 1); clamp so a pathological 1 cannot overrun.
  const value = Math.min(0.999999999, Math.max(0, rng.next()));
  return Math.floor(value * length);
}

function pickCard(cards: PulledCard[], used: Set<string>, rng: Rng): PulledCard {
  const available = cards.filter((card) => !used.has(card.id));
  const source = available.length ? available : cards;
  return source[pickIndex(source.length, rng)];
}

function toPulled(card: PulledCard, treatment: PullTreatment, slot: string): PulledCard {
  return { ...card, treatment, slot };
}

/** Normalised tier weights, restricted to tiers that actually have cards. */
export function tierWeightTable(
  weights: Partial<Record<RarityTier, number>> | undefined,
  pool: PackPool
): { tier: RarityTier; weight: number }[] {
  const entries: { tier: RarityTier; weight: number }[] = [];
  if (weights) {
    for (const [tier, weight] of Object.entries(weights) as [RarityTier, number][]) {
      const size = pool.tiers[tier]?.length ?? 0;
      if (!size || !Number.isFinite(weight) || weight <= 0) continue;
      entries.push({ tier, weight });
    }
  }
  if (entries.length) return entries;
  // No weights configured at all (a "uniform" slot): use every rarity present.
  // When weights *were* configured but none of those tiers exist, return an
  // empty table so the caller runs its documented fallback chain instead of
  // silently drawing a rarity the rule never mentioned.
  if (weights) return entries;
  for (const tier of Object.keys(pool.tiers) as RarityTier[]) {
    if (tier === "other") continue;
    if (pool.tiers[tier]?.length) entries.push({ tier, weight: 1 });
  }
  return entries;
}

function pickWeightedTier(entries: { tier: RarityTier; weight: number }[], rng: Rng): RarityTier {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let ticket = rng.next() * total;
  for (const entry of entries) {
    ticket -= entry.weight;
    if (ticket <= 0) return entry.tier;
  }
  return entries[entries.length - 1].tier;
}

/* ------------------------------------------------------------------ */
/* Slots                                                               */
/* ------------------------------------------------------------------ */

interface SlotPool {
  cards: PulledCard[];
  treatment: PullTreatment;
  /** Tier used for the odds table. */
  tiers: RarityTier[];
  detail: string;
  /** When set, the slot picks a tier by weight before picking a card. */
  weighted?: { tier: RarityTier; weight: number }[];
}

function cardsForTier(pool: PackPool, tier: RarityTier): PulledCard[] {
  return (pool.tiers[tier] ?? []).map((card) => ({ ...card, treatment: "normal", slot: "" }));
}

const FALLBACK_ORDER: Record<PackSlotRule["kind"], RarityTier[]> = {
  common: ["common", "uncommon", "rare", "holoRare"],
  uncommon: ["uncommon", "common", "rare"],
  rare: ["rare", "holoRare", "ultraRare", "uncommon"],
  reverse: ["common", "uncommon", "rare", "holoRare"],
  holo: ["holoRare", "rare", "ultraRare"],
  hit: ["ultraRare", "holoRare", "rare", "doubleRare"],
  energy: ["other", "common"],
  wildcard: ["common", "uncommon", "rare", "holoRare"],
};

function slotTiers(slot: PackSlotRule, pool: PackPool, config: PackConfig): RarityTier[] {
  switch (slot.kind) {
    case "common":
      return ["common"];
    case "uncommon":
      return ["uncommon"];
    case "reverse": {
      const cards = reversePool(pool, config);
      const tiers = new Set<RarityTier>();
      for (const card of cards) tiers.add(card.tier);
      return [...tiers];
    }
    case "energy":
      return ["other"];
    default:
      return tierWeightTable(slot.weights, pool).map((entry) => entry.tier);
  }
}

function resolveSlotCards(
  slot: PackSlotRule,
  pool: PackPool,
  config: PackConfig
): SlotPool {
  const treatment: PullTreatment =
    slot.treatment ?? (slot.kind === "reverse" ? "reverse" : slot.kind === "common" || slot.kind === "uncommon" ? "normal" : "holo");

  if (slot.kind === "reverse") {
    const cards = reversePool(pool, config);
    if (cards.length) {
      return {
        cards: cards.map((card) => ({ ...card, treatment: "reverse", slot: slot.id })),
        treatment: "reverse",
        tiers: [...new Set(cards.map((card) => card.tier))],
        detail: "One reverse foil from this set's printed rarities.",
      };
    }
  }

  if (slot.kind === "energy") {
    const energies = pool.tiers.other ?? [];
    if (energies.length) {
      return {
        cards: energies.map((card) => ({ ...card, treatment: "normal", slot: slot.id })),
        treatment: "normal",
        tiers: ["other"],
        detail: "A basic Energy card printed in this set.",
      };
    }
  }

  // Fixed-tier slots. These must draw from their own rarity, never from the
  // whole pool — a common slot that could draw a secret rare would silently
  // break the pack structure.
  if (slot.kind === "common" || slot.kind === "uncommon" || slot.kind === "holo") {
    const tier: RarityTier = slot.kind === "common" ? "common" : slot.kind === "uncommon" ? "uncommon" : "holoRare";
    const cards = cardsForTier(pool, tier);
    if (cards.length) {
      return {
        cards,
        treatment,
        tiers: [tier],
        detail:
          slot.kind === "holo"
            ? "A holofoil rare from this set."
            : `A ${TIER_LABELS[tier].toLowerCase()} card printed in this set.`,
      };
    }

    for (const fallbackTier of FALLBACK_ORDER[slot.kind]) {
      const fallbackCards = cardsForTier(pool, fallbackTier);
      if (fallbackCards.length) {
        return {
          cards: fallbackCards,
          treatment,
          tiers: [fallbackTier],
          detail: `No ${slot.label.toLowerCase()} cards are recorded for this set, so a ${TIER_LABELS[fallbackTier].toLowerCase()} card fills the slot.`,
        };
      }
    }

    throw new PackGenerationError(
      `This expansion has no card data for its ${slot.label.toLowerCase()} slot, so PokeGuru will not generate a pack.`
    );
  }

  // Weighted slot (rare / hit / wildcard / holo).
  const entries = slot.weights
    ? tierWeightTable(slot.weights, pool)
    : tierWeightTable(undefined, pool);

  if (entries.length) {
    return {
      cards: entries.flatMap((entry) => cardsForTier(pool, entry.tier)),
      treatment,
      tiers: entries.map((entry) => entry.tier),
      detail: slot.weights
        ? "Weighted across this set's rarity mix."
        : "Uniform across this set's available rarities.",
      weighted: entries,
    };
  }

  // Documented fallback chain before giving up.
  const chain = FALLBACK_ORDER[slot.fallback ?? slot.kind];
  for (const tier of chain) {
    const cards = cardsForTier(pool, tier);
    if (cards.length) {
      return {
        cards,
        treatment: tier === "other" ? "normal" : treatment,
        tiers: [tier],
        detail: `This set has no ${slot.label.toLowerCase()} data, so a ${TIER_LABELS[tier].toLowerCase()} card fills the slot.`,
      };
    }
  }

  throw new PackGenerationError(
    `This expansion is missing the card data needed for its ${slot.label.toLowerCase()} slot, so PokeGuru will not generate a pack.`
  );
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  pool: PackPool;
  config: PackConfig;
  setId?: string;
  setName?: string;
  seriesId?: string;
  /** Supply a seed for deterministic output; omit for CSPRNG randomness. */
  seed?: string;
  rng?: Rng;
  openedAt?: number;
}

export function generatePack(options: GenerateOptions): PackResult {
  const { pool, config } = options;
  const setId = options.setId ?? pool.setId;
  const setName = options.setName ?? pool.setName;
  const seriesId = options.seriesId ?? pool.seriesId;
  const seed = options.seed ?? randomSeed();
  const rng = options.rng ?? (options.seed ? seededRng(options.seed) : cryptoRng());
  const openedAt = options.openedAt ?? Date.now();

  const used = new Set<string>();
  const cards: PulledCard[] = [];

  for (const slot of config.slots) {
    const resolved = resolveSlotCards(slot, pool, config);
    for (let index = 0; index < slot.count; index += 1) {
      let candidates = resolved.cards;
      if (resolved.weighted?.length) {
        // Pick the tier first so the odds panel and the engine agree exactly.
        const present = resolved.weighted.filter((entry) => (pool.tiers[entry.tier]?.length ?? 0) > 0);
        // Never repeat a card: if a tier is exhausted, re-weight the remaining
        // tiers rather than drawing the same physical card twice.
        const withUnused = present.filter((entry) =>
          (pool.tiers[entry.tier] ?? []).some((card) => !used.has(card.id))
        );
        const available = withUnused.length ? withUnused : present;
        if (available.length) {
          const tier = pickWeightedTier(available, rng);
          candidates = cardsForTier(pool, tier);
        }
      }
      const card = pickCard(candidates, used, rng);
      used.add(card.id);
      cards.push(toPulled(card, resolved.treatment, slot.id));
    }
  }

  if (cards.length !== config.cardsPerPack) {
    throw new PackGenerationError(
      `Pack generation produced ${cards.length} cards but the ${config.label} rule has ${config.cardsPerPack}.`
    );
  }

  // Reveal order: rarest last, so the best pull is the climax.
  cards.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));

  const bestTier = cards.reduce<RarityTier | null>((best, card) => {
    if (!best) return card.tier;
    return tierRank(card.tier) > tierRank(best) ? card.tier : best;
  }, null);

  return {
    id: `${setId}:${openedAt}:${seed}`,
    setId,
    setName,
    seriesId,
    configId: config.id,
    openedAt,
    seed,
    cards,
    bestTier,
  };
}

/** Open several packs with independent randomness. */
export function generatePacks(options: Omit<GenerateOptions, "seed" | "rng">, count: number): PackResult[] {
  const packs: PackResult[] = [];
  for (let index = 0; index < count; index += 1) {
    packs.push(generatePack({ ...options, openedAt: Date.now() + index }));
  }
  return packs;
}

/* ------------------------------------------------------------------ */
/* Odds                                                                */
/* ------------------------------------------------------------------ */

/**
 * Per-pack tier chances implied by the configuration and this set's pool.
 * These are PokeGuru's modelled numbers — never presented as official odds.
 */
export function computePackOdds(pool: PackPool, config: PackConfig): PackOdds {
  const chance: Partial<Record<RarityTier, number>> = {};
  const slotSummary: PackOdds["slotSummary"] = [];

  for (const slot of config.slots) {
    const tiers = slotTiers(slot, pool, config);
    const entries = slot.weights ? tierWeightTable(slot.weights, pool) : [];
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

    if (entries.length && totalWeight > 0) {
      for (const entry of entries) {
        const p = entry.weight / totalWeight;
        // A slot with count n draws n cards; approximate at least one.
        const atLeastOne = 1 - Math.pow(1 - p, slot.count);
        chance[entry.tier] = 1 - (1 - (chance[entry.tier] ?? 0)) * (1 - atLeastOne);
      }
    } else {
      // Uniform over the *cards* this slot can draw, so a tier with more
      // printed cards is proportionally more likely — exactly as the engine
      // draws it.
      const present = tiers.filter((tier) => (pool.tiers[tier]?.length ?? 0) > 0);
      const total = present.reduce((sum, tier) => sum + (pool.tiers[tier]?.length ?? 0), 0);
      if (total > 0) {
        for (const tier of present) {
          const p = (pool.tiers[tier]?.length ?? 0) / total;
          const atLeastOne = 1 - Math.pow(1 - p, slot.count);
          chance[tier] = 1 - (1 - (chance[tier] ?? 0)) * (1 - atLeastOne);
        }
      }
    }

    slotSummary.push({
      slot: slot.id,
      count: slot.count,
      detail: `${slot.label}: ${slot.count} card${slot.count === 1 ? "" : "s"}${
        tiers.length ? ` · ${tiers.map((tier) => TIER_LABELS[tier]).join(", ")}` : ""
      }`,
    });
  }

  const rows = (Object.keys(chance) as RarityTier[])
    .map((tier) => ({
      tier,
      label: TIER_LABELS[tier],
      perPack: chance[tier] ?? 0,
      poolSize: pool.tiers[tier]?.length ?? 0,
    }))
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier));

  const weightedTiers = new Set<RarityTier>();
  for (const slot of config.slots) {
    if (slot.weights) {
      for (const tier of Object.keys(slot.weights) as RarityTier[]) weightedTiers.add(tier);
    }
  }
  const thin = [...weightedTiers].some((tier) => {
    const size = pool.tiers[tier]?.length ?? 0;
    return size > 0 && size < 4;
  });

  return {
    configId: config.id,
    confidence: config.confidence,
    rows,
    slotSummary,
    source: config.source,
    checkedAt: config.checkedAt,
    notes: config.notes,
    thin,
  };
}

export { confidenceLabel };
