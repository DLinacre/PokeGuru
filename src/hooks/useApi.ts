import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CardSearchResult,
  DataSource,
  SearchFilters,
  TcgCard,
  TcgSet,
} from "../types/pokemon";
import {
  getCard,
  getSet,
  getSets,
  loadCardDetails,
  searchCards,
} from "../services/tcgdex";
import type { ExchangeRate } from "../services/currency";
import { getEurToGbpRate } from "../services/currency";
import { getCardValueGbp } from "../services/pricing";

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  source: DataSource | null;
  cachedAt?: number;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && /cancel/i.test(err.message);
}

/** Debounce a rapidly changing value (search-as-you-type). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Current EUR -> GBP rate (shared singleton request). */
export function useExchangeRate(): { rate: ExchangeRate | null; loading: boolean } {
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getEurToGbpRate()
      .then((value) => {
        if (active) setRate(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { rate, loading };
}

/* ------------------------------------------------------------------ */
/* Single card                                                         */
/* ------------------------------------------------------------------ */

export function useCard(id: string | undefined) {
  const [state, setState] = useState<QueryState<TcgCard>>({
    data: null,
    loading: Boolean(id),
    error: null,
    source: null,
  });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: "No card selected", source: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    getCard(id, { signal: controller.signal })
      .then(({ card, source, cachedAt }) => {
        if (!active) return;
        setState({ data: card, loading: false, error: null, source, cachedAt });
      })
      .catch((err: unknown) => {
        if (!active || isAbort(err)) return;
        setState({
          data: null,
          loading: false,
          error: errorMessage(err, "Failed to load this card."),
          source: null,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, retryKey]);

  return { ...state, retry: useCallback(() => setRetryKey((n) => n + 1), []) };
}

/* ------------------------------------------------------------------ */
/* Sets                                                                */
/* ------------------------------------------------------------------ */

export function useSets() {
  const [state, setState] = useState<QueryState<TcgSet[]>>({
    data: null,
    loading: true,
    error: null,
    source: null,
  });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    getSets(controller.signal)
      .then(({ sets, source, cachedAt }) => {
        if (!active) return;
        setState({ data: sets, loading: false, error: null, source, cachedAt });
      })
      .catch((err: unknown) => {
        if (!active || isAbort(err)) return;
        setState({
          data: null,
          loading: false,
          error: errorMessage(err, "Failed to load sets."),
          source: null,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryKey]);

  return { ...state, retry: useCallback(() => setRetryKey((n) => n + 1), []) };
}

export function useSet(id: string | undefined) {
  const [state, setState] = useState<QueryState<TcgSet>>({
    data: null,
    loading: Boolean(id),
    error: null,
    source: null,
  });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: "No set selected", source: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ data: null, loading: true, error: null, source: null });

    getSet(id, controller.signal)
      .then(({ set, source, cachedAt }) => {
        if (!active) return;
        setState({ data: set, loading: false, error: null, source, cachedAt });
      })
      .catch((err: unknown) => {
        if (!active || isAbort(err)) return;
        setState({
          data: null,
          loading: false,
          error: errorMessage(err, "Failed to load this set."),
          source: null,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, retryKey]);

  return { ...state, retry: useCallback(() => setRetryKey((n) => n + 1), []) };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export interface CardSearchState extends CardSearchResult {
  loading: boolean;
  enriching: boolean;
  error: string | null;
  source: DataSource | null;
  cachedAt?: number;
  retry: () => void;
}

const EMPTY_RESULT: CardSearchResult = {
  cards: [],
  page: 1,
  pageSize: 24,
  hasMore: false,
};

/**
 * Search cards with progressive enrichment.
 *
 * The list endpoint returns briefs; full details (prices, rarity, artist)
 * are fetched only for the cards on the current page, capped at a small
 * concurrency, and merged in as they arrive. Requests are aborted when the
 * filters change so stale responses can never overwrite newer ones.
 */
export function useCardSearch(filters: SearchFilters): CardSearchState {
  const [result, setResult] = useState<CardSearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [cachedAt, setCachedAt] = useState<number | undefined>(undefined);
  const [retryKey, setRetryKey] = useState(0);

  const key = useMemo(
    () =>
      JSON.stringify([
        filters.query,
        filters.category,
        filters.rarity,
        filters.setId,
        filters.illustrator ?? "",
        filters.sort,
        filters.page,
        filters.pageSize,
      ]),
    [filters]
  );
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setEnriching(false);
    setError(null);
    setResult(EMPTY_RESULT);

    const current = filtersRef.current;

    searchCards(current, { signal: controller.signal })
      .then((response) => {
        if (!active) return;
        setResult({
          cards: response.cards,
          page: response.page,
          pageSize: response.pageSize,
          hasMore: response.hasMore,
          totalCount: response.totalCount,
        });
        setSource(response.source);
        setCachedAt(response.cachedAt);
        setLoading(false);

        const ids = response.cards.map((card) => card.id);
        if (!ids.length) return;
        setEnriching(true);

        loadCardDetails(ids, {
          signal: controller.signal,
          concurrency: 5,
          onCard: (card) => {
            if (!active) return;
            setResult((prev) => ({
              ...prev,
              cards: prev.cards.map((existing) =>
                existing.id === card.id ? { ...existing, ...card } : existing
              ),
            }));
          },
        }).finally(() => {
          if (active) setEnriching(false);
        });
      })
      .catch((err: unknown) => {
        if (!active || isAbort(err)) return;
        setLoading(false);
        setError(errorMessage(err, "Search failed. Please try again."));
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `key` encodes every filter value that affects the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryKey]);

  return {
    ...result,
    loading,
    enriching,
    error,
    source,
    cachedAt,
    retry: useCallback(() => setRetryKey((n) => n + 1), []),
  };
}

/**
 * Client-side value sorting. Price sorting cannot be delegated to the search
 * API (briefs carry no pricing), so it ranks the current page only — the UI
 * says so explicitly. Cards without any price go last.
 */
export function sortCardsByValue(cards: TcgCard[], rate: ExchangeRate | null, direction: "asc" | "desc"): TcgCard[] {
  const withValue = cards.map((card) => ({ card, value: getCardValueGbp(card, rate) }));
  withValue.sort((a, b) => {
    if (a.value == null && b.value == null) return a.card.name.localeCompare(b.card.name);
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return direction === "desc" ? b.value - a.value : a.value - b.value;
  });
  return withValue.map((entry) => entry.card);
}
