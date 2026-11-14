import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { PulledCard, RarityTier } from "../../types/packs";
import { TIER_LABELS, tierRank } from "../../data/packRules";
import PackCard from "./PackCard";
import PullBurst, { DRAMA_COPY, pullDrama } from "./PullBurst";
import { cn } from "../../utils/cn";

/** How many cards of the pile stay visible behind the top one. */
const PILE_DEPTH = 4;

interface RevealPileProps {
  /** Cards flipped so far, in reveal order. */
  revealed: PulledCard[];
  /** The card currently face up in the pile. */
  top: PulledCard | null;
  reduceMotion: boolean;
  /** True while the reveal is spamming: suppresses the long per-card glow. */
  fast?: boolean;
}

/**
 * The pile of flipped cards.
 *
 * Every flipped card is pushed onto the top of the same stack, so spamming the
 * reveal makes a visible deck build up instead of cards simply appearing in a
 * grid. Cards behind the top one are offset and rotated slightly so the stack
 * reads as physical, and the newest card keeps the rarity effects.
 */
export default function RevealPile({
  revealed,
  top,
  reduceMotion,
  fast = false,
}: RevealPileProps) {
  const stack = useMemo(() => revealed.slice(-PILE_DEPTH), [revealed]);
  const topCard = top ?? revealed[revealed.length - 1] ?? null;
  const drama = topCard ? pullDrama(topCard.tier) : "common";
  const best = useMemo<RarityTier | null>(() => {
    if (!revealed.length) return null;
    return revealed.reduce<RarityTier>(
      (bestTier, card) =>
        tierRank(card.tier) > tierRank(bestTier) ? card.tier : bestTier,
      revealed[0].tier,
    );
  }, [revealed]);

  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={
          topCard
            ? `Pile of ${revealed.length} revealed cards, on top: ${topCard.name}, ${TIER_LABELS[topCard.tier]}`
            : "No cards flipped yet"
        }
        className="relative h-[124px] w-[90px] shrink-0 sm:h-[136px] sm:w-[99px]"
      >
        {/* Ghost of the stack: only the top few are drawn, the rest are implied. */}
        {stack.length === 0 && (
          <div className="absolute inset-0 rounded-[10px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-inset)]/60" />
        )}

        {stack.length > 0 && (
          <span className="absolute inset-0 translate-x-1 translate-y-1 rounded-[10px] bg-black/35 blur-[1px]" />
        )}

        {stack.map((card, index) => {
          const isTop = index === stack.length - 1;
          // Older cards sit slightly lower, rotated, and dimmer.
          const behind = stack.length - 1 - index;
          const offset = Math.min(behind, PILE_DEPTH) * 3;
          return (
            <div
              key={`${card.id}-${card.slot}-${index}`}
              className={cn(
                "absolute inset-0",
                isTop ? "z-10" : "z-0",
                !reduceMotion && isTop && "animate-card-land",
              )}
              style={{
                transform: reduceMotion
                  ? `translate(${offset}px, ${offset}px)`
                  : `translate(${offset}px, ${offset}px) rotate(${behind * 2.5}deg)`,
                opacity: isTop ? 1 : 1 - behind * 0.16,
              }}
            >
              <PackCard
                pull={card}
                revealed
                motion={false}
                priority={isTop}
                compact
              />
            </div>
          );
        })}

        {topCard && (
          <PullBurst
            seed={`${topCard.id}-${revealed.length}`}
            drama={drama}
            static={reduceMotion || fast}
            className="rounded-[10px]"
          />
        )}

        {revealed.length > PILE_DEPTH && (
          <span className="absolute -bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white/80">
            +{revealed.length - PILE_DEPTH}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {topCard ? (
          <>
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.16em]",
                drama === "common"
                  ? "text-[var(--muted-dim)]"
                  : "text-[var(--accent-2)]",
              )}
            >
              {DRAMA_COPY[drama] || "Flipped"}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold leading-tight">
              {topCard.name}
            </p>
            <p className="truncate text-[11px] text-[var(--muted)]">
              {TIER_LABELS[topCard.tier]} · #{topCard.localId}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--muted-dim)]">
              <Sparkles size={10} aria-hidden="true" />
              {revealed.length} flipped
              {best ? ` · best ${TIER_LABELS[best]}` : ""}
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Flip a card and it lands here. Keep tapping to stack the pack up.
          </p>
        )}
      </div>

      {/* Screen-reader signal for the best pull, so the rush is still announced. */}
      <span className="sr-only" aria-live="polite">
        {topCard
          ? `${DRAMA_COPY[drama] || "Flipped"} ${topCard.name}, ${TIER_LABELS[topCard.tier]}`
          : ""}
      </span>
    </div>
  );
}
