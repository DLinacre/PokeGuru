import type { PulledCard } from "../../types/packs";
import { TIER_LABELS } from "../../data/packRules";
import PackCard from "./PackCard";
import { pullDrama } from "./PullBurst";
import { tierRank } from "../../data/packRules";
import { cn } from "../../utils/cn";

const MAX_FACES = 8;

interface HighlightStripProps {
  cards: PulledCard[];
  /** Shown when nothing hit — keeps the layout honest instead of empty. */
  emptyCopy: string;
  label: string;
  className?: string;
}

/**
 * The cards worth looking at, as faces rather than a number.
 *
 * A count alone ("0 rare or better") reads like a bug when a favourite card is
 * on screen, so the summary leads with the actual artwork of anything better
 * than a plain rare, rarest first.
 */
export default function HighlightStrip({
  cards,
  emptyCopy,
  label,
  className,
}: HighlightStripProps) {
  const shown = cards.slice(0, MAX_FACES);
  const overflow = cards.length - shown.length;

  return (
    <div className={cn("surface p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
          {label}
        </p>
        <span className="text-[10px] font-bold tabular-nums text-[var(--muted)]">
          {cards.length}
        </span>
      </div>

      {shown.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
          {shown.map((card, index) => (
            <div
              key={`${card.id}-${card.slot}-${index}`}
              className="relative w-11 shrink-0"
            >
              <PackCard pull={card} revealed motion={false} compact />
              {tierRank(card.tier) >= 7 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full",
                    pullDrama(card.tier) === "top"
                      ? "bg-[var(--accent)] shadow-[0_0_6px_2px_rgba(240,68,82,0.6)]"
                      : "bg-[var(--accent-2)] shadow-[0_0_6px_2px_rgba(245,165,36,0.5)]",
                  )}
                />
              )}
            </div>
          ))}
          {overflow > 0 && (
            <span className="shrink-0 text-[10px] font-semibold text-[var(--muted-dim)]">
              +{overflow}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">
          {emptyCopy}
        </p>
      )}

      {shown.length > 0 && (
        <p className="mt-1.5 truncate text-[10px] text-[var(--muted-dim)]">
          {shown
            .slice(0, 3)
            .map((card) => `${card.name} (${TIER_LABELS[card.tier]})`)
            .join(" · ")}
          {shown.length > 3 ? " …" : ""}
        </p>
      )}
    </div>
  );
}
