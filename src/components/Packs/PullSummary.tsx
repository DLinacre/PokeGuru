import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Share2,
  RotateCcw,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { PackResult } from "../../types/packs";
import { TIER_LABELS, tierRank } from "../../data/packRules";
import PackCard, { isChase } from "./PackCard";
import {
  bestPull,
  batchToText,
  buildReplayUrl,
  copyText,
  downloadText,
  resultToText,
} from "../../services/packShare";
import {
  NOTABLE_RANK,
  pullCounts,
  resultHighlights,
} from "../../utils/packHighlights";
import HighlightStrip from "./HighlightStrip";
import QuickRip from "./QuickRip";
import type { PackCatalogueEntry } from "../../hooks/usePacks";
import { cn } from "../../utils/cn";

interface PullSummaryProps {
  results: PackResult[];
  onOpenAnother: (count: number) => void;
  onBack: () => void;
  /** Other expansions, so the summary can jump straight into a new rip. */
  packs?: PackCatalogueEntry[];
  /** Pack counts offered as one-press repeats. */
  ripCounts?: number[];
  /** How many packs this session used. */
  quantity?: number;
  /** Set id of the results, used to avoid offering the same set twice. */
  activeSetId?: string;
}

/**
 * Shared with the opening stage: a fixed 4/5-column grid means a whole pack is
 * always on screen — no horizontal strip and no scrolling to find a card.
 */
const PACK_GRID =
  "grid grid-cols-4 gap-x-1.5 gap-y-2 sm:grid-cols-5 sm:gap-x-2";

