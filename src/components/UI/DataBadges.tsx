import { Database, WifiOff } from "lucide-react";
import type { DataSource } from "../../types/pokemon";
import { cn } from "../../utils/cn";

/**
 * Honest labels for data provenance: cached responses and offline mode are
 * always visible rather than silently presented as live data.
 */
export function CachedBadge({
  source,
  cachedAt,
  className,
}: {
  source: DataSource | null;
  cachedAt?: number;
  className?: string;
}) {
  if (source !== "cache") return null;
  const when = cachedAt
    ? new Date(cachedAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]",
        className
      )}
      title={when ? `Cached copy saved ${when}` : "Cached copy"}
    >
      <Database size={11} aria-hidden="true" />
      Cached{when ? ` · ${when}` : ""}
    </span>
  );
}

export function OfflineBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-2)]",
        className
      )}
    >
      <WifiOff size={11} aria-hidden="true" />
      Offline copy
    </span>
  );
}
