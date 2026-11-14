import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Book, CalendarDays, ExternalLink, Info, Layers, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import UK_ERAS, { getTotalCardCount, getTotalSetCount } from "../data/ukSets";
import { EmptyState } from "../components/UI/EmptyState";

/**
 * Editorial UK set wiki.
 *
 * Release dates, eras and set names come from the curated UK index
 * (Bulbapedia / TPCi / Serebii). Prices and graded valuations are
 * deliberately *not* published here — there is no verifiable source for
 * per-set graded values, so the app does not invent them.
 */
export default function WikiPage() {
  usePageMeta({
    title: "UK set wiki",
    description:
      "A chronological, editorial guide to English-language Pokémon TCG sets released in the UK, from Base Set to the latest expansions.",
    path: "/wiki",
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const era = searchParams.get("era") ?? "";
  const query = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(query);

  const filtered = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return UK_ERAS.filter((entry) => !era || entry.slug === era)
      .map((entry) => ({
        ...entry,
        sets: normalised
          ? entry.sets.filter(
              (set) => set.name.toLowerCase().includes(normalised) || String(set.releaseYear).includes(normalised)
            )
          : entry.sets,
      }))
      .filter((entry) => entry.sets.length > 0);
  }, [era, query]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <header className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 md:p-10">
        <div className="flex items-start gap-4">
          <span className="rounded-2xl bg-[var(--accent-2)]/15 p-3 text-[var(--accent-2)]">
            <Book size={26} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">The UK set wiki</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Every English-language Pokémon TCG era released in the UK, from Base Set (1999) to the present.
              {getTotalSetCount()} sets and roughly {getTotalCardCount().toLocaleString()} cards, curated by hand.
            </p>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--muted)]/80">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              This wiki is editorial reference material (release dates, eras, printed counts). It intentionally contains
              no price or graded-card estimates — those are unverifiable and would be invented.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <label htmlFor="wiki-search" className="sr-only">
            Search the wiki
          </label>
          <input
            id="wiki-search"
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              updateParams({ q: event.target.value });
            }}
            placeholder="Search sets or years…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="wiki-era" className="sr-only">
            Filter by era
          </label>
          <select
            id="wiki-era"
            value={era}
            onChange={(event) => updateParams({ era: event.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">All eras</option>
            {UK_ERAS.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title="No wiki entries match"
          description="Try a broader search term or select a different era."
          action={{ label: "Clear filters", onClick: () => { setSearchInput(""); setSearchParams({}); } }}
        />
      ) : (
        <div className="space-y-10">
          {filtered.map((entry) => (
            <section key={entry.slug} aria-labelledby={`era-${entry.slug}`}>
              <div className="mb-4 flex flex-wrap items-baseline gap-3">
                <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: entry.colour }} aria-hidden="true" />
                <h2 id={`era-${entry.slug}`} className="text-xl font-black uppercase tracking-tight">
                  {entry.name}
                </h2>
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{entry.years}</span>
              </div>
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{entry.description}</p>

              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entry.sets.map((set) => (
                  <li key={set.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-[var(--text)]">{set.name}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays size={11} aria-hidden="true" />
                            {new Date(set.releaseDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Layers size={11} aria-hidden="true" />
                            {set.cards} cards
                          </span>
                          {set.type !== "main" && (
                            <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 uppercase tracking-widest">
                              {set.type}
                            </span>
                          )}
                        </p>
                      </div>
                      <ExternalLink size={13} className="mt-1 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-widest">
                      <Link to={`/sets?q=${encodeURIComponent(set.name)}`} className="text-[var(--link)] no-underline">
                        Find in sets
                      </Link>
                      <a
                        href={`https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(
                          set.name.replace(/ Series| \(WOTC\)/g, "").replace(/ /g, "_")
                        )}_(TCG)`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                      >
                        Bulbapedia
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
