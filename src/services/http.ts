/**
 * HTTP helpers: caching, in-flight de-duplication, timeouts and retries.
 */

import { readCache, writeCache } from "./cache";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "network" | "not-found" | "server" | "aborted" | "timeout" = "server"
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Cache TTL in ms. Use 0 to bypass the cache. */
  ttlMs?: number;
  /** Cache key. Defaults to the URL. */
  cacheKey?: string;
  timeoutMs?: number;
  /** Retry on network/5xx failures. Defaults to 1 retry. */
  retries?: number;
}

interface CachedPayload<T> {
  data: T;
  /** expose total count style headers we care about */
  headers?: Record<string, string>;
}

const inflight = new Map<string, Promise<CachedPayload<unknown>>>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Fetch JSON. Resolves with the parsed body plus a `fromCache` flag.
 * Caller-facing abort signals are intentionally *not* used for the shared
 * de-duplicated request: aborting one consumer must not cancel the request
 * another consumer is waiting on. Aborted consumers simply ignore the result.
 */
export async function fetchJson<T>(
  url: string,
  options: RequestOptions = {}
): Promise<{ data: T; fromCache: boolean; cachedAt?: number; stale?: boolean; headers: Record<string, string> }> {
  const { signal, ttlMs = 0, timeoutMs = 15_000, retries = 1 } = options;
  const cacheKey = options.cacheKey ?? url;

  if (signal?.aborted) {
    throw new ApiError("Request cancelled", 0, "aborted");
  }

  const cached = ttlMs > 0 ? readCache<CachedPayload<T>>(cacheKey) : null;
  if (cached) {
    return { data: cached.value.data, fromCache: true, cachedAt: cached.storedAt, headers: cached.value.headers ?? {} };
  }

  let shared = inflight.get(cacheKey) as Promise<CachedPayload<T>> | undefined;

  if (!shared) {
    shared = (async () => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
            // Cache-busting is unnecessary: we do our own caching.
            credentials: "omit",
            mode: "cors",
          });

          if (!response.ok) {
            if (response.status === 404) {
              throw new ApiError("Not found", 404, "not-found");
            }
            if (response.status === 429) {
              throw new ApiError("The card database is rate-limiting requests. Please try again shortly.", 429, "server");
            }
            throw new ApiError(
              `The card database returned an error (${response.status}). Please try again.`,
              response.status,
              "server"
            );
          }

          const data = (await response.json()) as T;
          const headers: Record<string, string> = {
            "x-total-count": response.headers.get("x-total-count") ?? "",
          };
          const payload = { data, headers };
          if (ttlMs > 0) writeCache(cacheKey, payload, ttlMs);
          return payload;
        } catch (err) {
          lastError = err;
          // 4xx answers are definitive: retrying cannot help and would double
          // the request count. Only network, timeout and 5xx/429 errors retry.
          const retryable =
            !(err instanceof ApiError) ||
            err.status === 0 ||
            err.status === 429 ||
            err.status >= 500;
          if (!retryable) throw err;
          if (attempt < retries) {
            await delay(350 * (attempt + 1));
            continue;
          }
          if (controller.signal.aborted) {
            throw new ApiError("The request timed out. Please check your connection and try again.", 0, "timeout");
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }
      }

      throw lastError;
    })()
      .catch((err: unknown) => {
        if (err instanceof ApiError) throw err;
        if (isAbortError(err)) {
          throw new ApiError("Request cancelled", 0, "aborted");
        }
        throw new ApiError(
          "Could not reach the card database. Check your connection and try again.",
          0,
          "network"
        );
      })
      .finally(() => {
        inflight.delete(cacheKey);
      }) as Promise<CachedPayload<T>>;

    inflight.set(cacheKey, shared);
  }

  try {
    const payload = await shared;
    return { data: payload.data, fromCache: false, headers: payload.headers ?? {} };
  } catch (err) {
    // Graceful degradation: serve an expired cached copy when offline.
    if (ttlMs > 0) {
      const stale = readCache<CachedPayload<T>>(cacheKey, { allowStale: true });
      if (stale) {
        return {
          data: stale.value.data,
          fromCache: true,
          cachedAt: stale.storedAt,
          stale: true,
          headers: stale.value.headers ?? {},
        };
      }
    }
    throw err;
  }
}

/** Wrap a caller's signal so we can also abort while awaiting a shared promise. */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new ApiError("Request cancelled", 0, "aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ApiError("Request cancelled", 0, "aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}
