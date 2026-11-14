import { useSyncExternalStore } from "react";
import type { TcgCard } from "../types/pokemon";

/**
 * Collection vault store.
 *
 * A single shared store keeps every component (grid, card page, vault) in
 * sync — previously each component held its own copy, so adding a card on
 * one page was invisible elsewhere until a reload. Data lives in
 * localStorage and is mirrored across tabs via the `storage` event.
 *
 * Legacy entries written by v1.6 (pokemontcg.io card shape) are migrated
 * on load so existing collectors never lose their vault.
 */

export const COLLECTION_STORAGE_KEY = "pokeguru_collection";

export interface CollectionItem {
  card: TcgCard;
  addedAt: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let snapshot: CollectionItem[] = [];
let hydrated = false;

function normaliseLegacyCard(raw: unknown): TcgCard | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  if (!id || !name) return null;

  const images = (value.images ?? {}) as Record<string, unknown>;
  const legacySet = (value.set ?? {}) as Record<string, unknown>;
  const setId = typeof legacySet.id === "string" ? legacySet.id : id.split("-").slice(0, -1).join("-");
  const localId =
    typeof value.localId === "string"
      ? value.localId
      : typeof value.number === "string"
        ? value.number
        : id.split("-").pop() ?? "";

  return {
    id,
    name,
    localId,
    category: typeof value.category === "string" ? value.category : typeof value.supertype === "string" ? value.supertype : "Pokemon",
    rarity: typeof value.rarity === "string" ? value.rarity : undefined,
    illustrator: typeof value.artist === "string" ? value.artist : typeof value.illustrator === "string" ? value.illustrator : undefined,
    images: {
      small: typeof images.small === "string" ? images.small : undefined,
      large: typeof images.large === "string" ? images.large : undefined,
    },
    imageBase: typeof value.imageBase === "string" ? value.imageBase : undefined,
    set: {
      id: setId,
      name: typeof legacySet.name === "string" ? legacySet.name : "",
      series: typeof legacySet.series === "string" ? legacySet.series : undefined,
      releaseDate: typeof legacySet.releaseDate === "string" ? legacySet.releaseDate : undefined,
    },
    // Legacy USD prices are intentionally dropped: we cannot convert them
    // without the exchange rate that was in force when they were stored.
    pricing: undefined,
    isDetailed: false,
  };
}

function parseStored(raw: string): CollectionItem[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  const items: CollectionItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const card = normaliseLegacyCard(record.card);
    if (!card) continue;
    const addedAt = typeof record.addedAt === "number" ? record.addedAt : Date.now();
    items.push({ card, addedAt });
  }
  // De-duplicate by card id, keeping the earliest added timestamp.
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.card.id)) return false;
    seen.add(item.card.id);
    return true;
  });
}

function loadFromStorage(): CollectionItem[] {
  try {
    const raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return [];
    return parseStored(raw);
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("PokeGuru: could not save your collection (storage full or unavailable).", err);
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: CollectionItem[], options: { persist?: boolean } = {}): void {
  snapshot = next;
  if (options.persist !== false) persist();
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CollectionItem[] {
  if (!hydrated) {
    hydrated = true;
    snapshot = loadFromStorage();
  }
  return snapshot;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === COLLECTION_STORAGE_KEY) {
      hydrated = true;
      snapshot = loadFromStorage();
      emit();
    }
  });
}

export function addCardToCollection(card: TcgCard): void {
  const current = getSnapshot();
  if (current.some((item) => item.card.id === card.id)) return;
  setSnapshot([{ card, addedAt: Date.now() }, ...current]);
}

export function removeCardFromCollection(cardId: string): void {
  const current = getSnapshot();
  const next = current.filter((item) => item.card.id !== cardId);
  if (next.length === current.length) return;
  setSnapshot(next);
}

export function clearCollection(): void {
  setSnapshot([]);
}

/** Merge freshly fetched cards (prices etc.) into the stored snapshots. */
export function updateCollectionCards(cards: TcgCard[]): void {
  if (!cards.length) return;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const next = getSnapshot().map((item) => {
    const fresh = byId.get(item.card.id);
    return fresh ? { ...item, card: fresh } : item;
  });
  setSnapshot(next);
}

/** Read the current vault snapshot (used by tests and non-React callers). */
export function getCollectionSnapshot(): CollectionItem[] {
  return getSnapshot();
}

export function isCardInCollection(cardId: string): boolean {
  return getSnapshot().some((item) => item.card.id === cardId);
}

export function useCollection() {
  const collection = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    collection,
    addToCollection: addCardToCollection,
    removeFromCollection: removeCardFromCollection,
    clearCollection,
    updateCollectionCards,
    isInCollection: (cardId: string) => collection.some((item) => item.card.id === cardId),
  };
}
