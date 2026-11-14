interface SkeletonGridProps {
  count?: number;
}

/** Card-shaped placeholders — reserves space so content does not jump. */
export default function SkeletonGrid({ count = 12 }: SkeletonGridProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="relative aspect-[245/337] animate-shimmer overflow-hidden bg-[var(--bg-soft)]" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-3/4 rounded bg-[var(--bg-soft)]" />
            <div className="h-2.5 w-1/2 rounded bg-[var(--bg-soft)]/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
