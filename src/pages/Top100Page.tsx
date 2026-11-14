import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Info, RefreshCw, Search, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useDebouncedValue } from "../hooks/useApi";
import { useTopCards } from "../hooks/useTopCards";
import { formatEur, formatGbp, formatUpdatedAt } from "../services/pricing";
import { CANDIDATE_RARITIES, RARITY_SCOPE_NOTE, type TopCardEntry } from "../services/topCards";
import CardArtwork from "../components/Cards/CardArtwork";
import { EmptyState } from "../components/UI/EmptyState";
import { cn } from "../utils/cn";

type SortKey = "value-desc" | "value-asc" | "name" | "newest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "value-desc", label: "Value: high to low" },
  { value: "value-asc", label: "Value: low to high" },
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest set first" },
];

const CONFIDENCE_STYLE: Record<string, { dot: string; label: string }> = {
  verified: { dot: "var(--success, #22c55e)", label: "Current" },
  indicative: { dot: "var(--accent-2)", label: "Indicative" },
  stale: { dot: "#f59e0b", label: "Stale" },
  unverified: { dot: "#f59e0b", label: "Low confidence" },
  unavailable: { dot: "var(--muted-dim)", label: "No data" },
};

function yearOf(entry: TopCardEntry): number | null {
  if (!entry.release) return null;
  const year = new Date(entry.release).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

function eraOf(year: number | null): string {
  if (year == null) return "Unknown";
  if (year <= 2002) return "WotC era (1999–2002)";
  if (year <= 2006) return "EX era (2003–2006)";
  if (year <= 2010) return "Diamond & Pearl (2007–2010)";
  if (year <= 2012) return "HeartGold / Black & White";
  if (year <= 2016) return "XY era (2013–2016)";
  if (year <= 2019) return "Sun & Moon (2017–2019)";
  if (year <= 2022) return "Sword & Shield (2020–2022)";
  return "Scarlet & Violet / Mega (2023+)";
}

function Row({ entry, rank }: { entry: TopCardEntry; rank: number }) {
  const confidence = CONFIDENCE_STYLE[entry.confidence] ?? CONFIDENCE_STYLE.indicative;
  const updated = formatUpdatedAt(entry.updatedAt);
  return (
    <li className="surface surface-hover flex items-center gap-3 p-2.5 sm:gap-4 sm:p-3">
      <span className="w-7 shrink-0 text-right text-sm font-black tabular-nums text-[var(--muted)]">{rank}</span>
      <Link
        to={`/card/${entry.id}`}
        className="block w-[52px] shrink-0 overflow-hidden rounded-md no-underline hover:no-underline sm:w-[62px]"
        tabIndex={-1}
        aria-hidden="true"
      >
        <CardArtwork card={{ id: entry.id, imageBase: entry.imageBase }} alt="" className="aspect-[245/337] w-full" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/card/${entry.id}`} className="block truncate text-sm font-bold text-[var(--text)] no-underline hover:no-underline hover:text-[var(--accent-text)]">
          {entry.name}
        </Link>
        <p className="truncate text-[11px] text-[var(--muted)]">
          {entry.setName || "Set not listed"}
          {entry.localId ? ` · #${entry.localId}` : ""}
          {entry.rarity ? ` · ${entry.rarity}` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-tight text-[var(--muted-dim)]">
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: confidence.dot }} />
          {entry.variant || "Printing not listed"}
          {updated ? ` · ${updated}` : " · update date not published"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-[var(--text)]">{formatGbp(entry.gbp) ?? "FX unavailable"}</p>
        <p className="text-[11px] tabular-nums text-[var(--muted)]">{formatEur(entry.eur)}</p>
      </div>
    </li>
  );
}

export default function Top100Page() {
  const { entries, status, error, priced, scanned, total, percent, remaining, updatedAt, rate, continueScanning, rebuild } =
    useTopCards();
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [era, setEra] = useState("all");
  const [sort, setSort] = useState<SortKey>("value-desc");
  const debouncedQuery = useDebouncedValue(query, 250);

  usePageMeta({
    title: "Top 100 most valuable Pokémon cards · PokeGuru",
    description:
      "The 100 most valuable Pokémon cards by Cardmarket trend, with GBP and EUR reference prices, the printing each price belongs to and the marketplace update date.",
    path: "/top-100",
  });

  const rarities = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) if (entry.rarity) set.add(entry.rarity);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const eras = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) set.add(eraOf(yearOf(entry)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const visible = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (rarity !== "all" && entry.rarity !== rarity) return false;
      if (era !== "all" && eraOf(yearOf(entry)) !== era) return false;
      if (!needle) return true;
      return (
        entry.name.toLowerCase().includes(needle) ||
        entry.setName.toLowerCase().includes(needle) ||
        entry.localId.toLowerCase() === needle.replace(/^#/, "")
      );
    });
    const sorted = [...filtered];
    if (sort === "value-asc") sorted.sort((a, b) => a.eur - b.eur || a.name.localeCompare(b.name));
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "newest") sorted.sort((a, b) => (b.release ?? "").localeCompare(a.release ?? ""));
    else sorted.sort((a, b) => b.eur - a.eur || a.name.localeCompare(b.name));
    return sorted;
  }, [entries, rarity, era, debouncedQuery, sort]);

  const lastUpdated = formatUpdatedAt(updatedAt ?? undefined);
  const scanning = status === "discovering" || status === "pricing";

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">
          <TrendingUp size={14} aria-hidden="true" /> Top 100
        </p>
        <h1 className="text-balance text-3xl font-black tracking-tight text-[var(--text)] sm:text-4xl">
          The most valuable Pokémon cards, by Cardmarket trend
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          One printing per card — raw and ungraded, English cards only. Prices are Cardmarket marketplace{" "}
          <strong className="text-[var(--text)]">reference</strong> values (trend), shown in GBP with the EUR source figure
          beside them. Cards without a real Cardmarket price are excluded rather than estimated.
        </p>
      </header>

      <section className="surface p-4" aria-label="Ranking status">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text)]">
              {scanning ? "Pricing cards from the card database…" : `${priced.toLocaleString("en-GB")} cards priced`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {total > 0 ? (
                <>
                  {scanned.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} premium printings scanned (
                  {percent.toFixed(0)}%)
                  {remaining > 0 ? ` · ${remaining.toLocaleString("en-GB")} left to price` : " · pool complete"}
                </>
              ) : (
                "Collecting the candidate pool from the card database…"
              )}
            </p>
            {lastUpdated && (
              <p className="mt-1 text-xs text-[var(--muted-dim)]">
                Marketplace prices last updated {lastUpdated}
                {rate ? ` · EUR→GBP ${rate.rate.toFixed(4)} (${rate.date})` : " · FX rate unavailable, EUR shown"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {remaining > 0 && (
              <button
                type="button"
                onClick={continueScanning}
                disabled={scanning}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#dc2626] disabled:opacity-60"
              >
                <RefreshCw size={14} className={cn(scanning && "animate-spin")} aria-hidden="true" />
                {scanning ? "Scanning…" : "Price more cards"}
              </button>
            )}
            <button
              type="button"
              onClick={rebuild}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              Reset index
            </button>
          </div>
        </div>
        {total > 0 && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label="Candidate pool priced"
          >
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${Math.max(2, percent)}%` }} />
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <section className="surface space-y-3 p-4" aria-label="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-dim)]">Search</span>
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Card or set name"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] py-2 pl-8 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--muted-dim)] focus:border-[var(--accent)] focus:outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-dim)]">Rarity</span>
            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="all">All rarities</option>
              {rarities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-dim)]">Era</span>
            <select
              value={era}
              onChange={(event) => setEra(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="all">All eras</option>
              {eras.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-dim)]">
              <ArrowUpDown size={11} aria-hidden="true" /> Sort
            </span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(query || rarity !== "all" || era !== "all") && (
          <p className="text-xs text-[var(--muted)]">
            Showing {visible.length} of {priced} priced cards.
          </p>
        )}
      </section>

      {entries.length === 0 && !scanning ? (
        <EmptyState
          icon={<Wallet size={32} />}
          title="No priced cards yet"
          description="PokeGuru could not price any cards in this pass. Nothing has been invented to fill the list — try again when the card database is reachable."
          action={{ label: "Try again", onClick: continueScanning }}
        />
      ) : (
        <ol className="space-y-2">
          {visible.map((entry, index) => (
            <Row key={entry.id} entry={entry} rank={sort === "value-desc" ? index + 1 : entries.indexOf(entry) + 1} />
          ))}
        </ol>
      )}

      <section className="surface space-y-2 p-4 text-xs leading-relaxed text-[var(--muted)]" aria-label="How this list is built">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
          <Info size={15} aria-hidden="true" /> How this list is built
        </h2>
        <p>
          Cardmarket does not publish a public price leaderboard and the TCGdex search API returns no prices, so PokeGuru builds its own index:
          it collects cards from the {CANDIDATE_RARITIES.length} rarities that hold the market&apos;s expensive raw cards, prices them one card
          at a time, and ranks only the cards that came back with a real trend value.
        </p>
        <p>{RARITY_SCOPE_NOTE}</p>
        <p>
          Prices are marketplace reference values from Cardmarket (via TCGdex), not completed sales, and they are never mixed between printings:
          the printing shown beside each card is the one its price belongs to. GBP uses the European Central Bank rate published by
          Frankfurter, with the rate date shown above. Listings exclude graded slabs, non-English cards and sealed product.
        </p>
        <p>
          The list is not padded: if fewer than 100 cards have a verified price, it shows fewer than 100 and tells you how much of the
          candidate pool has been priced. Scanning continues where it left off each time you return.
        </p>
      </section>
    </div>
  );
}
