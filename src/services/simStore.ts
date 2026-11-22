/**
 * Simulated pull store.
 *
 * Completely separate from the real collection vault:
 *  - different localStorage key
 *  - different shape (a pull keeps the finish that was opened)
 *  - never read by pricing, collection or valuation code
 *
 * Any component that shows simulated cards must label them as simulated.
 */

import { useSyncExternalStore } from "react";
import type {
  OpeningPackRecord,
  OpeningSession,
  PackResult,
  PackValueTotals,
  PulledCard,
  PullValuation,
  SimCard,
  SimSettings,
  SimState,
} from "../types/packs";

/**
 * The storage key is deliberately unchanged from 1.10: keeping it means an
 * existing simulator collection and pull history survive the upgrade. The
 * payload carries its own `version`, which is what migrates.
 */
export const SIM_STORAGE_KEY = "pokeguru_pack_sim_v1";
const HISTORY_LIMIT = 40;
/** Newest openings kept in full. Each one stores frozen price snapshots. */
export const OPENING_LIMIT = 12;

const DEFAULT_SETTINGS: SimSettings = {
  sound: true,
  reduceMotion: false,
  wrapperStyle: "crimson",
};

export function emptySimState(): SimState {
  return {
    version: 2,
    cards: {},
    packsOpened: 0,
    history: [],
    openings: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: SimState = emptySimState();
let hydrated = false;

function clone(state: SimState): SimState {
  return {
    ...state,
    cards: { ...state.cards },
    history: [...state.history],
    openings: [...state.openings],
    settings: { ...state.settings },
  };
}

function normaliseCard(raw: unknown): PulledCard | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  if (!id || !name) return null;
  const treatment =
    value.treatment === "reverse" || value.treatment === "holo" ? value.treatment : "normal";
  return {
    id,
    name,
    localId: typeof value.localId === "string" ? value.localId : "",
    setId: typeof value.setId === "string" ? value.setId : "",
    setName: typeof value.setName === "string" ? value.setName : "",
    rarity: typeof value.rarity === "string" ? value.rarity : "",
    tier: (typeof value.tier === "string" ? value.tier : "other") as PulledCard["tier"],
    treatment,
    image: typeof value.image === "string" ? value.image : undefined,
    imageBase: typeof value.imageBase === "string" ? value.imageBase : undefined,
    slot: typeof value.slot === "string" ? value.slot : "unknown",
  };
}

function normaliseResult(raw: unknown): PackResult | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const cards = Array.isArray(value.cards)
    ? value.cards.map(normaliseCard).filter((card): card is PulledCard => Boolean(card))
    : [];
  if (!cards.length) return null;
  const id = typeof value.id === "string" ? value.id : "";
  if (!id) return null;
  return {
    id,
    setId: typeof value.setId === "string" ? value.setId : cards[0].setId,
    setName: typeof value.setName === "string" ? value.setName : cards[0].setName,
    seriesId: typeof value.seriesId === "string" ? value.seriesId : "",
    configId: typeof value.configId === "string" ? value.configId : "",
    openedAt: typeof value.openedAt === "number" ? value.openedAt : Date.now(),
    seed: typeof value.seed === "string" ? value.seed : "",
    cards,
    bestTier: (typeof value.bestTier === "string" ? value.bestTier : null) as PackResult["bestTier"],
  };
}

const FINISHES = new Set(["normal", "reverse", "holo"]);
const BASES = new Set(["trend", "avg", "low", "avg30"]);

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

