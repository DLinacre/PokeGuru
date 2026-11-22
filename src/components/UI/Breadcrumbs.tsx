import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";

export interface Crumb {
  name: string;
  /** Omit for the current page — it is rendered as text with `aria-current`. */
  path?: string;
}

/**
 * Visible breadcrumb trail.
 *
 * Rendered on card and set pages so the structured data (`breadcrumbSchema`)
 * always describes navigation a person can actually see — Google's requirement
 * for BreadcrumbList.
 */
export default function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-[var(--muted)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-1">
              {item.path && !last ? (
                <Link
                  to={item.path}
                  className="truncate text-[var(--muted)] no-underline transition-colors hover:text-[var(--accent-text)] hover:no-underline"
                >
                  {item.name}
                </Link>
              ) : (
                <span className="truncate text-[var(--text)]" aria-current={last ? "page" : undefined}>
                  {item.name}
                </span>
              )}
              {!last && <ChevronRight size={11} aria-hidden="true" className="shrink-0 text-[var(--muted-dim)]" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
