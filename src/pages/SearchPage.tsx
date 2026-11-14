import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterX, Info, SlidersHorizontal } from "lucide-react";
import { sortCardsByValue, useCardSearch, useDebouncedValue, useExchangeRate, useSets } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import CardGrid from "../components/Cards/CardGrid";
import SkeletonGrid from "../components/UI/SkeletonGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import Pagination from "../components/UI/Pagination";
import { EmptyState } from "../components/UI/EmptyState";
import { CachedBadge, OfflineBadge } from "../components/UI/DataBadges";
import { useOnlineStatus } from "../hooks/useOnline";
import {
  applyParamUpdates,
  CATEGORY_OPTIONS,
  filtersFromParams,
  RARITY_OPTIONS,
  SEARCH_PAGE_SIZE,
  SORT_OPTIONS,
} from "../utils/search";
import { cn } from "../utils/cn";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const { rate } = useExchangeRate();
  const online = useOnlineStatus();
  const { data: sets } = useSets();

  const [queryInput, setQueryInput] = useState(filters.query);
  const debouncedQuery = useDebouncedValue(queryInput, 350);

  const metaTitle = filters.query ? `Search: ${filters.query}` : "Card search";
  usePageMeta({
    title: metaTitle,
    description: filters.query
      ? `Pokémon TCG cards matching “${filters.query}” with Cardmarket reference prices in GBP.`
      : "Search the Pokémon TCG card database by name, set, rarity and category.",
    path: `/search${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
  });

  // Keep the input in sync when navigation changes the URL (e.g. header search).
  useEffect(() => {
    setQueryInput(filters.query);
  }, [filters.query]);

  // Debounced query -> URL (replace so typing does not flood history).
  useEffect(() => {
    const typed = debouncedQuery.trim();
    if (typed === filters.query) return;
    const next = applyParamUpdates(searchParams, { q: typed });
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, filters.query, searchParams, setSearchParams]);

  const search = useCardSearch(filters);
  const valueSortActive = filters.sort === "value_high" || filters.sort === "value_low";
  const showSkeletons = search.loading || (valueSortActive && search.enriching);

  const sortedCards = useMemo(() => {
    if (!valueSortActive) return search.cards;
    return sortCardsByValue(search.cards, rate, filters.sort === "value_low" ? "asc" : "desc");
  }, [search.cards, valueSortActive, filters.sort, rate]);

  const update = (updates: Record<string, string | number | undefined>) => {
    setSearchParams(applyParamUpdates(searchParams, updates));
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (filters.query) next.set("q", filters.query);
    setSearchParams(next);
  };

  const hasFilters = Boolean(filters.category || filters.rarity || filters.setId || filters.sort !== "name");
  const sortNote = SORT_OPTIONS.find((option) => option.value === filters.sort)?.note;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {filters.query ? `Results for “${filters.query}”` : "Card search"}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {search.loading
              ? "Searching the card database…"
              : search.cards.length
                ? `${search.totalCount != null ? `${search.totalCount.toLocaleString()} matching cards · ` : ""}showing ${search.cards.length} on page ${filters.page}`
                : "No cards to display"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!online && <OfflineBadge />}
          <CachedBadge source={search.source} cachedAt={search.cachedAt} />
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-[64px] z-20 mb-6 rounded-2xl border border-[var(--border)] bg-[rgba(30,34,48,0.85)] p-3 shadow-xl backdrop-blur-xl sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            <SlidersHorizontal size={12} aria-hidden="true" />
            Filters
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
            >
              <FilterX size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Category
            </label>
            <select
              id="filter-category"
              value={filters.category}
              onChange={(event) => update({ category: event.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-rarity" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Rarity
            </label>
            <select
              id="filter-rarity"
              value={filters.rarity}
              onChange={(event) => update({ rarity: event.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {RARITY_OPTIONS.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {rarity || "All rarities"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-set" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Set
            </label>
            <select
              id="filter-set"
              value={filters.setId}
              onChange={(event) => update({ set: event.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="">All sets</option>
              {sets?.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sort" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Sort
            </label>
            <select
              id="filter-sort"
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label htmlFor="filter-query" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Card name
            </label>
            <input
              id="filter-query"
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="e.g. Charizard"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)]/70 px-3 py-2 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {sortNote && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3 text-xs text-[var(--muted)]">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {sortNote} Price sorting cannot scan the whole result set because the search API does not expose prices.
        </p>
      )}

      {showSkeletons && (
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">
            {search.loading ? "Loading search results" : "Loading prices to sort this page"}
          </span>
          <SkeletonGrid count={SEARCH_PAGE_SIZE} />
        </div>
      )}

      {search.error && !showSkeletons && (
        <ErrorMessage
          message={search.error}
          onRetry={search.retry}
          hint="If you are offline, previously visited cards may still be available."
        />
      )}

      {!showSkeletons && !search.error && search.cards.length > 0 && (
        <>
          <CardGrid cards={sortedCards} rate={rate} priorityCount={6} />
          <Pagination
            currentPage={filters.page}
            pageSize={SEARCH_PAGE_SIZE}
            totalItems={search.totalCount}
            hasNextPage={search.hasMore}
            onPageChange={(page) => {
              update({ page });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}

      {!showSkeletons && !search.error && search.cards.length === 0 && (
        <EmptyState
          icon={<FilterX size={40} />}
          title={filters.query ? `No cards match “${filters.query}”` : "No cards match these filters"}
          description="Try a shorter name, remove a rarity or category filter, or browse a set directly."
          action={{ label: hasFilters ? "Clear filters" : "Browse sets", to: hasFilters ? undefined : "/sets", onClick: hasFilters ? clearFilters : undefined }}
        />
      )}

      <p className={cn("mt-6 text-center text-[11px] text-[var(--muted)]")}>
        Prices shown are Cardmarket reference prices converted to GBP with a dated daily exchange rate. Missing
        prices are shown as “No Data Available”.
      </p>
    </div>
  );
}
