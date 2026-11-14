import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, CalendarDays, Layers, Search, Wallet } from "lucide-react";
import { useSet } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import { useCollection } from "../hooks/useCollection";
import CardGrid from "../components/Cards/CardGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import PageSkeleton from "../components/UI/PageSkeleton";
import Pagination from "../components/UI/Pagination";
import { CachedBadge } from "../components/UI/DataBadges";
import { EmptyState, NoData } from "../components/UI/EmptyState";
import { enrichSetWithWikiMeta } from "../utils/setMeta";
import type { TcgCard } from "../types/pokemon";

const PAGE_SIZE = 60;

type SortMode = "number" | "name";

function sortByNumber(cards: TcgCard[]): TcgCard[] {
  return [...cards].sort((a, b) => {
    const aNum = Number.parseInt(a.localId.replace(/\D/g, ""), 10);
    const bNum = Number.parseInt(b.localId.replace(/\D/g, ""), 10);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return a.localId.localeCompare(b.localId, undefined, { numeric: true });
  });
}

export default function SetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: rawSet, loading, error, source, cachedAt, retry } = useSet(id);
  const { collection } = useCollection();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("number");
  const [page, setPage] = useState(1);

  const set = useMemo(() => (rawSet ? enrichSetWithWikiMeta(rawSet) : null), [rawSet]);

  usePageMeta({
    title: set?.name ?? "Set details",
    description: set
      ? `${set.name}${set.series ? ` (${set.series})` : ""} — browse all ${set.cardCount.total ?? set.cardCount.official ?? ""} cards in this Pokémon TCG set.`
      : "Browse a Pokémon TCG set.",
    path: id ? `/set/${id}` : "/sets",
  });

  useEffect(() => {
    setPage(1);
  }, [query, sort, id]);

  const cards = useMemo(() => {
    const all = set?.cards ?? [];
    const normalised = query.trim().toLowerCase();
    const filtered = normalised
      ? all.filter(
          (card) =>
            card.name.toLowerCase().includes(normalised) || card.localId.toLowerCase() === normalised.replace("#", "")
        )
      : all;
    return sort === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : sortByNumber(filtered);
  }, [set, query, sort]);

  const totalCards = set?.cardCount.total ?? set?.cardCount.official ?? cards.length;
  const ownedInSet = useMemo(() => {
    if (!set) return 0;
    const ids = new Set((set.cards ?? []).map((card) => card.id));
    return collection.filter((item) => ids.has(item.card.id) || item.card.set.id === set.id).length;
  }, [collection, set]);

  if (loading) return <PageSkeleton title="Loading set" cards={12} />;

  if (error || !set) {
    return (
      <ErrorMessage
        message={error ?? "This set could not be found."}
        onRetry={retry}
        hint="Set ids come from the TCGdex card database — try browsing all sets instead."
      />
    );
  }

  const releaseDate = set.releaseDate
    ? new Date(set.releaseDate).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const pageCount = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = cards.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/sets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] no-underline hover:text-[var(--text)] hover:no-underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All sets
        </Link>
        <CachedBadge source={source} cachedAt={cachedAt} />
      </div>

      <header className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-[var(--bg)]/60 p-2">
          {set.images.logo ? (
            <img
              src={set.images.logo}
              alt={`${set.name} set logo`}
              width={112}
              height={80}
              className="max-h-16 w-auto object-contain"
            />
          ) : (
            <Layers size={28} className="text-[var(--muted)]" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{set.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            <span>{set.series || <NoData label="Series unavailable" />}</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} aria-hidden="true" />
              {releaseDate ?? <NoData label="Date unavailable" />}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers size={13} aria-hidden="true" />
              {totalCards} cards
            </span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
              <Wallet size={12} aria-hidden="true" />
              {ownedInSet} / {totalCards} in your vault
            </span>
            <div className="h-2 w-40 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-soft)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-500"
                style={{ width: `${totalCards ? Math.min(100, Math.round((ownedInSet / totalCards) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <label htmlFor="set-card-search" className="sr-only">
            Search cards in this set
          </label>
          <input
            id="set-card-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter this set…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown size={14} className="text-[var(--muted)]" aria-hidden="true" />
          <label htmlFor="set-card-sort" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Sort
          </label>
          <select
            id="set-card-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="number">Card number</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      <p className="mb-4 text-xs text-[var(--muted)]">
        Showing {visible.length} of {cards.length} cards. Open any card for marketplace pricing — prices are not fetched for
        the whole set at once, so this page stays fast.
      </p>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search size={40} />}
          title="No cards match"
          description="Try a different card name or clear the search."
          action={{ label: "Clear search", onClick: () => setQuery("") }}
        />
      ) : (
        <CardGrid cards={visible} showPrice={false} priorityCount={6} />
      )}

      <Pagination
        currentPage={safePage}
        totalItems={cards.length}
        pageSize={PAGE_SIZE}
        onPageChange={(next) => {
          setPage(next);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