/** Defensive read of one frozen pull value. Returns null when unusable. */
function normaliseValuation(raw: unknown): PullValuation | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const cardId = asString(value.cardId);
  const name = asString(value.name);
  if (!cardId || !name) return null;
  const finish = FINISHES.has(String(value.finish)) ? (value.finish as PullValuation["finish"]) : "normal";
  const status = value.status === "priced" && asNumber(value.gbp) != null ? "priced" : "unavailable";
  const basis = typeof value.basis === "string" && BASES.has(value.basis) ? (value.basis as PullValuation["basis"]) : null;
  const variant = value.variant === "holo" || value.variant === "normal" ? value.variant : null;
  return {
    key: asString(value.key) ?? `${cardId}|${finish}`,
    cardId,
    name,
    localId: asString(value.localId) ?? "",
    setId: asString(value.setId) ?? "",
    setName: asString(value.setName) ?? "",
    finish,
    tier: (asString(value.tier) ?? "other") as PullValuation["tier"],
    status,
    eur: asNumber(value.eur),
    gbp: status === "priced" ? asNumber(value.gbp) : null,
    basis,
    variant,
    printing: asString(value.printing) ?? "",
    source: value.source === "cardmarket" ? "cardmarket" : null,
    priceUpdatedAt: asString(value.priceUpdatedAt),
    fxDate: asString(value.fxDate),
    fxRate: asNumber(value.fxRate) ?? undefined,
    retrievedAt: asNumber(value.retrievedAt) ?? Date.now(),
    reason: asString(value.reason),
    flags: Array.isArray(value.flags) ? value.flags.filter((flag): flag is string => typeof flag === "string") : [],
  };
}

function normaliseTotals(raw: unknown): PackValueTotals {
  const value = (raw ?? {}) as Record<string, unknown>;
  const count = (key: string): number => {
    const parsed = asNumber(value[key]);
    return parsed != null && parsed >= 0 ? Math.floor(parsed) : 0;
  };
  const extreme = (key: "highest" | "lowest"): PackValueTotals["highest"] => {
    const entry = value[key];
    if (!entry || typeof entry !== "object") return null;
    const record = entry as Record<string, unknown>;
    const cardId = asString(record.cardId);
    const name = asString(record.name);
    const gbp = asNumber(record.gbp);
    return cardId && name && gbp != null ? { cardId, name, gbp } : null;
  };
  return {
    cards: count("cards"),
    priced: count("priced"),
    unavailable: count("unavailable"),
    pending: count("pending"),
    totalGbp: asNumber(value.totalGbp) ?? 0,
    totalEur: asNumber(value.totalEur) ?? 0,
    averageGbp: asNumber(value.averageGbp),
    highest: extreme("highest"),
    lowest: extreme("lowest"),
  };
}

function normaliseOpeningPack(raw: unknown): OpeningPackRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const packId = asString(value.packId);
  if (!packId) return null;
  const pulls = Array.isArray(value.pulls)
    ? value.pulls.map(normaliseValuation).filter((pull): pull is PullValuation => Boolean(pull))
    : [];
  return {
    packId,
    openedAt: asNumber(value.openedAt) ?? Date.now(),
    seed: asString(value.seed) ?? "",
    bestTier: (asString(value.bestTier) ?? null) as OpeningPackRecord["bestTier"],
    pulls,
    totals: normaliseTotals(value.totals),
  };
}

function normaliseOpening(raw: unknown): OpeningSession | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = asString(value.id);
  if (!id) return null;
  const packs = Array.isArray(value.packs)
    ? value.packs.map(normaliseOpeningPack).filter((pack): pack is OpeningPackRecord => Boolean(pack))
    : [];
  return {
    id,
    setId: asString(value.setId) ?? "",
    setName: asString(value.setName) ?? "",
    seriesId: asString(value.seriesId) ?? "",
    startedAt: asNumber(value.startedAt) ?? Date.now(),
    completedAt: asNumber(value.completedAt) ?? Date.now(),
    packs,
    totals: normaliseTotals(value.totals),
    valuesRecorded: value.valuesRecorded === true,
    legacy: value.legacy === true ? true : undefined,
  };
}

/**
 * Packs saved before opening-session records existed are migrated one pack per
 * entry, explicitly marked legacy and without values. Grouping them into
 * invented sessions, or inventing prices for them, would both be dishonest.
 */
