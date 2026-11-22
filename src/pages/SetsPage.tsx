import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Layers, Search, TriangleAlert } from "lucide-react";
import { useSets } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import SetTile from "../components/Sets/SetTile";
import SkeletonGrid from "../components/UI/SkeletonGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import { EmptyState } from "../components/UI/EmptyState";
import { CachedBadge } from "../components/UI/DataBadges";
import { enrichSetWithWikiMeta, seriesOptions } from "../utils/setMeta";
import { applyParamUpdates } from "../utils/search";

type SetSort = "newest" | "oldest" | "name";

function parseSort(value: string | null): SetSort {
  return value === "oldest" || value === "name" ? value : "newest";
}

export default function SetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: sets, loading, error, source, cachedAt, retry } = useSets();

  const query = searchParams.get("q") ?? "";
  const era = searchParams.get("era") ?? "";
  const sort = parseSort(searchParams.get("sort"));

  usePageMeta({
    title: "Every Pokémon TCG expansion",
    description:
      "Browse every Pokémon TCG expansion with release dates, set logos and card counts, then open any set to see its cards and reference values.",
    path: "/sets",
  });

  const merged = useMemo(() => (sets ?? []).map(enrichSetWithWikiMeta), [sets]);
  const eraOptions = useMemo(() => seriesOptions(merged), [merged]);

  const filtered = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    const matches = merged.filter((set) => {
      const matchesQuery = !normalisedQuery || set.name.toLowerCase().includes(normalisedQuery);
      const matchesEra = !era || set.series === era;
      return matchesQuery && matchesEra;
    });

    const withDates = matches.map((set, index) => ({ set, index }));
    withDates.sort((a, b) => {
      if (sort === "name") return a.set.name.localeCompare(b.set.name);
      const aDate = a.set.releaseDate ? Date.parse(a.set.releaseDate) : Number.NaN;
      const bDate = b.set.releaseDate ? Date.parse(b.set.releaseDate) : Number.NaN;
      // Sets without a known release date keep the API order at the end.
      if (Number.isNaN(aDate) && Number.isNaN(bDate)) return a.index - b.index;
      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;
      return sort === "oldest" ? aDate - bDate : bDate - aDate;
    });
    return withDates.map((entry) => entry.set);
  }, [merged, query, era, sort]);

  const update = (updates: Record<string, string>) => {
    setSearchParams(applyParamUpdates(searchParams, updates), { replace: true });
  };

  const missingDates = filtered.filter((set) => !set.releaseDate).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pokémon TCG sets</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {loading ? "Loading sets…" : `${filtered.length} of ${merged.length} sets`}
          </p>
        </div>
        <CachedBadge source={source} cachedAt={cachedAt} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <label htmlFor="set-search" className="sr-only">
            Search sets by name
          </label>
          <input
            id="set-search"
            type="search"
            value={query}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Search sets…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="set-era" className="sr-only">
            Filter by series
          </label>
          <select
            id="set-era"
            value={era}
            onChange={(event) => update({ era: event.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">All series</option>
            {eraOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="set-sort" className="sr-only">
            Sort sets
          </label>
          <select
            id="set-sort"
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {missingDates > 0 && !loading && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3 text-xs leading-relaxed text-[var(--muted)]">
          <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[var(--accent-2)]" aria-hidden="true" />
          {missingDates} set{missingDates === 1 ? "" : "s"} in this view have no release date in our UK index, so they are
          listed without a date rather than with a guessed one.
        </p>
      )}

      {loading && <SkeletonGrid count={9} />}
      {error && !loading && <ErrorMessage message={error} onRetry={retry} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={<Layers size={40} />}
          title="No sets match your filters"
          description="Try a different search term or clear the series filter."
          action={{ label: "Clear filters", onClick: () => setSearchParams({}) }}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((set) => (
            <SetTile key={set.id} set={set} />
          ))}
        </div>
      )}
    </div>
  );
}
