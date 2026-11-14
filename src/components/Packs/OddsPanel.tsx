import { CircleHelp, ExternalLink, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { PackOdds } from "../../types/packs";
import { confidenceLabel } from "../../data/packRules";

function percent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 0.001) return "<0.1%";
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function checkedDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function OddsPanel({ odds }: { odds: PackOdds }) {
  const documented = odds.confidence === "documented";

  return (
    <section aria-labelledby="odds-heading" className="surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="odds-heading" className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[var(--text)]">
            <CircleHelp size={15} className="text-[var(--accent-2)]" aria-hidden="true" />
            Pack odds &amp; methodology
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {documented
              ? "Pack structure from the product guidance; tier odds are a PokeGuru estimate."
              : "Pack size is documented; slot split and tier odds are a PokeGuru estimate."}
          </p>
        </div>
        <span
          className={
            documented
              ? "chip border-[var(--success)]/40 bg-[var(--success-soft)] text-[var(--success)]"
              : "chip border-[var(--accent-2)]/40 bg-[var(--warning-soft)] text-[var(--accent-2)]"
          }
        >
          {documented ? <ShieldCheck size={11} aria-hidden="true" /> : <TriangleAlert size={11} aria-hidden="true" />}
          {confidenceLabel(odds.confidence)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">Pack structure</h3>
          <ul className="space-y-1.5 text-xs text-[var(--text-soft)]">
            {odds.slotSummary.map((slot) => (
              <li key={slot.slot} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span>{slot.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
            Chance per pack (estimate)
          </h3>
          {odds.rows.length ? (
            <ul className="space-y-1.5">
              {odds.rows.slice(0, 9).map((row) => (
                <li key={row.tier} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[var(--text-soft)]">{row.label}</span>
                    <span className="shrink-0 font-bold tabular-nums text-[var(--text)]">{percent(row.perPack)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-inset)]" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]"
                      style={{ width: `${Math.min(100, row.perPack * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">No rarity pool was available, so no odds can be shown.</p>
          )}
        </div>
      </div>

      {odds.thin && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--accent-2)]/30 bg-[var(--warning-soft)] p-2.5 text-[11px] leading-relaxed text-[var(--accent-2)]">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          Some rarity pools in this expansion are very small, so the modelled percentages are coarse.
        </p>
      )}

      <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-[var(--muted)]">
        <p className="flex items-start gap-2">
          <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="text-[var(--text-soft)]">Source:</strong> {odds.source.label}
            {odds.source.url && (
              <>
                {" · "}
                <a href={odds.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5">
                  read it <ExternalLink size={10} aria-hidden="true" />
                </a>
              </>
            )}
            <br />
            {odds.source.note}
          </span>
        </p>
        {odds.notes && <p>{odds.notes}</p>}
        <p>
          Last checked {checkedDate(odds.checkedAt)}. Pokémon does not publish per-rarity odds for individual expansions, and we have no
          measured sample for this set, so the tier percentages are modelled from the documented pack size and the set&apos;s own rarity mix.
          They are entertainment values, not official pull rates.
        </p>
      </div>
    </section>
  );
}