function migrateLegacyHistory(history: PackResult[]): OpeningSession[] {
  return history.slice(0, OPENING_LIMIT).map((result) => ({
    id: `legacy:${result.id}`,
    setId: result.setId,
    setName: result.setName,
    seriesId: result.seriesId,
    startedAt: result.openedAt,
    completedAt: result.openedAt,
    packs: [
      {
        packId: result.id,
        openedAt: result.openedAt,
        seed: result.seed,
        bestTier: result.bestTier,
        pulls: [],
        totals: {
          cards: result.cards.length,
          priced: 0,
          unavailable: 0,
          pending: 0,
          totalGbp: 0,
          totalEur: 0,
          averageGbp: null,
          highest: null,
          lowest: null,
        },
      },
    ],
    totals: {
      cards: result.cards.length,
      priced: 0,
      unavailable: 0,
      pending: 0,
      totalGbp: 0,
      totalEur: 0,
      averageGbp: null,
      highest: null,
      lowest: null,
    },
    valuesRecorded: false,
    legacy: true,
  }));
}

export function parseSimState(raw: string | null): SimState {
  if (!raw) return emptySimState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySimState();
  }
  if (!parsed || typeof parsed !== "object") return emptySimState();
  const value = parsed as Record<string, unknown>;
  const state = emptySimState();

  if (value.settings && typeof value.settings === "object") {
    const settings = value.settings as Record<string, unknown>;
    state.settings = {
      sound: settings.sound !== false,
      reduceMotion: settings.reduceMotion === true,
      wrapperStyle:
        settings.wrapperStyle === "prism" || settings.wrapperStyle === "vintage"
          ? settings.wrapperStyle
          : "crimson",
    };
  }

  if (value.cards && typeof value.cards === "object") {
    for (const entry of Object.values(value.cards as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const card = normaliseCard(record.card);
      if (!card) continue;
      const quantity = typeof record.quantity === "number" && record.quantity > 0 ? Math.floor(record.quantity) : 1;
      state.cards[card.id] = {
        card,
        quantity,
        firstPulledAt: typeof record.firstPulledAt === "number" ? record.firstPulledAt : Date.now(),
      };
    }
  }

  if (Array.isArray(value.history)) {
    state.history = value.history
      .map(normaliseResult)
      .filter((result): result is PackResult => Boolean(result))
      .slice(0, HISTORY_LIMIT);
  }

  if (Array.isArray(value.openings)) {
    state.openings = value.openings
      .map(normaliseOpening)
      .filter((opening): opening is OpeningSession => Boolean(opening))
      .slice(0, OPENING_LIMIT);
  }
  // A v1 payload has no `openings`; keep its pull history visible as legacy
  // entries with no recorded values rather than pretending it never happened.
  // …but only when the payload has no openings array at all. A v2 payload whose
  // openings the visitor deliberately cleared also arrives here with an empty
  // array, and re-deriving entries from `history` would undelete them.
  if (!Array.isArray(value.openings) && state.history.length) {
    state.openings = migrateLegacyHistory(state.history);
  }

  // Older payloads may predate the counter; history is the only evidence we
  // have, so it becomes a lower bound rather than a fabricated total.
  state.packsOpened =
    typeof value.packsOpened === "number" && value.packsOpened >= 0
      ? Math.floor(value.packsOpened)
      : state.history.length;

  return state;
}

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function loadSimState(): SimState {
  if (!storageAvailable()) return emptySimState();
  try {
    return parseSimState(window.localStorage.getItem(SIM_STORAGE_KEY));
  } catch {
    return emptySimState();
  }
}

