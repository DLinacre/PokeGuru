import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  /** Omit when the API does not expose a total. */
  totalItems?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
}

function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("gap");
    result.push(page);
  });
  return result;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  hasNextPage,
}: PaginationProps) {
  const totalPages = totalItems != null && totalItems > 0 ? Math.ceil(totalItems / pageSize) : null;
  const canGoPrev = currentPage > 1;
  const canGoNext = totalPages != null ? currentPage < totalPages : Boolean(hasNextPage);

  if (!canGoPrev && !canGoNext) return null;

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-2 py-8">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
        className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      {totalPages ? (
        <ul className="flex items-center gap-1">
          {pageWindow(currentPage, totalPages).map((page, index) =>
            page === "gap" ? (
              <li key={`gap-${index}`} className="px-1 text-[var(--muted)]" aria-hidden="true">
                <MoreHorizontal size={16} />
              </li>
            ) : (
              <li key={page}>
                <button
                  type="button"
                  onClick={() => onPageChange(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                  className={`min-w-9 rounded-lg border px-2.5 py-2 text-sm font-bold transition-colors ${
                    page === currentPage
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  }`}
                >
                  {page}
                </button>
              </li>
            )
          )}
        </ul>
      ) : (
        <span className="px-2 text-sm text-[var(--muted)]">Page {currentPage}</span>
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm font-bold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
