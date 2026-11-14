import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Book, Camera, Layers, PackageOpen, Search, Sparkles, Wallet } from "lucide-react";
import { useCardSearch, useExchangeRate, useSets } from "../hooks/useApi";

import { usePageMeta } from "../hooks/usePageMeta";
import { useCollection } from "../hooks/useCollection";
import CardGrid from "../components/Cards/CardGrid";
import SkeletonGrid from "../components/UI/SkeletonGrid";
import ErrorMessage from "../components/UI/ErrorMessage";
import SetTile from "../components/Sets/SetTile";
import Brand from "../components/Layout/Brand";
import { getTotalSetCount } from "../data/ukSets";
import { enrichSetWithWikiMeta } from "../utils/setMeta";
import { formatGbp, getCardValueGbp } from "../services/pricing";

const QUICK_LINKS = [
  { label: "Charizard", to: "/search?q=charizard" },
  { label: "Pikachu", to: "/search?q=pikachu" },
  { label: "Umbreon", to: "/search?q=umbreon" },
  { label: "Illustration rares", to: "/search?rarity=Illustration%20rare&sort=newest" },
];

const HomePackTeaser = lazy(() => import("../components/Packs/HomePackTeaser"));

const CHASE_FILTERS = {
  query: "",
  category: "Pokemon",
  rarity: "Special illustration rare",
  setId: "",
  sort: "newest" as const,
  page: 1,
  pageSize: 6,
};

const FEATURES = [
  { to: "/packs", icon: PackageOpen, title: "Pack simulator", copy: "Open unlimited virtual boosters from every era — free, no ads." },
  { to: "/search", icon: Search, title: "Card search", copy: "Name, set, collector number, rarity or illustrator." },
  { to: "/sets", icon: Layers, title: "Every expansion", copy: "Complete set index, ordered by real release dates." },
  { to: "/collection", icon: Wallet, title: "The vault", copy: "Track and value your cards privately in this browser." },
  { to: "/scanner", icon: Camera, title: "Scan a card", copy: "On-device OCR reads the card, you confirm the match." },
];

