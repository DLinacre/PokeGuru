/**
 * FX conversion — Frankfurter v2 (https://frankfurter.dev)
 *
 * Free, key-less, ECB-backed reference rates. We never hard-code a rate: if
 * the API is unavailable and nothing is cached, GBP prices are reported as
 * unavailable instead of being invented.
 */

import { fetchJson } from "./http";
import { readCache, writeCache } from "./cache";

const FX_BASE = "https://api.frankfurter.dev";
const FX_CACHE_KEY = "fx:eur-gbp";
/** Rates are published once per working day; a 12h freshness window is plenty. */
const FX_TTL = 12 * 60 * 60 * 1000;
const FX_STORAGE_KEY = "pokeguru:fx:eur-gbp:v1";

export interface ExchangeRate {
  /** EUR -> GBP multiplier. */
  rate: number;
  /** Date the rate is valid for (YYYY-MM-DD, from Frankfurter). */
  date: string;
  base: "EUR";
  quote: "GBP";
  fetchedAt: number;
  source: "network" | "cache";
}

interface FrankfurterRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

let inFlight: Promise<ExchangeRate | null> | null = null;

function isPlausible(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0.1 && rate < 5;
}

function readPersisted(): ExchangeRate | null {
  try {
    const raw = window.localStorage.getItem(FX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExchangeRate;
    if (!parsed || !isPlausible(parsed.rate) || typeof parsed.date !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(rate: ExchangeRate): void {
  try {
    window.localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(rate));
  } catch {
    /* ignore quota */
  }
}

/**
 * Resolve the current EUR -> GBP rate.
 * Returns null when no live or cached rate is available — callers must show
 * "No Data Available" rather than a made-up conversion.
 */
export async function getEurToGbpRate(options: { signal?: AbortSignal; forceRefresh?: boolean } = {}): Promise<ExchangeRate | null> {
  const cached = readCache<ExchangeRate>(FX_CACHE_KEY);
  if (cached && !options.forceRefresh) {
    return { ...cached.value, source: "cache" };
  }

  if (inFlight && !options.forceRefresh) return inFlight;

  inFlight = (async (): Promise<ExchangeRate | null> => {
    try {
      const { data } = await fetchJson<FrankfurterRate[]>(
        `${FX_BASE}/v2/rates?base=EUR&quotes=GBP`,
        { ttlMs: 0, retries: 1, timeoutMs: 8000 }
      );
      const match = Array.isArray(data) ? data.find((r) => r.quote === "GBP" && isPlausible(r.rate)) : undefined;
      if (!match) throw new Error("Unexpected FX payload");

      const exchange: ExchangeRate = {
        rate: match.rate,
        date: match.date,
        base: "EUR",
        quote: "GBP",
        fetchedAt: Date.now(),
        source: "network",
      };
      writeCache(FX_CACHE_KEY, exchange, FX_TTL);
      persist(exchange);
      return exchange;
    } catch {
      const persisted = readPersisted();
      if (persisted) {
        // Refresh the freshness window for the in-memory/persistent cache so
        // we do not hammer a failing endpoint on every render, but keep the
        // original rate date visible to the user.
        writeCache(FX_CACHE_KEY, persisted, FX_TTL);
        return { ...persisted, source: "cache" };
      }
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return options.signal ? raceSignal(inFlight, options.signal) : inFlight;
}

function raceSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.resolve(null as unknown as T);
  return new Promise<T>((resolve) => {
    const done = (value: T) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => resolve(null as unknown as T);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(done, () => done(null as unknown as T));
  });
}

/** Convert an EUR amount to GBP using a fetched rate. Never invents a rate. */
export function eurToGbp(amountEur: number | undefined | null, exchange: ExchangeRate | null): number | null {
  if (amountEur == null || !Number.isFinite(amountEur) || !exchange || !isPlausible(exchange.rate)) {
    return null;
  }
  return amountEur * exchange.rate;
}

/** For tests/dev tooling only. */
export function resetExchangeRateCache(): void {
  inFlight = null;
  try {
    window.localStorage.removeItem(FX_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
