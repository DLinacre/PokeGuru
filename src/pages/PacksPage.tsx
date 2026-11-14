import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  FilterX,
  Layers,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePackCatalogue, type PackCatalogueEntry } from "../hooks/usePacks";
import { useSim } from "../services/simStore";
import { useDebouncedValue } from "../hooks/useApi";
import { EmptyState } from "../components/UI/EmptyState";
import ErrorMessage from "../components/UI/ErrorMessage";
import Pagination from "../components/UI/Pagination";
import PackArt from "../components/Packs/PackArt";
import { confidenceLabel } from "../data/packRules";
import { applyParamUpdates } from "../utils/search";
import { cn } from "../utils/cn";

const PAGE_SIZE = 24;

type Sort = "newest" | "oldest" | "name";

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function yearOf(date?: string): number | null {
  if (!date) return null;
  const year = new Date(date).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

function PackTile({ pack }: { pack: PackCatalogueEntry }) {
  return (
    <Link
      to={`/packs/${pack.setId}`}
      className="group surface surface-hover flex flex-col gap-3 p-3 no-underline hover:no-underline"
    >
      <div className="relative mx-auto w-full max-w-[150px] transition-transform duration-300 group-hover:-translate-y-0.5">
        <PackArt
          setName={pack.setName}
          seriesId={pack.seriesId}
          seriesName={pack.seriesName}
          logo={pack.logo}
          year={yearOf(pack.releaseDate)?.toString()}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--text)]">{pack.setName}</p>
        <p className="truncate text-[11px] text-[var(--muted)]">
          {pack.seriesName} · {yearOf(pack.releaseDate) ?? "date unknown"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "chip px-1.5 py-0.5 text-[9px]",
              pack.confidence === "documented"
                ? "border-[var(--success)]/35 bg-[var(--success-soft)] text-[var(--success)]"
                : "border-[var(--border)] text-[var(--muted-dim)]"
            )}
            title={confidenceLabel(pack.confidence)}
          >
            {pack.confidence === "documented" ? <ShieldCheck size={9} aria-hidden="true" /> : <TriangleAlert size={9} aria-hidden="true" />}
            {pack.config.cardsPerPack} cards
          </span>
          {pack.cardCount ? (
            <span className="chip px-1.5 py-0.5 text-[9px] text-[var(--muted-dim)]">{pack.cardCount} in set</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function PacksPage() {
  usePageMeta({
    title: "Pack Opening Simulator",
    description:
      "Open virtual Pokémon TCG booster packs from every era, generated from the real card pools of each expansion with documented or clearly estimated pack structures.",
    path: "/packs",
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { packs, series, years, loading, error, failedSeries, retry } = usePackCatalogue();
  const { stats } = useSim();

  const query = searchParams.get("q") ?? "";
  const seriesFilter = searchParams.get("series") ?? "";
  const yearFilter = searchParams.get("year") ?? "";
  const sort = (searchParams.get("sort") as Sort) || "newest";
  const page = parsePage(searchParams.get("page"));

  const [queryInput, setQueryInput] = useState(query);
  const debouncedQuery = useDebouncedValue(queryInput, 300);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    const typed = debouncedQuery.trim();
    if (typed === query) return;
    setSearchParams(applyParamUpdates(searchParams, { q: typed, page: 1 }), { replace: true });
  }, [debouncedQuery, query, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = packs.filter((pack) => {
      if (needle && !pack.setName.toLowerCase().includes(needle) && !pack.seriesName.toLowerCase().includes(needle)) return false;
      if (seriesFilter && pack.seriesId !== seriesFilter) return false;
      if (yearFilter && String(yearOf(pack.releaseDate)) !== yearFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "name") return a.setName.localeCompare(b.setName);
      const aDate = a.releaseDate ? Date.parse(a.releaseDate) : Number.NaN;
      const bDate = b.releaseDate ? Date.parse(b.releaseDate) : Number.NaN;
      if (Number.isNaN(aDate) && Number.isNaN(bDate)) return a.setName.localeCompare(b.setName);
      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;
      return sort === "oldest" ? aDate - bDate : bDate - aDate;
    });
  }, [packs, query, seriesFilter, yearFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const update = (updates: Record<string, string | number | undefined>) => {
    setSearchParams(applyParamUpdates(searchParams, updates));
  };

  const hasFilters = Boolean(query || seriesFilter || yearFilter || sort !== "newest");

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-text)]">
              <Sparkles size={12} aria-hidden="true" /> PokeGuru Pack Simulator
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
              Open a booster pack from any era
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Every pack is generated from the real card pool of the selected expansion, using that era&apos;s pack structure. Free,
              unlimited, and completely separate from your collection vault.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {failedSeries.length > 0 && (
              <span className="chip border-[var(--accent-2)]/40 bg-[var(--warning-soft)] text-[var(--accent-2)]" title={`Could not load: ${failedSeries.join(", ")}`}>
                <TriangleAlert size={10} aria-hidden="true" />
                {failedSeries.length} series unavailable
              </span>
            )}
            <Link to="/packs/collection" className="btn btn-secondary no-underline hover:no-underline">
              <Wallet size={14} aria-hidden="true" />
              Simulated collection
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Packs available", value: loading ? "…" : packs.length.toLocaleString() },
            { label: "Eras covered", value: loading ? "…" : series.length.toLocaleString() },
            { label: "Packs you have opened", value: stats.packsOpened.toLocaleString() },
            { label: "Simulated cards collected", value: stats.uniqueCards.toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="surface px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">{stat.label}</p>
              <p className="mt-0.5 truncate text-lg font-black tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="sticky top-[64px] z-20 mb-5 rounded-2xl border border-[var(--border)] bg-[rgba(16,19,25,0.9)] p-3 shadow-xl backdrop-blur-xl sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
            <PackageOpen size={12} aria-hidden="true" />
            Browse boosters
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQueryInput("");
                setSearchParams({});
              }}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] transition-colors hover:text-[var(--accent-text)]"
            >
              <FilterX size={12} aria-hidden="true" /> Reset
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <label htmlFor="pack-search" className="sr-only">
              Search expansions
            </label>
            <input
              id="pack-search"
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search expansions or series…"
              className="field pl-9"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="pack-series" className="sr-only">
              Filter by TCG series
            </label>
            <select
              id="pack-series"
              value={seriesFilter}
              onChange={(event) => update({ series: event.target.value, page: 1 })}
              className="field"
            >
              <option value="">All series</option>
              {series.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pack-year" className="sr-only">
              Filter by release year
            </label>
            <select
              id="pack-year"
              value={yearFilter}
              onChange={(event) => update({ year: event.target.value, page: 1 })}
              className="field"
            >
              <option value="">Any year</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pack-sort" className="sr-only">
              Sort expansions
            </label>
            <select id="pack-sort" value={sort} onChange={(event) => update({ sort: event.target.value, page: 1 })} className="field">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-[var(--muted)]">
          English-language expansions only — that is the language the card database publishes. Wrapper artwork is a PokeGuru illustration,
          not an official product image.
        </p>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="surface h-[280px] animate-shimmer" />
          ))}
        </div>
      )}

      {error && !loading && <ErrorMessage message={error} onRetry={retry} hint="Set data is required before a pack can be simulated." />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          icon={<Layers size={40} />}
          title="No packs match those filters"
          description="Try a different series, year or search term. Every English expansion in the card database is included."
          action={{
            label: "Clear filters",
            onClick: () => {
              setQueryInput("");
              setSearchParams({});
            },
          }}
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((pack) => (
              <PackTile key={pack.setId} pack={pack} />
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={(next) => {
              update({ page: next });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}

      <section className="mt-10 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck size={15} className="text-[var(--success)]" aria-hidden="true" />
          How these packs work
        </h2>
        <ul className="space-y-2 text-xs leading-relaxed text-[var(--muted)]">
          <li>
            <strong className="text-[var(--text-soft)]">Real card pools.</strong> Cards are pulled from the selected expansion&apos;s actual
            card list and rarity data (including Trainer Gallery and Shiny Vault subsets, which are found inside the same packs).
          </li>
          <li>
            <strong className="text-[var(--text-soft)]">Era-specific structures.</strong> Wizards-era 11-card packs, nine-card EX packs and
            modern ten-card packs follow different rules. The pack panel shows exactly which rule is being used and how confident we are in
            it.
          </li>
          <li>
            <strong className="text-[var(--text-soft)]">Honest odds.</strong> Pokémon does not publish per-rarity odds for each expansion, so
            every tier percentage is either taken from documented product information or clearly labelled as a PokeGuru estimate.
          </li>
          <li>
            <strong className="text-[var(--text-soft)]">No value claimed.</strong> Simulated pulls are never added to your real collection,
            never valued, and never sold.
          </li>
        </ul>
        <p className="text-[11px] leading-relaxed text-[var(--muted-dim)]">
          PokeGuru is an unofficial fan-made Pokémon TCG companion. Pack openings are virtual simulations for entertainment only. No physical
          cards or products are supplied, and simulated pulls have no real-world ownership or monetary value. Pull rates are estimates unless
          explicitly identified otherwise. PokeGuru is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures Inc. or
          GAME FREAK.
        </p>
        <Link to="/about" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline">
          Read the full data policy <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
