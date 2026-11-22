/**
 * Progressive pack valuation.
 *
 * The opening experience must never wait for prices: cards flip immediately,
 * values appear underneath them as they resolve, and the running total only
 * ever counts prices that are actually known.
 *
 * Guarantees this hook provides
 * -----------------------------
 *  - **One request per unique card id**, shared with the rest of the app by the
 *    existing TCGdex cache and in-flight de-duplication. A card pulled in three
 *    packs costs one request, and a repeat visit costs none.
 *  - **Bounded concurrency** (4 by default) so a 36-pack session cannot flood a
 *    free public API.
 *  - **Lazy work**: only packs the visitor has reached are enqueued, so the
 *    prices for pack 30 are not fetched while pack 1 is still sealed.
 *  - **Stale responses are dropped.** Each run carries a token; responses from
 *    a previous pack, session or set are ignored, so a slow request can never
 *    price a card in a different opening.
 *  - **Failures are data, not silence.** A failed lookup becomes an
 *    `unavailable` value with a reason, and can be retried.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PackResult, PulledCard, PullValuation } from "../types/packs";
import type { ExchangeRate } from "../services/currency";
import { loadCardDetails } from "../services/tcgdex";
import {
  finishOf,
  quoteForPull,
  summariseValues,
  toPullValuation,
  valuationKey,
  type QuoteState,
} from "../services/packValues";

export interface PackValuesApi {
  /** Valuations keyed by `${cardId}|${finish}`. */
  values: Record<string, PullValuation>;
  /** True while at least one requested price is still loading. */
  loading: boolean;
  /** Number of lookups that failed (they are still shown as unavailable). */
  failures: number;
  /** Valuation for one pull, or null while it is still pending. */
  valueFor: (card: Pick<PulledCard, "id" | "treatment">) => PullValuation | null;
  /** Totals for a set of pulls; unvalued cards count as pending. */
  totalsFor: (cards: PackResult["cards"]) => ReturnType<typeof summariseValues>;
  /** Ask for the prices of these packs (idempotent). */
  requestPacks: (indexes: number[]) => void;
  /** Re-run lookups that failed. */
  retry: () => void;
}

interface UsePackValuesOptions {
  results: PackResult[];
  rate: ExchangeRate | null;
  /** Packs whose prices should be requested now, in priority order. */
  activeIndex?: number;
  /** Request every pack (used when the summary opens). */
  all?: boolean;
  enabled?: boolean;
  concurrency?: number;
}

