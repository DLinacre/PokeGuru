import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Book, Camera, Layers, Search, Sparkles, Wallet } from "lucide-react";
import { useCardSearch, useExchangeRate, useSets } from "../hooks/useApi";
import { usePageMeta } from "../hooks/usePageMeta";
import CardGrid from "../components/Cards/CardGrid";
import SkeletonGrid from "../components/UI/SkeletonGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import { getTotalSetCount } from "../data/ukSets";

const QUICK_LINKS = [
  { label: "Charizard", to: "/search?q=charizard" },
  { label: "Pikachu", to: "/search?q=pikachu" },
  { label: "Umbreon", to: "/search?q=umbreon" },
  { label: "Illustration rares", to: "/search?rarity=Illustration%20Rare&sort=newest" },
];

const CHASE_FILTERS = {
  query: "",
  category: "Pokemon",
  rarity: "Special Illustration Rare",
  setId: "",
  sort: "newest" as const,
  page: 1,
  pageSize: 12,
};

export default function HomePage() {
  usePageMeta({
    description:
      "Search Pokémon TCG cards, explore every set, check Cardmarket reference prices in GBP and track your collection privately in your browser.",
    path: "/",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { rate } = useExchangeRate();
  const { data: sets } = useSets();
  const chase = useCardSearch(CHASE_FILTERS);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      <section className="relative overflow-hidden py-10 text-center md:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] opacity-[0.06] blur-[120px]"
        />
        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
            <span
              aria-hidden="true"
              className="relative h-10 w-10 rounded-full border-[4px] border-[#111] bg-gradient-to-b from-[#ef4444] from-50% to-white to-50% shadow-[inset_0_0_0_3px_#fff]"
            >
              <span className="absolute inset-0 m-auto h-3 w-3 rounded-full border-[4px] border-[#111] bg-white" />
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-6xl">
            The Pokémon Card <span className="text-[var(--accent)]">Guru</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base text-[var(--muted)] md:text-lg">
            Every card, every set — with Cardmarket reference prices in GBP, dated exchange rates and a private
            collection vault that never leaves your browser.
          </p>

          <form
            onSubmit={handleSearch}
            className="mx-auto mb-5 flex max-w-[640px] gap-1.5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/80 p-1.5 shadow-2xl backdrop-blur-md transition-all focus-within:border-[var(--accent)]"
            role="search"
          >
            <label htmlFor="home-search" className="sr-only">
              Search Pokémon cards by name
            </label>
            <input
              id="home-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Charizard, Pikachu, Trainer…"
              className="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[#dc2626] active:scale-95"
            >
              <Search size={16} aria-hidden="true" />
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">
            <span>Popular:</span>
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[var(--text)] no-underline transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] hover:no-underline"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mt-6 text-xs text-[var(--muted)]">
            {sets ? `${sets.length} sets indexed` : "Loading set index…"} · {getTotalSetCount()} UK sets in the wiki ·
            prices via Cardmarket + Frankfurter
          </p>
        </div>
      </section>

      <section aria-labelledby="quick-access" className="mb-14">
        <h2 id="quick-access" className="sr-only">
          Quick access
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/search", icon: Search, title: "Card search", copy: "Filter by set, rarity and category.", accent: "var(--accent)" },
            { to: "/sets", icon: Layers, title: "All sets", copy: "Browse every expansion, newest first.", accent: "var(--link)" },
            { to: "/collection", icon: Wallet, title: "The vault", copy: "Track your collection locally.", accent: "#10b981" },
            { to: "/scanner", icon: Camera, title: "Scan a card", copy: "On-device OCR finds the card for you.", accent: "var(--accent-2)" },
          ].map(({ to, icon: Icon, title, copy, accent }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 no-underline transition-all hover:-translate-y-1 hover:border-[var(--accent)]/60 hover:shadow-lg hover:no-underline"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-bold text-[var(--text)]">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{copy}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="chase-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="chase-heading" className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles size={18} className="text-[var(--accent-2)]" aria-hidden="true" />
              Chase cards
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Special Illustration Rares from the newest sets — marketplace reference prices, not sold prices.
            </p>
          </div>
          <Link
            to="/search?rarity=Special%20Illustration%20Rare&sort=newest"
            className="text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline"
          >
            See all
          </Link>
        </div>

        {chase.loading && <SkeletonGrid count={12} />}
        {chase.error && (
          <ErrorMessage message={chase.error} onRetry={chase.retry} hint="You can still browse sets and search manually." />
        )}
        {!chase.loading && !chase.error && (
          <CardGrid
            cards={chase.cards}
            rate={rate}
            emptyMessage="No chase cards were returned by the card database right now."
            priorityCount={6}
          />
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/wiki"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-bold text-[var(--text)] no-underline hover:border-[var(--accent)] hover:no-underline"
          >
            <Book size={15} aria-hidden="true" />
            Explore the UK set wiki
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-bold text-[var(--text)] no-underline hover:border-[var(--accent)] hover:no-underline"
          >
            How pricing works
          </Link>
        </div>
      </section>
    </div>
  );
}
