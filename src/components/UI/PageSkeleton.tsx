import SkeletonGrid from "./SkeletonGrid";

/** Lightweight route-level loading state used by Suspense and data fetches. */
export default function PageSkeleton({ title = "Loading…", cards = 12 }: { title?: string; cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-fade-in">
      <div className="mb-6 space-y-3">
        <div className="h-7 w-52 animate-shimmer overflow-hidden rounded-lg bg-[var(--bg-card)]" />
        <div className="h-4 w-80 max-w-full animate-shimmer overflow-hidden rounded bg-[var(--bg-card)]/70" />
      </div>
      <span className="sr-only">{title}</span>
      <SkeletonGrid count={cards} />
    </div>
  );
}
