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
import type { PackResult, PulledCard, SimCard, SimSettings, SimState } from "../types/packs";

export const SIM_STORAGE_KEY = "pokeguru_pack_sim_v1";
const HISTORY_LIMIT = 40;

const DEFAULT_SETTINGS: SimSettings = {
  sound: true,
  reduceMotion: false,
  wrapperStyle: "crimson",
};

export function emptySimState(): SimState {
  return {
    version: 1,
    cards: {},
    packsOpened: 0,
    history: [],
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
  } catch (err) {
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
    reset: resetSim,
    setSettings: updateSimSettings,
  };
}
