import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterX, Info, SlidersHorizontal, X } from "lucide-react";
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
  filterHydratedPage,
  filtersFromParams,
  hasPageOnlyFilters,
  PRINTING_OPTIONS,
  RARITY_OPTIONS,
  SEARCH_PAGE_SIZE,
  SORT_OPTIONS,
} from "../utils/search";
import { getCardValueGbp } from "../services/pricing";
import { cn } from "../utils/cn";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const { rate } = useExchangeRate();
  const online = useOnlineStatus();
  const { data: sets } = useSets();

  const [queryInput, setQueryInput] = useState(filters.query);
  const debouncedQuery = useDebouncedValue(queryInput, 350);
  const [numberInput, setNumberInput] = useState(filters.number ?? "");
  const [illustratorInput, setIllustratorInput] = useState(filters.illustrator ?? "");
  const debouncedNumber = useDebouncedValue(numberInput, 450);
  const debouncedIllustrator = useDebouncedValue(illustratorInput, 450);

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

  useEffect(() => {
    setNumberInput(filters.number ?? "");
  }, [filters.number]);

  useEffect(() => {
    setIllustratorInput(filters.illustrator ?? "");
  }, [filters.illustrator]);

  useEffect(() => {
    const typed = debouncedNumber.trim();
    if (typed === (filters.number ?? "")) return;
    setSearchParams(applyParamUpdates(searchParams, { number: typed }), { replace: true });
  }, [debouncedNumber, filters.number, searchParams, setSearchParams]);

  useEffect(() => {
    const typed = debouncedIllustrator.trim();
    if (typed === (filters.illustrator ?? "")) return;
    setSearchParams(applyParamUpdates(searchParams, { illustrator: typed }), { replace: true });
  }, [debouncedIllustrator, filters.illustrator, searchParams, setSearchParams]);

  const search = useCardSearch(filters);
  const valueSortActive = filters.sort === "value_high" || filters.sort === "value_low";
  const showSkeletons = search.loading || (valueSortActive && search.enriching);

  const sortedCards = useMemo(() => {
    if (!valueSortActive) return search.cards;
    return sortCardsByValue(search.cards, rate, filters.sort === "value_low" ? "asc" : "desc");
  }, [search.cards, valueSortActive, filters.sort, rate]);

  const pageOnly = hasPageOnlyFilters(filters);
  const visibleCards = useMemo(() => {
    if (!pageOnly) return sortedCards;
    const rows = sortedCards.map((card) => ({ card }));
    return filterHydratedPage(rows, filters, (row) => getCardValueGbp(row.card, rate)).map((row) => row.card);
  }, [sortedCards, pageOnly, filters, rate]);

  const update = (updates: Record<string, string | number | undefined>) => {
    setSearchParams(applyParamUpdates(searchParams, updates));
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (filters.query) next.set("q", filters.query);
    setSearchParams(next);
  };

  const activeChips = [
    filters.category ? { key: "category", label: CATEGORY_OPTIONS.find((o) => o.value === filters.category)?.label ?? filters.category } : null,
    filters.rarity ? { key: "rarity", label: RARITY_OPTIONS.find((o) => o.value === filters.rarity)?.label ?? filters.rarity } : null,
    filters.setId ? { key: "set", label: sets?.find((s) => s.id === filters.setId)?.name ?? filters.setId } : null,
    filters.illustrator ? { key: "illustrator", label: `Illustrator: ${filters.illustrator}` } : null,
    filters.number ? { key: "number", label: `Collector #${filters.number}` } : null,
    filters.printing
      ? { key: "printing", label: PRINTING_OPTIONS.find((o) => o.value === filters.printing)?.label ?? filters.printing }
      : null,
    filters.minValue || filters.maxValue
      ? { key: "price", label: `£${filters.minValue || "0"}–${filters.maxValue ? `£${filters.maxValue}` : "any"}`, clears: ["min", "max"] }
      : null,
  ].filter(Boolean) as { key: string; label: string; clears?: string[] }[];

  const removeChip = (chip: { key: string; clears?: string[] }) => {
    if (chip.clears) {
      update(Object.fromEntries(chip.clears.map((key) => [key, ""])));
      return;
    }
    update({ [chip.key]: "" });
  };

  const hasFilters = Boolean(
    filters.category || filters.rarity || filters.setId || filters.sort !== "name" || filters.illustrator || filters.number || pageOnly
  );
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
      <div className="sticky top-[64px] z-20 mb-6 rounded-2xl border border-[var(--border)] bg-[rgba(16,19,25,0.88)] p-3 shadow-xl backdrop-blur-xl sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            <SlidersHorizontal size={12} aria-hidden="true" />
            Filters
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] transition-colors hover:text-[var(--accent-text)]"
            >
              <FilterX size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="flex flex-col gap-1 sm:col-span-2 xl:col-span-2">
            <label htmlFor="filter-query" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Card name
            </label>
            <input
              id="filter-query"
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="e.g. Charizard"
              autoComplete="off"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-number" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Collector no.
            </label>
            <input
              id="filter-number"
              type="text"
              inputMode="numeric"
              value={numberInput}
              onChange={(event) => setNumberInput(event.target.value)}
              placeholder="e.g. 136"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-illustrator" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Illustrator
            </label>
            <input
              id="filter-illustrator"
              type="text"
              value={illustratorInput}
              onChange={(event) => setIllustratorInput(event.target.value)}
              placeholder="e.g. Mitsuhiro Arita"
              autoComplete="off"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-set" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Set
            </label>
            <select id="filter-set" value={filters.setId} onChange={(event) => update({ set: event.target.value })} className="field">
              <option value="">All sets</option>
              {sets?.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Category
            </label>
            <select id="filter-category" value={filters.category} onChange={(event) => update({ category: event.target.value })} className="field">
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
            <select id="filter-rarity" value={filters.rarity} onChange={(event) => update({ rarity: event.target.value })} className="field">
              {RARITY_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-printing" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Printing <span className="font-medium normal-case tracking-normal text-[var(--muted-dim)]">(this page)</span>
            </label>
            <select id="filter-printing" value={filters.printing ?? ""} onChange={(event) => update({ printing: event.target.value })} className="field">
              {PRINTING_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-min" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Min £ <span className="font-medium normal-case tracking-normal text-[var(--muted-dim)]">(this page)</span>
            </label>
            <input
              id="filter-min"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={filters.minValue ?? ""}
              onChange={(event) => update({ min: event.target.value })}
              placeholder="0"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-max" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Max £ <span className="font-medium normal-case tracking-normal text-[var(--muted-dim)]">(this page)</span>
            </label>
            <input
              id="filter-max"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={filters.maxValue ?? ""}
              onChange={(event) => update({ max: event.target.value })}
              placeholder="Any"
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sort" className="ml-1 text-[9px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Sort
            </label>
            <select id="filter-sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value })} className="field">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeChips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Active filters">
            {activeChips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="chip group inline-flex items-center gap-1"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  {chip.label}
                  <X size={11} aria-hidden="true" className="opacity-60 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        )}
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
          <p className="mb-3 text-xs text-[var(--muted)]">
            {pageOnly
              ? `${visibleCards.length} of ${sortedCards.length} cards on this page match the price/printing filters. These filters cannot scan the whole result set — the search API returns no prices in list results.`
              : "Prices are Cardmarket reference values converted with a dated daily rate."}
          </p>
          {visibleCards.length > 0 ? (
            <CardGrid cards={visibleCards} rate={rate} priorityCount={6} />
          ) : (
            <EmptyState
              icon={<FilterX size={40} />}
              title="No cards on this page match"
              description="Price and printing filters only apply to the cards loaded on this page. Try another page, widen the price range, or clear the page filters."
              action={{ label: "Clear page filters", onClick: () => update({ min: "", max: "", printing: "" }) }}
            />
          )}
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
