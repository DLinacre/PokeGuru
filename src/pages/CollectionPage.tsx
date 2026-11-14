import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpDown, Download, Info, RefreshCw, Search, Trash2, Upload, Wallet } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { useExchangeRate } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatGbp, formatUpdatedAt, getCardPrice, getCardValueGbp } from "../services/pricing";
import { loadCardDetails } from "../services/tcgdex";
import PriceConfidenceBadge from "../components/UI/PriceBadge";
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

  const { collection, addToCollection, removeFromCollection, clearCollection, updateCollectionCards } = useCollection();
  const { rate } = useExchangeRate();
  const [sortBy, setSortBy] = useState<SortMode>("value");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const valued = useMemo(
    () =>
      collection.map((item) => ({
        ...item,
        value: getCardValueGbp(item.card, rate),
      })),
    [collection, rate]
  );

  const setOptions = useMemo(() => {
    const names = new Set(collection.map((item) => item.card.set.name).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [collection]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return valued.filter((item) => {
      const matchesQuery =
        !needle ||
        item.card.name.toLowerCase().includes(needle) ||
        item.card.set.name.toLowerCase().includes(needle) ||
        (item.card.localId ?? "").toLowerCase() === needle;
      const matchesSet = !setFilter || item.card.set.name === setFilter;
      return matchesQuery && matchesSet;
    });
  }, [valued, query, setFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.card.name.localeCompare(b.card.name);
      if (sortBy === "added") return b.addedAt - a.addedAt;
      if (a.value == null && b.value == null) return a.card.name.localeCompare(b.card.name);
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return b.value - a.value;
    });
  }, [filtered, sortBy]);

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

  const importCollection = async (file: File) => {
    setImportMessage(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { collection?: unknown }).collection)
          ? ((parsed as { collection: unknown[] }).collection)
          : null;
      if (!rows) throw new Error("format");

      let added = 0;
      let skipped = 0;
      let invalid = 0;
      const existing = new Set(collection.map((item) => item.card.id));

      for (const row of rows) {
        const candidate = (row as { card?: unknown }).card ?? row;
        const card = candidate as TcgCard;
        if (!card || typeof card !== "object" || typeof card.id !== "string" || typeof card.name !== "string") {
          invalid += 1;
          continue;
        }
        if (existing.has(card.id)) {
          skipped += 1;
          continue;
        }
        addToCollection({
          ...card,
          images: card.images ?? {},
          set: card.set ?? { id: "", name: "" },
          category: card.category ?? "Pokemon",
        });
        existing.add(card.id);
        added += 1;
      }

      setImportMessage(
        `Import finished: ${added} added, ${skipped} already in your vault${invalid ? `, ${invalid} skipped as invalid` : ""}. Nothing was removed.`
      );
    } catch {
      setImportMessage(
        "That file could not be read. Export a collection from PokeGuru and import that JSON file — your current vault has not been changed."
      );
    }
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

      <div className="mb-4 grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
          <label htmlFor="collection-search" className="sr-only">
            Search your collection
          </label>
          <input
            id="collection-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your cards by name, set or number"
            className="field pl-9"
          />
        </div>
        <div>
          <label htmlFor="collection-set" className="sr-only">
            Filter by set
          </label>
          <select id="collection-set" value={setFilter} onChange={(event) => setSetFilter(event.target.value)} className="field">
            <option value="">All sets in your vault</option>
            {setOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-[11px] font-semibold text-[var(--muted)]">
            {filtered.length === collection.length ? `${collection.length} cards` : `${filtered.length} of ${collection.length}`}
          </span>
          {(query || setFilter) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSetFilter("");
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-[var(--link)]"
            >
              Clear
            </button>
          )}
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
            className="btn btn-ghost px-3 py-2 text-xs"
          >
            <Download size={13} aria-hidden="true" />
            Export JSON
          </button>
          <label className="btn btn-ghost cursor-pointer px-3 py-2 text-xs">
            <Upload size={13} aria-hidden="true" />
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCollection(file);
                event.target.value = "";
              }}
            />
          </label>
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

      {importMessage && (
        <p role="status" className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 text-xs leading-relaxed text-[var(--text)]">
          {importMessage}
        </p>
      )}

      <details className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3 text-xs leading-relaxed text-[var(--muted)]">
        <summary className="cursor-pointer font-semibold text-[var(--text)]">How your vault value is calculated</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Each card is matched to its own printing and the Cardmarket band for that printing only.</li>
          <li>The headline is Cardmarket&apos;s trend price, then average asking price, then 30-day average, then lowest listing.</li>
          <li>EUR is converted with the dated Frankfurter rate{rate ? ` (${rate.date})` : ""}; with no rate, GBP is hidden.</li>
          <li>Cards without a published Cardmarket price add nothing to the total and are counted separately — no estimate is invented.</li>
          <li>These are marketplace reference prices, not completed sales. Use “Refresh prices” to re-fetch current snapshots
            {lastUpdated ? ` (card data last updated ${formatUpdatedAt(lastUpdated)})` : ""}.</li>
        </ol>
      </details>

      {refreshError && (
        <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {refreshError}
        </p>
      )}

      {sorted.length === 0 && (
        <EmptyState
          icon={<Search size={40} />}
          title="No cards match your search"
          description="Nothing was removed from your vault — adjust the search or set filter to see your cards again."
          action={{
            label: "Clear search",
            onClick: () => {
              setQuery("");
              setSetFilter("");
            },
          }}
        />
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
                {(() => {
                  const price = getCardPrice(item.card, rate);
                  return (
                    <>
                      <p className={`text-sm font-bold tabular-nums ${item.value != null ? "text-[var(--text)]" : "text-[10px] uppercase tracking-tight text-[var(--muted-dim)]"}`}>
                        {formatGbp(item.value) ?? "No data available"}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-[var(--muted)]" title={price?.confidenceReason}>
                        {price && price.headlineGbp != null ? (
                          <PriceConfidenceBadge
                            confidence={price.confidence}
                            label={price.confidence === "verified" ? "Cardmarket trend" : price.confidenceLabel}
                            reason={price.confidenceReason}
                            className="!px-1.5 !py-0 !text-[9px]"
                          />
                        ) : (
                          <span>No published price</span>
                        )}
                      </p>
                    </>
                  );
                })()}
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