export function usePackValues({
  results,
  rate,
  activeIndex = 0,
  all = false,
  enabled = true,
  concurrency = 4,
}: UsePackValuesOptions): PackValuesApi {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [pending, setPending] = useState<string[]>([]);
  const [failures, setFailures] = useState(0);

  /** Bumped whenever the results change: older responses are discarded. */
  const runRef = useRef(0);
  /** Card ids already attempted in this run, so nothing is fetched twice. */
  const requestedRef = useRef(new Set<string>());
  const bufferRef = useRef<Record<string, QuoteState>>({});
  const flushRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const flush = useCallback(() => {
    if (flushRef.current) return;
    flushRef.current = window.setTimeout(() => {
      flushRef.current = null;
      const batch = bufferRef.current;
      bufferRef.current = {};
      const keys = Object.keys(batch);
      if (!keys.length) return;
      // Quote state and pending state are updated together so `loading` never
      // goes false while prices are still sitting in the buffer — a summary
      // would otherwise be snapshotted as "nothing priced".
      setQuotes((previous) => ({ ...previous, ...batch }));
      setPending((previous) => previous.filter((key) => !keys.includes(key)));
    }, 80);
  }, []);

  /** Everything the current results need, per finish. */
  const wanted = useMemo(() => {
    const byCard = new Map<string, Set<PullValuation["finish"]>>();
    for (const result of results) {
      for (const card of result.cards) {
        const finish = finishOf(card);
        const set = byCard.get(card.id) ?? new Set<PullValuation["finish"]>();
        set.add(finish);
        byCard.set(card.id, set);
      }
    }
    return byCard;
  }, [results]);

  // A new set of results starts a new run: forget everything from the last one.
  useEffect(() => {
    runRef.current += 1;
    requestedRef.current = new Set();
    bufferRef.current = {};
    controllerRef.current?.abort();
    controllerRef.current = null;
    setQuotes({});
    setPending([]);
    setFailures(0);
    return () => {
      controllerRef.current?.abort();
    };
    // `results` identity changes on every generated session.
  }, [results]);

  const request = useCallback(
    (ids: string[]) => {
      if (!enabled) return;
      const fresh = ids.filter((id) => !requestedRef.current.has(id));
      if (!fresh.length) return;
      fresh.forEach((id) => requestedRef.current.add(id));

      const run = runRef.current;
      const controller = controllerRef.current ?? new AbortController();
      controllerRef.current = controller;

      const keys = fresh.flatMap((id) =>
        [...(wanted.get(id) ?? [])].map((finish) => valuationKey(id, finish))
      );
      setPending((previous) => [...previous, ...keys]);

      const settle = (batch: Record<string, QuoteState>) => {
        if (runRef.current !== run) return; // a newer pack/session owns the UI
        Object.assign(bufferRef.current, batch);
        flush();
        if (Object.values(batch).some((entry) => entry.kind === "error")) {
          setFailures((count) => count + 1);
        }
      };

      void loadCardDetails(fresh, {
        concurrency,
        signal: controller.signal,
        onCard: (card) => {
          const finishes = wanted.get(card.id) ?? new Set<PullValuation["finish"]>();
          const batch: Record<string, QuoteState> = {};
          for (const finish of finishes) {
            batch[valuationKey(card.id, finish)] = quoteForPull(card, finish);
          }
          settle(batch);
        },
        onError: (id, error) => {
          // Aborting on unmount is not a failure worth showing.
          if (controller.signal.aborted) return;
          const finishes = wanted.get(id) ?? new Set<PullValuation["finish"]>();
          const message = error instanceof Error && error.message ? error.message : "Request failed";
          const batch: Record<string, QuoteState> = {};
          for (const finish of finishes) {
            batch[valuationKey(id, finish)] = { kind: "error", message };
          }
          settle(batch);
        },
      });
    },
    [concurrency, enabled, flush, wanted]
  );

  // Enqueue: the pack being opened first, then (once the summary opens) the rest.
  useEffect(() => {
    if (!results.length || !enabled) return;
    const limit = all ? results.length : Math.min(results.length, activeIndex + 1);
    const ids: string[] = [];
    for (let index = 0; index < limit; index += 1) {
      for (const card of results[index].cards) ids.push(card.id);
    }
    request([...new Set(ids)]);
  }, [results, all, activeIndex, enabled, request]);

  // Revalue when the FX rate arrives, from the quotes already resolved. A key
  // with no quote is still pending and therefore has no valuation at all.
  const values = useMemo(() => {
    const map: Record<string, PullValuation> = {};
    for (const result of results) {
      for (const card of result.cards) {
        const key = valuationKey(card.id, finishOf(card));
        if (map[key]) continue;
        const state = quotes[key];
        if (!state) continue;
        map[key] = toPullValuation(card, state, rate);
      }
    }
    return map;
  }, [quotes, results, rate]);

  const valueFor = useCallback(
    (card: Pick<PulledCard, "id" | "treatment">) =>
      values[valuationKey(card.id, finishOf(card))] ?? null,
    [values]
  );

  const totalsFor = useCallback(
    (cards: PackResult["cards"]) => summariseValues(cards.map((card) => valueFor(card))),
    [valueFor]
  );

  const requestPacks = useCallback(
    (indexes: number[]) => {
      const ids: string[] = [];
      for (const index of indexes) {
        for (const card of results[index]?.cards ?? []) ids.push(card.id);
      }
      request([...new Set(ids)]);
    },
    [request, results]
  );

  const retry = useCallback(() => {
    const failedKeys = Object.keys(quotes).filter((key) => quotes[key].kind === "error");
    if (!failedKeys.length) return;
    const failedIds = new Set(failedKeys.map((key) => key.split("|")[0]));
    failedIds.forEach((id) => requestedRef.current.delete(id));
    setQuotes((previous) => {
      const next = { ...previous };
      for (const key of failedKeys) delete next[key];
      return next;
    });
    setFailures(0);
    controllerRef.current = new AbortController();
    request([...failedIds]);
  }, [quotes, request]);

  return {
    values,
    loading: pending.length > 0,
    failures,
    valueFor,
    totalsFor,
    requestPacks,
    retry,
  };
}
