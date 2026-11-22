import { Info, RefreshCw, ShieldAlert } from "lucide-react";
import type { PackValueTotals } from "../../types/packs";
import type { ExchangeRate } from "../../services/currency";
import type { SessionValueSummary } from "../../services/packValues";
import { formatGbp, formatUpdatedAtLong } from "../../services/pricing";
import { cn } from "../../utils/cn";

interface PackValueSummaryProps {
  /** Totals for each pack, in opening order. */
  packTotals: PackValueTotals[];
  summary: SessionValueSummary;
  loading: boolean;
  failures: number;
  onRetry?: () => void;
  rate: ExchangeRate | null;
  className?: string;
}

function Tile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "muted";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/50 px-2.5 py-2">
      <p className="text-[9px] font-black uppercase leading-tight tracking-[0.14em] text-[var(--muted-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-base font-black tabular-nums leading-tight",
          tone === "good" && "text-[#6fe3a5]",
          tone === "muted" && "text-[var(--muted)]"
        )}
        title={value}
      >
        {value}
      </p>
      {hint && (
        <p className="truncate text-[10px] leading-tight text-[var(--muted)]" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The value summary for a finished opening.
 *
 * Every figure is a known-value figure: unpriced cards are counted and named,
 * never averaged in as zero, and the pack/session distinction is explicit.
 */
export default function PackValueSummary({
  packTotals,
  summary,
  loading,
  failures,
  onRetry,
  rate,
  className,
}: PackValueSummaryProps) {
  const { totals } = summary;
  const single = packTotals.length === 1;
  const partial = totals.unavailable > 0 || totals.pending > 0;
  const nothing = totals.priced === 0;

  return (
    <section
      aria-labelledby="value-summary-heading"
      className={cn("surface overflow-hidden", className)}
    >
      <div className="border-b border-[var(--border)] bg-[linear-gradient(120deg,rgba(47,191,113,0.12),transparent_60%)] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="value-summary-heading"
              className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6fe3a5]"
            >
              Market value · Cardmarket GBP
            </h2>
            <p className="mt-1 text-3xl font-black leading-none tabular-nums tracking-tight sm:text-4xl">
              {nothing ? "—" : formatGbp(totals.totalGbp)}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
              {nothing ? (
                loading ? (
                  "Prices are still loading."
                ) : (
                  "No Cardmarket price was available for any card in this opening, so no total is shown."
                )
              ) : (
                <>
                  Known value of <strong className="text-[var(--text-soft)]">{totals.priced}</strong>{" "}
                  of {totals.cards} card{totals.cards === 1 ? "" : "s"}
                  {partial ? " — this is not the full value of the opening" : ""}
                </>
              )}
            </p>
          </div>

          <div className="text-right text-[10px] leading-relaxed text-[var(--muted)]">
            <p className="font-bold uppercase tracking-[0.14em] text-[var(--muted-dim)]">
              Coverage
            </p>
            <p className="tabular-nums">
              {totals.priced} priced · {totals.unavailable} unavailable
              {totals.pending > 0 ? ` · ${totals.pending} awaiting` : ""}
            </p>
            {rate && (
              <p className="text-[var(--muted-dim)]">
                FX {formatUpdatedAtLong(rate.date) ?? rate.date}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <Tile
          label="Cards opened"
          value={String(totals.cards)}
          hint={single ? "1 pack" : `${packTotals.length} packs`}
        />
        <Tile
          label="Priced"
          value={String(totals.priced)}
          hint={nothing ? "none available" : `${totals.unavailable} without a price`}
          tone="good"
        />
        <Tile
          label="Highest pull"
          value={summary.best ? formatGbp(summary.best.gbp) ?? "—" : "—"}
          hint={summary.best?.name ?? "no priced pull"}
        />
        <Tile
          label="Lowest priced pull"
          value={totals.lowest ? formatGbp(totals.lowest.gbp) ?? "—" : "—"}
          hint={totals.lowest?.name ?? "nothing priced"}
        />
        <Tile
          label="Average per priced card"
          value={totals.averageGbp != null ? formatGbp(totals.averageGbp) ?? "—" : "—"}
          hint={`across ${totals.priced} priced card${totals.priced === 1 ? "" : "s"}`}
        />
        {!single && (
          <>
            <Tile
              label="Average known value per pack"
              value={
                summary.averagePerPricedPack != null
                  ? formatGbp(summary.averagePerPricedPack) ?? "—"
                  : "—"
              }
              hint={`${summary.packsWithValue} of ${summary.packs} packs had a price`}
            />
            <Tile
              label="Best pack"
              value={
                summary.bestPack ? formatGbp(summary.bestPack.totalGbp) ?? "—" : "—"
              }
              hint={summary.bestPack ? `pack ${summary.bestPack.packIndex + 1}` : "no priced pack"}
            />
            <Tile
              label="Packs opened"
              value={String(summary.packs)}
              hint={`${summary.packsWithoutValue} with no priced card`}
              tone="muted"
            />
          </>
        )}
      </div>

      {partial && !nothing && (
        <div className="flex items-start gap-2 border-t border-[var(--border)] px-3.5 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            {totals.unavailable} card{totals.unavailable === 1 ? "" : "s"} in this opening
            {totals.unavailable === 1 ? " has" : " have"} no Cardmarket price for the finish
            that was pulled — reverse holofoils usually, because TCGdex does not publish a
            reverse-holo band. They are excluded from every total and average here rather
            than counted as £0.
            {totals.pending > 0
              ? ` ${totals.pending} price${totals.pending === 1 ? " is" : "s are"} still loading.`
              : ""}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-3.5 py-2 text-[11px] text-[var(--muted-dim)]">
          <RefreshCw size={11} className="animate-spin-slow" aria-hidden="true" />
          Still resolving prices — this total will grow as they arrive.
        </div>
      )}

      {failures > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3.5 py-2 text-[11px] text-[var(--muted)]">
          <span>
            {failures} price lookup{failures === 1 ? "" : "s"} failed and{" "}
            {failures === 1 ? "is" : "are"} excluded from the totals.
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 text-[11px] font-bold text-[var(--link)] underline-offset-2 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 border-t border-[var(--border)] px-3.5 py-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
        <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Reference valuations, not offers: Cardmarket trend prices supplied by TCGdex,
          converted from EUR at the ECB reference rate
          {rate ? ` of ${formatUpdatedAtLong(rate.date) ?? rate.date}` : ""}. Your cards are
          simulated and have no real-world value.
        </p>
      </div>
    </section>
  );
}
