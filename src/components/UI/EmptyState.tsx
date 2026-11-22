import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import BrandArtwork from "./BrandArtwork";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)]/40 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div className="text-[var(--muted)] opacity-60">{icon}</div>
      ) : (
        <BrandArtwork className="-mt-2 mb-1" />
      )}
      <h2 className="text-lg font-bold text-[var(--text)]">{title}</h2>
      {description && <p className="max-w-md text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
      {action &&
        (action.to ? (
          <Link
            to={action.to}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-[#dc2626] hover:no-underline"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#dc2626]"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** "No Data Available" — used anywhere the upstream APIs have no value. */
export function NoData({ label = "No Data Available", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("text-[var(--muted)] italic", className)} title="The data source does not publish this value">
      {label}
    </span>
  );
}
