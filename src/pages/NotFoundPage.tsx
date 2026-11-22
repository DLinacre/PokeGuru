import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFoundPage() {
  usePageMeta({
    title: "Page not found",
    description: "This PokeGuru page does not exist. Use the search to find a Pokémon card or set instead.",
    path: "/404",
    robots: "noindex,follow",
  });

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span aria-hidden="true" className="mb-6 text-7xl">
        🔍
      </span>
      <h1 className="mb-2 text-3xl font-bold">Page not found</h1>
      <p className="mb-8 max-w-md text-[var(--muted)]">
        The page you&apos;re looking for doesn&apos;t exist. It may have moved, or the link may be mistyped.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-[#dc2626] hover:no-underline"
        >
          <Home size={17} aria-hidden="true" />
          Go home
        </Link>
        <Link
          to="/search"
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-5 py-2.5 text-sm font-bold text-[var(--text)] no-underline transition-colors hover:border-[var(--accent)] hover:no-underline"
        >
          <Search size={17} aria-hidden="true" />
          Search cards
        </Link>
      </div>
    </div>
  );
}
