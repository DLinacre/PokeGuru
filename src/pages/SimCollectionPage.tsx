import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Layers,
  PackageOpen,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePackCatalogue } from "../hooks/usePacks";
import { rarestPulls, summariseSim, useSim } from "../services/simStore";
import { TIER_LABELS, tierRank } from "../data/packRules";
import type { RarityTier } from "../types/packs";
import { EmptyState } from "../components/UI/EmptyState";
import PackCard from "../components/Packs/PackCard";
import { cn } from "../utils/cn";

export default function SimCollectionPage() {
  usePageMeta({
    title: "Simulated collection",
    description: "Every card you have pulled in the PokeGuru pack simulator, stored only in this browser and kept separate from your real collection.",
    path: "/packs/collection",
  });

  const { state, stats, reset } = useSim();
  const { packs } = usePackCatalogue();
  const [setFilter, setSetFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sort, setSort] = useState<"rarest" | "recent" | "name">("rarest");
  const [confirmReset, setConfirmReset] = useState(false);

  const setTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const pack of packs) if (pack.cardCount) totals.set(pack.setId, pack.cardCount);
    return totals;
  }, [packs]);

  const ownedSets = useMemo(() => {
    const map = new Map<string, { setId: string; setName: string; unique: number; pulls: number }>();
    for (const entry of Object.values(state.cards)) {
      const record = map.get(entry.card.setId) ?? { setId: entry.card.setId, setName: entry.card.setName, unique: 0, pulls: 0 };
      record.unique += 1;
      record.pulls += entry.quantity;
      map.set(entry.card.setId, record);
    }
    return [...map.values()].sort((a, b) => b.pulls - a.pulls);
  }, [state.cards]);

  const tiers = useMemo(() => {
    const found = new Set<RarityTier>();
    for (const entry of Object.values(state.cards)) found.add(entry.card.tier);
    return [...found].sort((a, b) => tierRank(b) - tierRank(a));
  }, [state.cards]);

  const visible = useMemo(() => {
    const list = Object.values(state.cards).filter((entry) => {
      if (setFilter && entry.card.setId !== setFilter) return false;
      if (tierFilter && entry.card.tier !== tierFilter) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sort === "name") return a.card.name.localeCompare(b.card.name);
      if (sort === "recent") return b.firstPulledAt - a.firstPulledAt;
      const tierDelta = tierRank(b.card.tier) - tierRank(a.card.tier);
      return tierDelta !== 0 ? tierDelta : b.quantity - a.quantity;
    });
  }, [state.cards, setFilter, tierFilter, sort]);

  const rarest = useMemo(() => rarestPulls(state, 6), [state]);
  const recent = state.history.slice(0, 6);
  const isEmpty = Object.keys(state.cards).length === 0;

  return (
    <div>
      <div className="mb-5">
        <Link to="/packs" className="mb-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline">
          <ArrowLeft size={12} aria-hidden="true" /> Pack simulator
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Simulated collection</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Cards you have pulled in virtual packs. Saved in this browser only, with duplicates counted — and never mixed into your real vault.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent-2)]/30 bg-[var(--warning-soft)] p-3 text-[11px] leading-relaxed text-[var(--accent-2)]">
        <TriangleAlert size={14} className="shrink-0" aria-hidden="true" />
        <span>
          These are simulated pulls, not physical cards. They have no monetary value and are excluded from every price and valuation feature.{" "}
          <Link to="/collection" className="font-bold underline">
            Go to your real vault
          </Link>
          .
        </span>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Packs opened", value: stats.packsOpened.toLocaleString(), icon: PackageOpen },
          { label: "Unique cards", value: stats.uniqueCards.toLocaleString(), icon: Layers },
          { label: "Total pulls", value: stats.totalCards.toLocaleString(), icon: Sparkles },
          { label: "Duplicates", value: stats.dupes.toLocaleString(), icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface p-3">
            <dt className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">
              <Icon size={11} aria-hidden="true" /> {label}
            </dt>
            <dd className="mt-1 text-xl font-black tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {isEmpty ? (
        <EmptyState
          icon={<PackageOpen size={40} />}
          title="No simulated pulls yet"
          description="Open a booster pack in the simulator and every card you pull will be collected here."
          action={{ label: "Open a pack", to: "/packs" }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <div>
                <label htmlFor="sim-set" className="sr-only">
                  Filter by expansion
                </label>
                <select id="sim-set" value={setFilter} onChange={(event) => setSetFilter(event.target.value)} className="field">
                  <option value="">All expansions</option>
                  {ownedSets.map((entry) => (
                    <option key={entry.setId} value={entry.setId}>
                      {entry.setName} ({entry.unique})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sim-rarity" className="sr-only">
                  Filter by rarity
                </label>
                <select id="sim-rarity" value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} className="field">
                  <option value="">All rarities</option>
                  {tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {TIER_LABELS[tier as keyof typeof TIER_LABELS]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sim-sort" className="sr-only">
                  Sort cards
                </label>
                <select id="sim-sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="field">
                  <option value="rarest">Rarest first</option>
                  <option value="recent">Recently pulled</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="surface p-6 text-center text-sm text-[var(--muted)]">No simulated cards match those filters.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                {visible.map((entry) => (
                  <div key={entry.card.id} className="group relative">
                    <Link to={`/card/${entry.card.id}`} className="block no-underline" aria-label={`${entry.card.name}, ${TIER_LABELS[entry.card.tier]}`}>
                      <PackCard pull={entry.card} revealed motion={false} compact />
                    </Link>
                    {entry.quantity > 1 && (
                      <span className="absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-white">
                        ×{entry.quantity}
                      </span>
                    )}
                    <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text)]">{entry.card.name}</p>
                    <p className="truncate text-[9px] text-[var(--muted)]">
                      {entry.card.setName} · {TIER_LABELS[entry.card.tier]}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 p-3">
              <div className="text-[11px] text-[var(--muted)]">
                Resetting removes every simulated pull and the opening history from this browser. Your real vault is untouched.
              </div>
              {confirmReset ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary px-3 py-1.5 text-xs"
                    onClick={() => {
                      reset();
                      setConfirmReset(false);
                    }}
                  >
                    <Trash2 size={12} aria-hidden="true" /> Yes, reset
                  </button>
                  <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={12} aria-hidden="true" /> Reset simulated collection
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="surface p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                <Sparkles size={11} aria-hidden="true" /> Rarest pulls
              </h2>
              {rarest.length ? (
                <ul className="mt-2 space-y-1.5">
                  {rarest.map((entry) => (
                    <li key={entry.card.id} className="flex items-center justify-between gap-2 text-xs">
                      <Link to={`/card/${entry.card.id}`} className="min-w-0 truncate text-[var(--text-soft)]">
                        {entry.card.name}
                      </Link>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--accent-2)]">{TIER_LABELS[entry.card.tier]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">Nothing pulled yet.</p>
              )}
            </section>

            <section className="surface p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                <Clock size={11} aria-hidden="true" /> Recently opened
              </h2>
              {recent.length ? (
                <ul className="mt-2 space-y-2">
                  {recent.map((pack) => (
                    <li key={pack.id} className="text-xs">
                      <Link to={`/packs/${pack.setId}`} className="block truncate font-semibold text-[var(--text-soft)]">
                        {pack.setName}
                      </Link>
                      <span className="text-[10px] text-[var(--muted)]">
                        {new Date(pack.openedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {pack.bestTier ? ` · ${TIER_LABELS[pack.bestTier]}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">No packs opened yet.</p>
              )}
            </section>

            <section className="surface p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                <Layers size={11} aria-hidden="true" /> Set progress
              </h2>
              {ownedSets.length ? (
                <ul className="mt-2 space-y-2">
                  {ownedSets.slice(0, 5).map((entry) => {
                    const total = setTotals.get(entry.setId);
                    const percent = total ? Math.min(100, (entry.unique / total) * 100) : null;
                    return (
                      <li key={entry.setId}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px]">
                          <span className="truncate text-[var(--text-soft)]">{entry.setName}</span>
                          <span className={cn("shrink-0 tabular-nums", percent == null ? "text-[var(--muted-dim)]" : "text-[var(--text)]")}>
                            {percent == null ? `${entry.unique}` : `${entry.unique}/${total} · ${percent.toFixed(0)}%`}
                          </span>
                        </div>
                        {percent != null && (
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-inset)]" aria-hidden="true">
                            <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${percent}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--muted)]">Nothing pulled yet.</p>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
                Completion compares unique simulated cards with the published set size. It is not a real collection percentage.
              </p>
            </section>
          </aside>
        </div>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-[var(--muted-dim)]">
        {summariseSim(state).packsOpened.toLocaleString()} simulated packs opened · data stored locally under{" "}
        <code className="font-mono">pokeguru_pack_sim_v1</code> · nothing is uploaded.
      </p>
    </div>
  );
}