export default function HomePage() {
  usePageMeta({
    description:
      "Search Pokémon TCG cards, explore every set, check Cardmarket reference prices in GBP with dated exchange rates, and track your collection privately in your browser.",
    path: "/",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { rate } = useExchangeRate();
  const { data: sets } = useSets();
  const { collection } = useCollection();
  const chase = useCardSearch(CHASE_FILTERS);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const recentSets = useMemo(() => {
    const merged = (sets ?? []).map(enrichSetWithWikiMeta);
    const dated = merged.filter((set) => set.releaseDate);
    if (!dated.length) return merged.slice(0, 4);
    return [...dated]
      .sort((a, b) => Date.parse(b.releaseDate as string) - Date.parse(a.releaseDate as string))
      .slice(0, 4);
  }, [sets]);

  const vaultCount = collection.length;
  const vaultValue = collection.reduce((sum, item) => sum + (getCardValueGbp(item.card, rate) ?? 0), 0);
  const pricedCards = collection.filter((item) => getCardValueGbp(item.card, rate) != null).length;

  return (
    <div>
      <section className="relative overflow-hidden pb-12 pt-8 text-center md:pb-16 md:pt-14" aria-labelledby="home-title">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[820px] max-w-[130vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(240,68,82,0.16),rgba(245,165,36,0.07)_42%,transparent_72%)] blur-[10px]"
        />
        <div className="relative z-10">
          <div className="mb-6 flex justify-center">
            <Brand className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/70 px-4 py-2.5 shadow-[var(--shadow)] backdrop-blur" />
          </div>

          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)]/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            <Sparkles size={12} className="text-[var(--accent-2)]" aria-hidden="true" />
            Open card data · Cardmarket reference pricing
          </p>

          <h1
            id="home-title"
            className="mx-auto max-w-3xl text-balance font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl"
          >
            Know every card you own, and what it is actually worth.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Every Pokémon TCG card and expansion, with printing-aware Cardmarket reference prices converted to GBP
            using dated exchange rates — plus a private collection vault that never leaves your browser.
          </p>

          <form
            onSubmit={handleSearch}
            className="mx-auto mt-8 flex max-w-[660px] gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/85 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-md transition-colors focus-within:border-[var(--accent)]"
            role="search"
          >
            <label htmlFor="home-search" className="sr-only">
              Search Pokémon cards by name
            </label>
            <Search size={18} className="my-auto ml-3 shrink-0 text-[var(--muted)]" aria-hidden="true" />
            <input
              id="home-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Charizard, Pikachu, Trainer…"
              autoComplete="off"
              className="min-w-0 flex-1 border-none bg-transparent px-2 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--muted-dim)]"
            />
            <button type="submit" className="btn btn-primary px-5">
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">
            <span className="text-[var(--muted-dim)]">Try</span>
            {QUICK_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="chip no-underline hover:no-underline">
                {link.label}
              </Link>
            ))}
          </div>

          <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {[
              { label: "Sets indexed", value: sets ? sets.length.toLocaleString() : "…" },
              { label: "UK sets in wiki", value: getTotalSetCount().toLocaleString() },
              { label: "Price source", value: "Cardmarket" },
              { label: "FX source", value: "Frankfurter" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-3 py-2.5">
                <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">{stat.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-bold text-[var(--text)]">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mb-14 h-64 animate-shimmer rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]/50" aria-hidden="true" />
        }
      >
        <HomePackTeaser />
      </Suspense>

      <section aria-labelledby="recent-heading" className="mb-14">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="recent-heading" className="text-xl font-bold tracking-tight">
              Recently released expansions
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">The newest sets in the card database, by release date.</p>
          </div>
          <Link to="/sets" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline hover:no-underline">
            All sets <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>

        {sets ? (
          recentSets.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentSets.map((set) => (
                <SetTile key={set.id} set={set} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No sets were returned by the card database right now.</p>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-[88px] animate-shimmer rounded-[var(--radius)] border border-[var(--border)]" />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="chase-heading" className="mb-14">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="chase-heading" className="text-xl font-bold tracking-tight">
              Special illustration rares
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              The newest cards in that rarity, with marketplace reference prices — not sold prices.
            </p>
          </div>
          <Link
            to="/search?rarity=Special%20illustration%20rare&sort=newest"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline hover:no-underline"
          >
            See all <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>

        {chase.loading && <SkeletonGrid count={6} />}
        {chase.error && !chase.loading && (
          <ErrorMessage message={chase.error} onRetry={chase.retry} hint="You can still browse sets and search manually." />
        )}
        {!chase.loading && !chase.error && (
          <CardGrid
            cards={chase.cards}
            rate={rate}
            emptyMessage="No cards in this rarity were returned by the card database right now."
            priorityCount={3}
          />
        )}
      </section>

      <section aria-labelledby="vault-heading" className="mb-14 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="grid gap-6 p-6 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <h2 id="vault-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Wallet size={17} className="text-[var(--success)]" aria-hidden="true" />
              Your collection vault
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              Saved locally in this browser only — no account, no upload. Values use the same validated Cardmarket
              pricing as the rest of the app.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/collection" className="btn btn-secondary no-underline hover:no-underline">
                Open collection
              </Link>
              <Link to="/scanner" className="btn btn-ghost no-underline hover:no-underline">
                Scan a card
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">Cards tracked</dt>
              <dd className="mt-1 text-xl font-black tabular-nums">{vaultCount.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">Priced cards</dt>
              <dd className="mt-1 text-xl font-black tabular-nums">{pricedCards.toLocaleString()}</dd>
            </div>
            <div className="col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
              <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--muted-dim)]">
                Reference value (GBP)
              </dt>
              <dd className="mt-1 text-xl font-black tabular-nums">
                {vaultCount && pricedCards ? formatGbp(vaultValue) : <span className="text-sm font-semibold text-[var(--muted)]">No Data Available</span>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="explore-heading">
        <h2 id="explore-heading" className="sr-only">
          Explore PokeGuru
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map(({ to, icon: Icon, title, copy }) => (
            <Link key={to} to={to} className="surface group flex flex-col gap-3 p-5 no-underline transition-transform hover:-translate-y-0.5 hover:no-underline">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--accent-text)]">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-bold text-[var(--text)]">{title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{copy}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/wiki" className="btn btn-secondary no-underline hover:no-underline">
            <Book size={15} aria-hidden="true" />
            Explore the UK set wiki
          </Link>
          <Link to="/about" className="btn btn-ghost no-underline hover:no-underline">
            How pricing works
          </Link>
        </div>
      </section>
    </div>
  );
}
