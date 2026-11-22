import type { PullValuation } from "../../types/packs";
import { formatGbp } from "../../services/pricing";
import { cn } from "../../utils/cn";

interface PullValueLineProps {
  value: PullValuation | null | undefined;
  /** Distinguishes "still loading" from "nothing published". */
  pending?: boolean;
  className?: string;
  /** Larger treatment for the summary and the best-pull card. */
  size?: "xs" | "sm";
}

/**
 * The price under a single card.
 *
 * Deliberately a fixed-height, single line so cards never jump as values
 * arrive. Three honest states: a GBP value, "No price" (Cardmarket publishes
 * nothing for that finish), and "•••" while the lookup is in flight.
 */
export default function PullValueLine({
  value,
  pending = false,
  className,
  size = "xs",
}: PullValueLineProps) {
  const base = cn(
    "truncate text-center tabular-nums leading-tight",
    size === "xs" ? "text-[10px]" : "text-xs",
    className
  );

  if (!value) {
    if (pending) {
      return (
        <span
          className={cn(base, "text-[var(--muted-dim)]")}
          title="Price still loading"
          aria-label="Price still loading"
        >
          •••
        </span>
      );
    }
    return (
      <span className={cn(base, "text-[var(--muted-dim)]")}>—</span>
    );
  }

  if (value.status === "priced" && value.gbp != null) {
    return (
      <span
        className={cn(base, "font-bold text-[#6fe3a5]")}
        title={`Cardmarket ${value.basis ?? "value"} · ${value.printing}${
          value.priceUpdatedAt ? ` · updated ${value.priceUpdatedAt.slice(0, 10)}` : ""
        }`}
      >
        {formatGbp(value.gbp)}
      </span>
    );
  }

  // A lookup that failed is not the same as a price that does not exist. Say
  // which one it was, and never dress a network error up as marketplace data.
  const failed = value.flags?.includes("lookup-failed") ?? false;
  return (
    <span
      className={cn(base, "text-[var(--muted-dim)]")}
      title={value.reason ?? "No Cardmarket price for this printing"}
      aria-label={failed ? "Price unavailable: lookup failed" : "No Cardmarket price"}
    >
      {failed ? "No data" : "No price"}
    </span>
  );
}
