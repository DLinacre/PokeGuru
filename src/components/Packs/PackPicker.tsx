import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Check, Boxes } from "lucide-react";
import type { PackCatalogueEntry } from "../../hooks/usePacks";
import { cn } from "../../utils/cn";
import { seriesName } from "../../services/packCatalogue";

const SHOWN = 6;

interface PackPickerProps {
  /** Every expansion the simulator can open, already sorted. */
  packs: PackCatalogueEntry[];
  /** The set currently loaded in the ripping stage. */
  activeSetId: string;
  /** How many packs the next rip uses, so a switch keeps it. */
  quantity: number;
}

/**
 * One-tap switching between expansions.
 *
 * Changing what you are ripping used to mean going back to the catalogue,
 * finding a set and starting over. This strip keeps the current set first and
 * offers the rest inline, while keeping the chosen pack count.
 */
export default function PackPicker({
  packs,
  activeSetId,
  quantity,
}: PackPickerProps) {
  const [searchParams] = useSearchParams();
  const recent = searchParams.get("recent") ?? "";

  // The set you are ripping stays first and checked, then the expansions you
  // set up most recently, then the rest in catalogue order.
  const ordered = (() => {
    const byId = new Map(packs.map((pack) => [pack.setId, pack]));
    const active = byId.get(activeSetId);
    const recentPacks = recent
      .split(",")
      .filter(Boolean)
      .map((id) => byId.get(id))
      .filter((pack): pack is PackCatalogueEntry => Boolean(pack));
    const head = [...(active ? [active] : []), ...recentPacks, ...packs];
    const seen = new Set<string>();
    return head.filter((pack) => {
      if (seen.has(pack.setId)) return false;
      seen.add(pack.setId);
      return true;
    });
  })();

  const shown = ordered.slice(0, SHOWN);
  const count = Math.max(1, Math.min(36, Math.floor(quantity)));

  /** Keeps the pack count and the recent-set history across a switch. */
  const hrefFor = (setId: string) => {
    const params = new URLSearchParams();
    if (count > 1) params.set("count", String(count));
    const history = [activeSetId, ...recent.split(",").filter(Boolean)]
      .filter(
        (id, index, all) => id && id !== setId && all.indexOf(id) === index,
      )
      .slice(0, 5);
    if (history.length) params.set("recent", history.join(","));
    const query = params.toString();
    return `/packs/${encodeURIComponent(setId)}${query ? `?${query}` : ""}`;
  };

  if (!packs.length) return null;

  return (
    <section
      aria-label="Change the packs you are ripping"
      className="surface p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">
          <ArrowLeftRight size={12} aria-hidden="true" /> Rip a different set
        </p>
        <Link
          to="/packs"
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--link)] no-underline hover:no-underline"
        >
          <Boxes size={12} aria-hidden="true" /> All {packs.length} expansions
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((pack) => {
          const active = pack.setId === activeSetId;
          return (
            <Link
              key={pack.setId}
              to={
                active
                  ? `/packs/${encodeURIComponent(pack.setId)}?count=${count}`
                  : hrefFor(pack.setId)
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold no-underline transition-colors hover:no-underline",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
              )}
              title={`${pack.setName} · ${seriesName(pack.seriesId)}`}
            >
              {active && <Check size={11} aria-hidden="true" />}
              <span className="truncate">{pack.setName}</span>
            </Link>
          );
        })}
        {ordered.length > shown.length && (
          <Link
            to="/packs"
            className="inline-flex items-center rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] no-underline hover:no-underline"
          >
            +{ordered.length - shown.length} more
          </Link>
        )}
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted-dim)]">
        Switching keeps your {count > 1 ? `${count}-pack` : "single-pack"} rip
        and returns you here ready to go.
      </p>
    </section>
  );
}
