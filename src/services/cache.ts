/**
 * Small, dependency-free persistent cache used for TCGdex + FX responses.
 *
 * - memory layer (instant, survives navigation)
 * - localStorage layer (survives reloads, shared between tabs)
 * - TTL per entry, with a bounded number of entries so we never blow the
 *   localStorage quota on large collections of search pages.
 */

const PREFIX = "pokeguru:cache:v1:";
const INDEX_KEY = `${PREFIX}index`;
const MAX_ENTRIES = 80;

interface Entry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

interface CacheHit<T> {
  value: T;
  storedAt: number;
  stale: boolean;
}

const memory = new Map<string, Entry<unknown>>();

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readIndex(): string[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(keys: string[]): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(keys.slice(-MAX_ENTRIES)));
  } catch {
    /* ignore quota errors */
  }
}

function evict(key: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Read a cached value without hitting the network. */
export function readCache<T>(key: string, options?: { allowStale?: boolean }): CacheHit<T> | null {
  const now = Date.now();
  const isFresh = (entry: Entry<unknown>) => entry.expiresAt > now;

  const mem = memory.get(key);
  if (mem && (isFresh(mem) || options?.allowStale)) {
    return { value: mem.value as T, storedAt: mem.storedAt, stale: !isFresh(mem) };
  }

  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (!isFresh(parsed) && !options?.allowStale) return null;
    memory.set(key, parsed as Entry<unknown>);
    return { value: parsed.value, storedAt: parsed.storedAt, stale: !isFresh(parsed) };
  } catch {
    return null;
  }
}

/** Persist a value with a TTL (ms). */
export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  const now = Date.now();
  const entry: Entry<T> = { value, storedAt: now, expiresAt: now + ttlMs };
  memory.set(key, entry as Entry<unknown>);

  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    const keys = readIndex();
    if (!keys.includes(key)) {
      keys.push(key);
      writeIndex(keys);
    }
  } catch {
    // Quota exceeded — drop the oldest persisted entries and retry once.
    const keys = readIndex();
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(evict);
    writeIndex(keys.slice(Math.ceil(keys.length / 2)));
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(entry));
      writeIndex([...readIndex(), key]);
    } catch {
      /* give up quietly; memory cache still works */
    }
  }
}

/** Remove everything this app cached. */
export function clearCache(): void {
  memory.clear();
  if (!storageAvailable()) return;
  try {
    readIndex().forEach(evict);
    window.localStorage.removeItem(INDEX_KEY);
    // Also clear entries from the previous cache implementation.
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("pokeguru_cache_"))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function cacheSize(): number {
  return memory.size;
}