function persist(state: SimState): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(state));
    return;
  } catch (err) {
    // Opening records carry price snapshots and are the largest part of the
    // payload, so drop the oldest few before giving up on saving everything
    // else (collection totals, settings, pull history).
    if (state.openings.length > 1) {
      try {
        const trimmed = JSON.parse(JSON.stringify(state)) as SimState;
        trimmed.openings = trimmed.openings.slice(0, Math.max(1, Math.floor(trimmed.openings.length / 2)));
        window.localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(trimmed));
        snapshot = trimmed;
        return;
      } catch {
        /* fall through to the warning below */
      }
    }
    console.warn("PokeGuru: simulated pulls could not be saved (storage full or unavailable).", err);
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: SimState, options: { persist?: boolean } = {}): void {
  snapshot = next;
  if (options.persist !== false) persist(next);
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SimState {
  if (!hydrated) {
    hydrated = true;
    snapshot = loadSimState();
  }
  return snapshot;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SIM_STORAGE_KEY) return;
    hydrated = true;
    snapshot = loadSimState();
    emit();
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

/** Record one or more opened packs. Safe to call in a tight loop. */
export function recordPacks(results: PackResult[]): SimState {
  if (!results.length) return getSnapshot();
  const current = clone(getSnapshot());
  const cards = { ...current.cards };

  for (const result of results) {
    for (const pull of result.cards) {
      const existing = cards[pull.id];
      cards[pull.id] = existing
        ? { ...existing, quantity: existing.quantity + 1, card: existing.card }
        : { card: pull, quantity: 1, firstPulledAt: result.openedAt };
    }
    current.history.unshift(result);
  }

  current.cards = cards;
  current.history = current.history.slice(0, HISTORY_LIMIT);
  current.packsOpened += results.length;
  setState(current);
  return current;
}

/**
 * Save one opening session with the prices that were current at the time.
 *
 * Written once, then never recomputed: the market moving tomorrow must not
 * change what a past opening was worth. Re-recording the same session id is a
 * no-op, so a double render cannot duplicate an entry.
 */
export function recordOpening(session: OpeningSession): SimState {
  const current = clone(getSnapshot());
  if (current.openings.some((entry) => entry.id === session.id)) return current;
  current.openings = [session, ...current.openings].slice(0, OPENING_LIMIT);
  setState(current);
  return current;
}

export function clearOpenings(): SimState {
  const current = clone(getSnapshot());
  current.openings = [];
  setState(current);
  return current;
}

export function resetSim(): SimState {
  const settings = clone(getSnapshot()).settings;
  const next = { ...emptySimState(), settings };
  setState(next);
  return next;
}

export function updateSimSettings(patch: Partial<SimSettings>): SimState {
  const current = clone(getSnapshot());
  current.settings = { ...current.settings, ...patch };
  setState(current);
  return current;
}

export function getSimSnapshot(): SimState {
  return getSnapshot();
}

/* ------------------------------------------------------------------ */
/* Derived data                                                        */
/* ------------------------------------------------------------------ */

export interface SimStats {
  packsOpened: number;
  uniqueCards: number;
  totalCards: number;
  dupes: number;
  sets: { setId: string; setName: string; unique: number; pulls: number }[];
}

export function summariseSim(state: SimState): SimStats {
  const entries = Object.values(state.cards);
  const bySet = new Map<string, { setId: string; setName: string; unique: number; pulls: number }>();
  let totalCards = 0;

  for (const entry of entries) {
    totalCards += entry.quantity;
    const record = bySet.get(entry.card.setId) ?? {
      setId: entry.card.setId,
      setName: entry.card.setName,
      unique: 0,
      pulls: 0,
    };
    record.unique += 1;
    record.pulls += entry.quantity;
    bySet.set(entry.card.setId, record);
  }

  return {
    packsOpened: state.packsOpened,
    uniqueCards: entries.length,
    totalCards,
    dupes: Math.max(0, totalCards - entries.length),
    sets: [...bySet.values()].sort((a, b) => b.pulls - a.pulls),
  };
}

/** Rarest simulated pulls, best first. */
export function rarestPulls(state: SimState, limit = 12): SimCard[] {
  return Object.values(state.cards)
    .sort((a, b) => {
      const tierDelta = tierOrderIndex(b.card.tier) - tierOrderIndex(a.card.tier);
      if (tierDelta !== 0) return tierDelta;
      return b.quantity - a.quantity;
    })
    .slice(0, limit);
}

function tierOrderIndex(tier: string): number {
  const order = [
    "common",
    "uncommon",
    "rare",
    "holoRare",
    "prime",
    "legend",
    "lvX",
    "doubleRare",
    "ultraRare",
    "aceSpec",
    "radiant",
    "amazingRare",
    "shinyRare",
    "illustrationRare",
    "shinyUltraRare",
    "specialIllustrationRare",
    "hyperRare",
    "secretRare",
    "other",
  ];
  const index = order.indexOf(tier);
  return index === -1 ? 0 : index;
}

export function useSim() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    state,
    stats: summariseSim(state),
    record: recordPacks,
    recordOpening,
    clearOpenings,
    reset: resetSim,
    setSettings: updateSimSettings,
  };
}
