/**
 * React bindings for the Pack Opening Simulator.
 *
 * The catalogue is derived from the cached TCGdex set index, so opening the
 * simulator does not trigger a second set download. Pools are built only for
 * the expansion a user actually opens.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TcgSet } from "../types/pokemon";
import type { PackConfig, PackPool } from "../types/packs";
import { getSet } from "../services/tcgdex";
import { buildPackPool, clearPoolMemo, PackPoolError } from "../services/packPools";
import { loadPackCatalogue, type CatalogueEntry } from "../services/packCatalogue";
import { resolvePackConfig, seriesIdFromName } from "../data/packRules";

export type PackCatalogueEntry = CatalogueEntry;

/**
 * The catalogue comes from one cached request per TCGdex series, so browsing
 * the simulator never downloads the full card index.
 */
export function usePackCatalogue() {
  const [entries, setEntries] = useState<CatalogueEntry[]>([]);
  const [series, setSeries] = useState<{ id: string; name: string; count: number }[]>([]);
  const [failedSeries, setFailedSeries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    loadPackCatalogue(controller.signal)
      .then((loaded) => {
        if (!active) return;
        setEntries(loaded.entries);
        setSeries(loaded.seriesAvailable);
        setFailedSeries(loaded.failedSeries);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error && err.message ? err.message : "The pack catalogue could not be loaded.");
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey]);

  const years = useMemo(() => {
    const values = new Set<number>();
    for (const pack of entries) {
      if (!pack.releaseDate) continue;
      const year = new Date(pack.releaseDate).getUTCFullYear();
      if (Number.isFinite(year)) values.add(year);
    }
    return [...values].sort((a, b) => b - a);
  }, [entries]);

  return {
    packs: entries,
    series,
    years,
    failedSeries,
    loading,
    error,
    retry: useCallback(() => setRetryKey((value) => value + 1), []),
  };
}

export interface PackPoolState {
  set: TcgSet | null;
  config: PackConfig | null;
  pool: PackPool | null;
  loading: boolean;
  error: string | null;
  progress: { done: number; total: number } | null;
}

const EMPTY_POOL_STATE: PackPoolState = {
  set: null,
  config: null,
  pool: null,
  loading: false,
  error: null,
  progress: null,
};

export function usePackPool(setId: string | undefined) {
  const [state, setState] = useState<PackPoolState>(EMPTY_POOL_STATE);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!setId) {
      setState(EMPTY_POOL_STATE);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState({ ...EMPTY_POOL_STATE, loading: true });

    (async () => {
      try {
        const { set } = await getSet(setId, controller.signal);
        if (!active) return;
        const config = resolvePackConfig({ id: set.id, seriesId: seriesIdFromName(set.series) });
        if (!config) {
          setState({
            ...EMPTY_POOL_STATE,
            set,
            error: "This expansion is not sold in booster packs, so there is no honest pack to simulate.",
          });
          return;
        }
        setState({ ...EMPTY_POOL_STATE, set, config, loading: true, progress: { done: 0, total: 1 } });

        const pool = await buildPackPool(set, config, {
          signal: controller.signal,
          onProgress: (done, total) => {
            if (active) setState((prev) => ({ ...prev, progress: { done, total } }));
          },
        });
        if (!active) return;
        setState({ set, config, pool, loading: false, error: null, progress: null });
      } catch (err) {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof PackPoolError
            ? err.message
            : err instanceof Error && err.message
              ? err.message
              : "The pack could not be prepared. Please try again.";
        setState((prev) => ({ ...prev, loading: false, error: message, progress: null }));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [setId, retryKey]);

  const retry = useCallback(() => {
    clearPoolMemo();
    setRetryKey((value) => value + 1);
  }, []);

  return { ...state, retry };
}
