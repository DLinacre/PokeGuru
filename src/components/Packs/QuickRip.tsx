import { Link } from "react-router-dom";
import { ArrowLeftRight, Redo2, Sparkles, Zap } from "lucide-react";
import type { PackCatalogueEntry } from "../../hooks/usePacks";
import { cn } from "../../utils/cn";

interface QuickRipProps {
  /** Expansions that can be ripped straight away, most recent first. */
  packs: PackCatalogueEntry[];
  /** Pack counts to offer, e.g. [1, 5, 36]. */
  counts: number[];
  /** How many packs the current session used. */
  quantity: number;
  activeSetId: string;
  onRipAgain: (count: number) => void;
}

/**
 * The "again, harder" controls shown under the opening summary.
 *
 * Two ideas, both about making a rip feel one press away: repeat the same set
 * at any count, or jump straight into a different set at the same count.
 */
export default function QuickRip({
  packs,
  counts,
  quantity,
  activeSetId,
  onRipAgain,
}: QuickRipProps) {
  const others = packs.filter((pack) => pack.setId !== activeSetId).slice(0, 4);
  const uniqueCounts = [
    ...new Set(counts.map((count) => Math.max(1, Math.floor(count)))),
  ];

  return (
    <div className="surface space-y-3 p-3">
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
          <Zap size={12} aria-hidden="true" /> Rip this set again
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {uniqueCounts.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onRipAgain(count)}
              className={cn(
                "btn btn-compact text-xs",
                count === quantity ? "btn-primary" : "btn-secondary",
              )}
            >
              <Redo2 size={13} aria-hidden="true" />
              {count === 1 ? "1 pack" : `${count} packs`}
            </button>
          ))}
        </div>
      </div>

      {others.length > 0 && (
        <div className="border-t border-[var(--border)] pt-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
            <ArrowLeftRight size={12} aria-hidden="true" /> Or rip a different
            set ({quantity > 1 ? `${quantity} packs` : "1 pack"})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {others.map((pack) => (
              <Link
                key={pack.setId}
                to={`/packs/${encodeURIComponent(pack.setId)}?count=${Math.max(1, Math.floor(quantity))}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] no-underline transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] hover:no-underline"
              >
                <Sparkles size={10} aria-hidden="true" />
                {pack.setName}
              </Link>
            ))}
            <Link
              to="/packs"
              className="inline-flex items-center rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] no-underline hover:no-underline"
            >
              Browse all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
