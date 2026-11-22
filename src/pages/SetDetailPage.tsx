import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, CalendarDays, Layers, Search, Tag, Wallet } from "lucide-react";
import { useExchangeRate, useSet } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import Breadcrumbs from "../components/UI/Breadcrumbs";
import { breadcrumbSchema, graph, webPageSchema } from "../services/seo";
import { useCollection } from "../hooks/useCollection";
import CardGrid from "../components/Cards/CardGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import PageSkeleton from "../components/UI/PageSkeleton";
import Pagination from "../components/UI/Pagination";
import { CachedBadge } from "../components/UI/DataBadges";
import { EmptyState, NoData } from "../components/UI/EmptyState";
import { enrichSetWithWikiMeta } from "../utils/setMeta";
import { formatGbp, getCardPrice } from "../services/pricing";
import { loadCardDetails } from "../services/tcgdex";
import type { TcgCard } from "../types/pokemon";

interface SetValuation {
  status: "idle" | "loading" | "done" | "error";
  done: number;
  total: number;
  priced: number;
  totalGbp: number;
  stale: number;
}

const IDLE_VALUATION: SetValuation = { status: "idle", done: 0, total: 0, priced: 0, totalGbp: 0, stale: 0 };

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
  const { rate } = useExchangeRate();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("number");
  const [page, setPage] = useState(1);
  const [valuation, setValuation] = useState<SetValuation>(IDLE_VALUATION);
  const valuationAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => valuationAbort.current?.abort();
  }, []);

  const valueSet = async () => {
    if (!set) return;
    valuationAbort.current?.abort();
    const controller = new AbortController();
    valuationAbort.current = controller;

    const ids = (set.cards ?? []).map((card) => card.id);
    if (!ids.length) {
      setValuation({ ...IDLE_VALUATION, status: "done" });
      return;
    }

    let done = 0;
    let priced = 0;
    let totalGbp = 0;
    let stale = 0;
    setValuation({ status: "loading", done: 0, total: ids.length, priced: 0, totalGbp: 0, stale: 0 });

    try {
      await loadCardDetails(ids, {
        concurrency: 4,
        signal: controller.signal,
        onCard: (card) => {
          const price = getCardPrice(card, rate);
          if (price?.headlineGbp != null) {
            priced += 1;
            totalGbp += price.headlineGbp;
            if (price.confidence === "stale" || price.confidence === "unverified") stale += 1;
          }
          done += 1;
          if (done % 8 === 0 || done === ids.length) {
            setValuation({ status: "loading", done, total: ids.length, priced, totalGbp, stale });
          }
        },
      });
      if (!controller.signal.aborted) {
        setValuation({ status: "done", done, total: ids.length, priced, totalGbp, stale });
      }
    } catch {
      if (!controller.signal.aborted) {
        setValuation({ status: "error", done, total: ids.length, priced, totalGbp, stale });
      }
    }
  };

  const set = useMemo(() => (rawSet ? enrichSetWithWikiMeta(rawSet) : null), [rawSet]);

  // Visible breadcrumbs, mirrored by BreadcrumbList markup.
  const crumbs = useMemo(
    () => [{ name: "Sets", path: "/sets" }, { name: set?.name ?? "Set" }],
    [set?.name]
  );

  const pageLd = useMemo(() => {
    if (!set) return null;
    const count = set.cardCount.total ?? set.cardCount.official ?? set.cards?.length ?? 0;
    return graph(
      webPageSchema({
        type: "CollectionPage",
        name: `${set.name}${set.series ? ` (${set.series})` : ""}`,
        description: `Every card in the Pokémon TCG set ${set.name}${
          count ? ` (${count} cards)` : ""
        }, with Cardmarket reference prices shown in GBP.`,
        path: `/set/${set.id}`,
      }),
      breadcrumbSchema(crumbs)
    );
  }, [set, crumbs]);

  usePageMeta({
    title: set?.name ?? "Set details",
    description: set
      ? `${set.name}${set.series ? ` (${set.series})` : ""} — browse all ${set.cardCount.total ?? set.cardCount.official ?? ""} cards in this Pokémon TCG set.`
      : "Browse a Pokémon TCG set.",
    path: id ? `/set/${id}` : "/sets",
    jsonLd: pageLd,
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
      <Breadcrumbs items={crumbs} />
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-text)]">
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

      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">
            Showing {visible.length} of {cards.length} cards. Prices are not fetched for the whole set while browsing, so
            this page stays fast.
          </p>
          <button
            type="button"
            onClick={() => void valueSet()}
            disabled={valuation.status === "loading" || !rate}
            className="btn btn-secondary px-3 py-1.5 text-xs"
            title={rate ? "Fetch each card's own marketplace snapshot and total it" : "Waiting for the exchange rate"}
          >
            <Tag size={13} aria-hidden="true" />
            {valuation.status === "loading"
              ? `Valuing ${valuation.done}/${valuation.total}…`
              : valuation.status === "done"
                ? "Re-value this set"
                : "Value this set"}
          </button>
        </div>

        {valuation.status === "loading" && (
          <div className="mt-3" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-inset)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${valuation.total ? Math.round((valuation.done / valuation.total) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Reading {valuation.done} of {valuation.total} card snapshots — you can keep browsing.
            </p>
          </div>
        )}

        {valuation.status === "done" && (
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]" aria-live="polite">
            <strong className="text-[var(--text)]">{formatGbp(valuation.totalGbp) ?? "No Data Available"}</strong> across{" "}
            {valuation.priced.toLocaleString()} of {valuation.total.toLocaleString()} cards with a published Cardmarket
            price
            {valuation.total - valuation.priced > 0
              ? ` · ${(valuation.total - valuation.priced).toLocaleString()} unpriced and excluded, not estimated`
              : ""}
            {valuation.stale > 0 ? ` · ${valuation.stale} priced from a dated or stale snapshot` : ""}
            {rate ? ` · FX ${rate.date}` : ""}. Reference prices per card, not sold prices.
          </p>
        )}

        {valuation.status === "error" && (
          <p className="mt-3 text-[11px] text-[var(--accent-text)]" role="alert">
            Some card snapshots could not be loaded, so no set value is shown. Try again later.
          </p>
        )}
      </div>

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
