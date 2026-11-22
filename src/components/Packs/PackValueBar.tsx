import { RefreshCw, TriangleAlert } from "lucide-react";
import type { PackValueTotals } from "../../types/packs";
import { formatGbp } from "../../services/pricing";
import { cn } from "../../utils/cn";

interface PackValueBarProps {
  totals: PackValueTotals;
  /** Prices are still streaming in. */
  loading: boolean;
  /** Lookups that failed (already counted as unavailable). */
  failures?: number;
  onRetry?: () => void;
  reduceMotion?: boolean;
  className?: string;
}

/**
 * The running pack total.
 *
 * It states the *known* value and, directly underneath, how many cards it
 * covers. That is the whole point: a pack of eight cards with six prices is
 * "£12.48 across 6 of 8 cards", never "this pack is worth £12.48".
 */
export default function PackValueBar({
  totals,
  loading,
  failures = 0,
  onRetry,
  reduceMotion = false,
  className,
}: PackValueBarProps) {
  const hasValue = totals.priced > 0;
  const amount = formatGbp(totals.totalGbp);
  const awaiting = totals.pending;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--success)]/30 bg-[linear-gradient(120deg,rgba(47,191,113,0.14),rgba(47,191,113,0.03)_55%,transparent)] px-3 py-2.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6fe3a5]">
            Current pack value
          </p>
          <p
            key={hasValue ? Math.round(totals.totalGbp * 100) : "empty"}
            className={cn(
              "mt-0.5 text-2xl font-black leading-none tabular-nums tracking-tight text-[var(--text)] sm:text-[28px]",
              hasValue && !reduceMotion && "animate-value-pop"
            )}
            aria-hidden="true"
          >
            {hasValue ? amount : "—"}
          </p>
          {/* Announced separately: the visible figure is keyed to restart its
              animation, which would break a live region on the element itself.
              Deliberately not `role="status"` — the opening callout owns that,
              and two of them would make the announcement ambiguous. */}
          <span className="sr-only" aria-live="polite">
            {hasValue
              ? `Pack value ${amount} across ${totals.priced} of ${totals.cards} cards`
              : awaiting > 0
                ? "Prices are still loading"
                : failures > 0
                  ? "Prices could not be loaded"
                  : "No Cardmarket price for this pack"}
          </span>
          <p className="mt-1 text-[10px] leading-tight text-[var(--muted)]">
            {hasValue ? (
              <>
                Known value of {totals.priced} of {totals.cards} card
                {totals.cards === 1 ? "" : "s"}
                {awaiting > 0 || totals.unavailable > 0 ? " — not the whole pack" : ""}
              </>
            ) : awaiting > 0 ? (
              "Prices are still loading"
            ) : failures > 0 ? (
              "Prices could not be loaded — the cards are unaffected"
            ) : (
              "No Cardmarket price for any card in this pack"
            )}
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-1 gap-y-0.5 text-right text-[10px] leading-tight">
          <div className="flex items-baseline justify-end gap-1.5">
            <dt className="text-[var(--muted)]">Priced</dt>
            <dd className="font-bold tabular-nums text-[#6fe3a5]">
              {totals.priced}
            </dd>
          </div>
          <div className="flex items-baseline justify-end gap-1.5">
            <dt className="text-[var(--muted)]">Unavailable</dt>
            <dd className="font-bold tabular-nums text-[var(--muted)]">
              {totals.unavailable}
            </dd>
          </div>
          {awaiting > 0 && (
            <div className="flex items-baseline justify-end gap-1.5">
              <dt className="text-[var(--muted)]">Awaiting</dt>
              <dd className="font-bold tabular-nums text-[#a5d8ff]">{awaiting}</dd>
            </div>
          )}
        </dl>
      </div>

      {(loading || failures > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border)]/70 pt-1.5">
          <p className="flex items-center gap-1 text-[10px] text-[var(--muted-dim)]">
            {loading ? (
              <>
                <RefreshCw
                  size={10}
                  className={cn("animate-spin-slow", reduceMotion && "animate-none")}
                  aria-hidden="true"
                />
                Resolving {awaiting} more price{awaiting === 1 ? "" : "s"}…
              </>
            ) : (
              <>
                <TriangleAlert size={10} aria-hidden="true" />
                {failures} price lookup{failures === 1 ? "" : "s"} failed — the pack
                opened exactly as it would have.
              </>
            )}
          </p>
          {failures > 0 && onRetry && !loading && (
            <button
              type="button"
              onClick={onRetry}
              className="text-[10px] font-bold text-[var(--link)] underline-offset-2 hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