export default function PullSummary({
  results,
  onOpenAnother,
  onBack,
  packs = [],
  ripCounts = [1, 5, 10],
  quantity = results.length,
  activeSetId = results[0]?.setId ?? "",
}: PullSummaryProps) {
  const [copied, setCopied] = useState<"summary" | "link" | null>(null);
  const [openPack, setOpenPack] = useState<string | null>(null);
  const single = results.length === 1;
  const result = results[0];
  const best = useMemo(
    () =>
      results
        .map(bestPull)
        .filter((card): card is NonNullable<typeof card> => Boolean(card)),
    [results],
  );
  const topPull = useMemo(
    () =>
      best.reduce<(typeof best)[number] | null>(
        (top, card) =>
          !top || tierRank(card.tier) > tierRank(top.tier) ? card : top,
        null,
      ),
    [best],
  );
  const counts = useMemo(() => pullCounts(results), [results]);
  /** Notable pulls, i.e. everything better than a plain rare. */
  const rareCount = counts.notable;
  const totalCards = results.reduce((sum, pack) => sum + pack.cards.length, 0);
  const highlights = useMemo(() => resultHighlights(results), [results]);

  const flashCopied = (kind: "summary" | "link") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const copySummary = async () => {
    const text = single ? resultToText(result) : batchToText(results);
    if (await copyText(text)) flashCopied("summary");
  };

  const copyLink = async () => {
    if (!result) return;
    if (await copyText(buildReplayUrl(result))) flashCopied("link");
  };

  const share = async () => {
    const text = single ? resultToText(result) : batchToText(results);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "PokeGuru pack opening", text });
        return;
      } catch {
        /* user cancelled — fall through to copying */
      }
    }
    await copySummary();
  };

  const exportFile = () => {
    const stamp = new Date(result?.openedAt ?? Date.now())
      .toISOString()
      .slice(0, 10);
    downloadText(
      `pokeguru-${result?.setId ?? "packs"}-${stamp}.txt`,
      single ? resultToText(result) : batchToText(results),
    );
  };

  return (
    <section aria-labelledby="pull-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Simulated opening
          </p>
          <h2
            id="pull-heading"
            className="mt-1 text-2xl font-bold tracking-tight"
          >
            {single
              ? `Your ${result.setName} pack`
              : `${results.length} packs of ${result.setName}`}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {single
              ? `${totalCards} cards · ${TIER_LABELS[result.bestTier ?? "other"]} best pull`
              : `${totalCards} cards · ${
                  counts.hits > 0
                    ? `${counts.hits} ${counts.hitLabel.toLowerCase()}`
                    : `no ${counts.hitLabel.toLowerCase()}`
                }`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {highlights.badges.map((badge) => (
              <span
                key={badge}
                className={cn(
                  "chip px-2 py-0.5 text-[10px]",
                  highlights.special
                    ? "border-[var(--accent-2)]/45 bg-[var(--warning-soft)] text-[var(--accent-2)]"
                    : "text-[var(--muted)]",
                )}
              >
                {highlights.special && (
                  <Sparkles size={10} aria-hidden="true" />
                )}
                {badge}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back to pack
        </button>
      </div>

      {single ? (
        <>
          {topPull && (
            <div className="surface relative overflow-hidden p-4 sm:p-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(245,165,36,0.28),transparent_70%)]"
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="mx-auto w-[148px] shrink-0 sm:mx-0 sm:w-[168px]">
                  <PackCard
                    pull={topPull}
                    revealed
                    motion={false}
                    priority
                    compact
                  />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent-2)]">
                    <Sparkles size={12} aria-hidden="true" /> Best pull
                  </p>
                  <h3 className="mt-1 truncate text-xl font-bold">
                    {topPull.name}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {topPull.setName} · #{topPull.localId} ·{" "}
                    {TIER_LABELS[topPull.tier]}
                    {topPull.treatment === "reverse"
                      ? " · Reverse holo"
                      : topPull.treatment === "holo"
                        ? " · Holofoil"
                        : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/card/${topPull.id}`}
                      className="btn btn-secondary text-xs no-underline hover:no-underline"
                    >
                      Card details
                      <ExternalLink size={12} aria-hidden="true" />
                    </Link>
                    <span className="chip">Simulated — not owned</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <HighlightStrip
            cards={counts.cards}
            label={`${counts.notableLabel} pulled`}
            emptyCopy="No rare in this pack — the best card is shown above."
          />

          <div className={PACK_GRID}>
            {result.cards.map((card, index) => (
              <PackCard
                key={`${card.id}-${card.slot}-${index}`}
                pull={card}
                revealed
                motion={false}
                priority={index < 6}
                compact
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="surface p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                Cards pulled
              </p>
              <p className="mt-1 text-xl font-black tabular-nums">
                {totalCards}
              </p>
            </div>
            <div className="surface p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                {counts.hitLabel}
              </p>
              <p className="mt-1 text-xl font-black tabular-nums">
                {counts.hits}
              </p>
              {rareCount > counts.hits && (
                <p className="text-[10px] text-[var(--muted)]">
                  +{rareCount - counts.hits} more rare or better
                </p>
              )}
            </div>
            <div className="surface p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
                Best pull
              </p>
              <p className="mt-1 truncate text-sm font-bold">
                {topPull ? `${topPull.name}` : "—"}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {topPull ? TIER_LABELS[topPull.tier] : ""}
              </p>
            </div>
          </div>

          {/* The pulls worth looking at, as artwork rather than a number.
              A plain count reads like a bug when a favourite is on screen. */}
          <HighlightStrip
            cards={counts.cards}
            label={`${counts.notableLabel} pulled`}
            emptyCopy={`Nothing above a plain rare in these ${results.length} packs. A set's headline card — a base-set Charizard, for example — is printed as a regular rare, so it is a great pull without being a chase card.`}
          />

          {/* Every pack is shown face up, in the same order it was opened, so a
              batch reads like the single-pack summary instead of a table. */}
          <div className="space-y-2">
            {results.map((pack, index) => {
              const packBest = best[index];
              const expanded = openPack === pack.id;
              return (
                <div key={pack.id} className="surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenPack(expanded ? null : pack.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-soft)] text-[10px] font-black text-[var(--muted)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {packBest ? packBest.name : "No rare pull"}
                          {packBest && isChase(packBest) && (
                            <Sparkles
                              size={11}
                              className="ml-1 inline text-[var(--accent-2)]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">
                          {packBest ? TIER_LABELS[packBest.tier] : "—"} ·{" "}
                          {pack.cards.length} cards
                          {(() => {
                            const notable = pack.cards.filter(
                              (card) => tierRank(card.tier) >= NOTABLE_RANK,
                            ).length;
                            return notable > 0 ? ` · ${notable} notable` : "";
                          })()}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      size={15}
                      className={cn(
                        "shrink-0 text-[var(--muted)] transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {/* Preview strip: the pack's best three cards, always visible. */}
                  {!expanded && (
                    <div
                      className="flex items-center gap-1.5 px-3 pb-2.5"
                      aria-hidden="true"
                    >
                      {[...pack.cards]
                        .sort((a, b) => tierRank(b.tier) - tierRank(a.tier))
                        .slice(0, 3)
                        .map((card, cardIndex) => (
                          <div
                            key={`${card.id}-${cardIndex}`}
                            className="w-10 shrink-0"
                          >
                            <PackCard
                              pull={card}
                              revealed
                              motion={false}
                              compact
                            />
                          </div>
                        ))}
                      {pack.cards.length > 3 && (
                        <span className="text-[10px] text-[var(--muted-dim)]">
                          +{pack.cards.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  {expanded && (
                    <div className={cn(PACK_GRID, "px-3 pb-3")}>
                      {pack.cards.map((card, cardIndex) => (
                        <PackCard
                          key={`${card.id}-${cardIndex}`}
                          pull={card}
                          revealed
                          motion={false}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {packs.length > 0 && (
        <QuickRip
          packs={packs}
          counts={[...new Set([...ripCounts, quantity])]}
          quantity={quantity}
          activeSetId={activeSetId}
          onRipAgain={onOpenAnother}
        />
      )}

      <div className="surface space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <RotateCcw size={13} aria-hidden="true" /> Back to the pack
          </button>
          <Link
            to="/packs"
            className="btn btn-ghost no-underline hover:no-underline"
          >
            <Layers size={14} aria-hidden="true" /> All packs
          </Link>
          <Link
            to="/packs/collection"
            className="btn btn-ghost no-underline hover:no-underline"
          >
            <Wallet size={14} aria-hidden="true" /> Simulated collection
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={copySummary}
          >
            {copied === "summary" ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Copy size={13} aria-hidden="true" />
            )}
            {copied === "summary" ? "Copied" : "Copy summary"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={share}
          >
            <Share2 size={13} aria-hidden="true" /> Share
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={exportFile}
          >
            <Download size={13} aria-hidden="true" /> Export .txt
          </button>
          {single && (
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={copyLink}
            >
              {copied === "link" ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Layers size={13} aria-hidden="true" />
              )}
              {copied === "link" ? "Link copied" : "Copy replay link"}
            </button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          Shared summaries contain card names only — no account, device or
          location data. A replay link carries the set, pack count and random
          seed, and the same seed reproduces the same pulls while the card pool
          for that set is unchanged.
        </p>
      </div>
    </section>
  );
}
