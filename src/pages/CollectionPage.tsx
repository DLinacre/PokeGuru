import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Download, Info, RefreshCw, Trash2, Wallet } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { useExchangeRate } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatGbp, getCardValueGbp, formatUpdatedAt } from "../services/pricing";
import { loadCardDetails } from "../services/tcgdex";
import { NoData } from "../components/UI/EmptyState";
import { EmptyState } from "../components/UI/EmptyState";
import type { TcgCard } from "../types/pokemon";

type SortMode = "value" | "name" | "added";

export default function CollectionPage() {
  usePageMeta({
    title: "My collection",
    description: "Your Pokémon card collection vault, stored privately in your browser.",
    path: "/collection",
  });

  const { collection, removeFromCollection, clearCollection, updateCollectionCards } = useCollection();
  const { rate } = useExchangeRate();
  const [sortBy, setSortBy] = useState<SortMode>("value");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const valued = useMemo(
    () =>
      collection.map((item) => ({
        ...item,
        value: getCardValueGbp(item.card, rate),
      })),
    [collection, rate]
  );

  const sorted = useMemo(() => {
    return [...valued].sort((a, b) => {
      if (sortBy === "name") return a.card.name.localeCompare(b.card.name);
      if (sortBy === "added") return b.addedAt - a.addedAt;
      if (a.value == null && b.value == null) return a.card.name.localeCompare(b.card.name);
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return b.value - a.value;
    });
  }, [valued, sortBy]);

  const pricedItems = valued.filter((item) => item.value != null);
  const totalValue = pricedItems.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const unpricedCount = valued.length - pricedItems.length;
  const lastUpdated = collection
    .map((item) => (item.card.updatedAt ? Date.parse(item.card.updatedAt) : null))
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  const refreshPrices = async () => {
    if (!collection.length) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const results = await loadCardDetails(
        collection.map((item) => item.card.id),
        { concurrency: 5 }
      );
      const refreshed: TcgCard[] = [...results.values()].map((card) => card);
      if (refreshed.length) updateCollectionCards(refreshed);
    } catch {
      setRefreshError("Prices could not be refreshed. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const exportCollection = () => {
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pokeguru-collection-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (collection.length === 0) {
    return (
      <EmptyState
        icon={<Wallet size={48} />}
        title="Your vault is empty"
        description="Add cards from search results or a card page. Your vault is stored only in this browser — no account, no upload."
        action={{ label: "Browse cards", to: "/search" }}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 md:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 opacity-5">
          <Wallet size={260} />
        </div>
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              My <span className="text-[var(--accent)]">Vault</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {collection.length} card{collection.length === 1 ? "" : "s"} · stored locally in this browser
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              Estimated value (priced cards)
            </p>
            <p className="text-3xl font-black tabular-nums text-[#10b981] md:text-5xl">
              {pricedItems.length ? formatGbp(totalValue) : <NoData />}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--muted)] md:justify-end">
              <Info size={12} aria-hidden="true" />
              {unpricedCount > 0
                ? `${unpricedCount} of ${collection.length} cards have no published Cardmarket price`
                : "Cardmarket reference prices converted to GBP"}
            </p>
            {rate && <p className="mt-1 text-[11px] text-[var(--muted)]">FX rate dated {rate.date}</p>}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={15} className="text-[var(--muted)]" aria-hidden="true" />
          <label htmlFor="collection-sort" className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Sort
          </label>
          <select
            id="collection-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortMode)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="value">Highest value</option>
            <option value="name">Name (A–Z)</option>
            <option value="added">Recently added</option>
          </select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshPrices}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </button>
          <button
            type="button"
            onClick={exportCollection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          >
            <Download size={13} aria-hidden="true" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Remove every card from your vault? This cannot be undone.")) clearCollection();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Trash2 size={13} aria-hidden="true" />
            Clear vault
          </button>
        </div>
      </div>

      <p className="mb-5 text-xs leading-relaxed text-[var(--muted)]">
        Vault values use the price snapshot saved with each card
        {lastUpdated ? ` (card data last updated ${formatUpdatedAt(lastUpdated)})` : ""}. Use “Refresh prices” to
        re-fetch current references. Prices are not completed sales.
      </p>

      {refreshError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {refreshError}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {sorted.map((item) => (
          <li key={item.card.id} className="group relative">
            <Link to={`/card/${item.card.id}`} className="block no-underline hover:no-underline">
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[#0b0d12]">
                {item.card.images.small ? (
                  <img
                    src={item.card.images.small}
                    alt={`${item.card.name} card`}
                    width={245}
                    height={337}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[245/337] w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
                  />
                ) : (
                  <div className="flex aspect-[245/337] items-center justify-center text-xs text-[var(--muted)]">
                    Image unavailable
                  </div>
                )}
              </div>
              <div className="mt-2 px-0.5">
                <h2 className="truncate text-sm font-bold text-[var(--text)]">{item.card.name}</h2>
                <p className="truncate text-[10px] font-bold uppercase tracking-tight text-[var(--muted)]">
                  {item.card.set.name || "Set not listed"} {item.card.localId ? `· #${item.card.localId}` : ""}
                </p>
                <p className={`text-xs font-bold tabular-nums ${item.value != null ? "text-[#10b981]" : "text-[var(--muted)]/70"}`}>
                  {formatGbp(item.value) ?? "No Data Available"}
                </p>
                <p className="text-[10px] text-[var(--muted)]">
                  Added {new Date(item.addedAt).toLocaleDateString("en-GB")}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => removeFromCollection(item.card.id)}
              className="absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(15,17,21,0.85)] text-red-400 opacity-100 shadow-lg transition-opacity hover:bg-red-500 hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Remove ${item.card.name} from your vault`}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
