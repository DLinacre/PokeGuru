import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Coins,
  History,
  Layers,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { clearOpenings, useSim } from "../services/simStore";
import { formatGbp } from "../services/pricing";
import type { OpeningSession } from "../types/packs";
import { TIER_LABELS, tierRank } from "../data/packRules";
import { cn } from "../utils/cn";

function formatStamp(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "£4.20 · 7 of 10 priced · 3 unavailable" for one recorded pack. */
function coverageLabel(session: OpeningSession): string {
  const { priced, cards, unavailable } = session.totals;
  if (!session.valuesRecorded) return `${cards} cards · values not recorded`;
  return `${priced} of ${cards} priced${unavailable > 0 ? ` · ${unavailable} unavailable` : ""}`;
}

/**
 * Best pull by recorded value when one exists; otherwise by rarity tier, and
 * labelled as such — never by a price we do not have.
 */
function bestPullName(session: OpeningSession): string | null {
  if (session.totals.highest) return session.totals.highest.name;
  const tier = session.packs.reduce<OpeningSession["packs"][number]["bestTier"]>(
    (best, pack) => {
      if (!pack.bestTier) return best;
      if (!best) return pack.bestTier;
      return tierRank(pack.bestTier) > tierRank(best) ? pack.bestTier : best;
    },
    null,
  );
  return tier ? TIER_LABELS[tier] : null;
}

/**
 * Opening history.
 *
 * Reads only what was written at the time of the opening: the totals here are
 * the amounts that were current then, not today's market. Sessions saved
 * before value tracking existed say so instead of showing a zero.
 */
export default function PackHistoryPage() {
  const { state } = useSim();
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const openings = state.openings;

  usePageMeta({
    title: "Pack opening history",
    description:
      "Review previous simulated pack openings with the Cardmarket values that were current when each pack was opened.",
    path: "/packs/history",
    robots: "noindex,follow",
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/packs"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline"
      >
        <ArrowLeft size={12} aria-hidden="true" /> All packs
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">
            <History size={12} aria-hidden="true" /> Saved on this device
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Opening history
          </h1>
          <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">
            The last {openings.length || ""} openings, each with the Cardmarket
            values that were current at the time. Totals are frozen: they do not
            follow today&apos;s market.
          </p>
        </div>
        {openings.length > 0 && (
          <div className="flex gap-2">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-[#ff9aa0]"
                  onClick={() => {
                    clearOpenings();
                    setConfirmClear(false);
                    setOpen(null);
                  }}
                >
                  Delete all
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost text-xs"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={13} aria-hidden="true" /> Clear history
              </button>
            )}
          </div>
        )}
      </div>

      {openings.length === 0 ? (
        <div className="surface mt-5 p-6 text-center">
          <Coins
            size={26}
            className="mx-auto text-[var(--muted-dim)]"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-lg font-bold">No openings recorded yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
            Open a pack and PokeGuru keeps the values it saw at that moment, so
            you can look back at what a pull was worth when you pulled it.
          </p>
          <Link to="/packs" className="btn btn-primary mt-4 no-underline hover:no-underline">
            <Layers size={14} aria-hidden="true" /> Choose a pack
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {openings.map((session) => {
            const expanded = open === session.id;
            const best = bestPullName(session);
            return (
              <li key={session.id} className="surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : session.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {session.setName || "Unknown expansion"}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">
                      {formatStamp(session.completedAt)} · {session.packs.length} pack
                      {session.packs.length === 1 ? "" : "s"} · {session.totals.cards} cards
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--muted-dim)]">
                      {coverageLabel(session)}
                      {session.legacy ? " · saved before price tracking" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-right">
                      <span className="block text-sm font-black tabular-nums text-[#6fe3a5]">
                        {session.valuesRecorded
                          ? formatGbp(session.totals.totalGbp) ?? "—"
                          : "—"}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--muted-dim)]">
                        {best ? (session.totals.highest ? `Best: ${best}` : `Top rarity: ${best}`) : "no priced pull"}
                      </span>
                    </span>
                    <ChevronDown
                      size={15}
                      className={cn(
                        "text-[var(--muted)] transition-transform",
                        expanded && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-[var(--border)] px-3.5 py-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]/50 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                          Recorded value
                        </p>
                        <p className="text-sm font-bold tabular-nums text-[#6fe3a5]">
                          {session.valuesRecorded
                            ? formatGbp(session.totals.totalGbp) ?? "—"
                            : "Not recorded"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]/50 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                          Priced cards
                        </p>
                        <p className="text-sm font-bold tabular-nums">
                          {session.totals.priced} / {session.totals.cards}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]/50 py-1.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                          Best pull
                        </p>
                        <p className="truncate text-sm font-bold" title={best ?? undefined}>
                          {best ?? "—"}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-2 space-y-1.5">
                      {session.packs.map((pack, index) => (
                        <li
                          key={pack.packId}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs font-semibold">
                              Pack {index + 1}
                              <span className="font-normal text-[var(--muted)]">
                                {" "}
                               · {formatStamp(pack.openedAt)}
                              </span>
                            </p>
                            <p className="shrink-0 text-xs font-bold tabular-nums text-[#6fe3a5]">
                              {pack.totals.priced > 0
                                ? formatGbp(pack.totals.totalGbp)
                                : "No price"}
                            </p>
                          </div>
                          <p className="text-[11px] text-[var(--muted-dim)]">
                            {pack.totals.priced} of {pack.totals.cards} priced
                            {pack.totals.unavailable > 0
                              ? ` · ${pack.totals.unavailable} unavailable`
                              : ""}
                            {pack.bestTier ? ` · ${TIER_LABELS[pack.bestTier]} best` : ""}
                          </p>
                          {pack.pulls.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {pack.pulls.map((pull) => (
                                <li
                                  key={`${pull.key}-${pull.cardId}`}
                                  className={cn(
                                    "rounded border px-1.5 py-0.5 text-[10px] tabular-nums",
                                    pull.status === "priced"
                                      ? "border-[#2fbf71]/30 bg-[#2fbf71]/10 text-[#8ce8b4]"
                                      : "border-[var(--border)] text-[var(--muted-dim)]"
                                  )}
                                  title={
                                    pull.status === "priced"
                                      ? `${pull.printing} · ${pull.basis ?? "value"}${
                                          pull.priceUpdatedAt
                                            ? ` · marketplace ${pull.priceUpdatedAt.slice(0, 10)}`
                                            : ""
                                        }${pull.fxRate ? ` · EUR→GBP ${pull.fxRate.toFixed(4)}` : ""}`
                                      : pull.reason
                                  }
                                >
                                  {pull.name.length > 18
                                    ? `${pull.name.slice(0, 17)}…`
                                    : pull.name}{" "}
                                  {pull.status === "priced" && pull.gbp != null
                                    ? formatGbp(pull.gbp)
                                    : "—"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Link
                        to={`/packs/${session.setId}${session.packs[0]?.seed ? `?seed=${session.packs[0].seed}` : ""}`}
                        className="btn btn-ghost btn-compact text-[11px] no-underline hover:no-underline"
                      >
                        <RotateCcw size={12} aria-hidden="true" /> Replay this seed
                      </Link>
                      <span className="chip text-[10px]">
                        <Sparkles size={10} aria-hidden="true" /> Values as recorded
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
                      Amounts are Cardmarket reference values converted to GBP at
                      the rate in force when the pack was opened. Replaying the
                      seed reproduces the same cards, but prices will be today&apos;s.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
