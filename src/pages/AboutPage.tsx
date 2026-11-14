import {
  Book,
  Camera,
  Database,
  ExternalLink,
  Heart,
  Info,
  Layers,
  LineChart,
  Lock,
  PackageOpen,
  Smartphone,
  Zap,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { BuyMeAPackPanel } from "../components/UI/BuyMeAPack";

const FEATURES = [
  {
    icon: Heart,
    title: "Private vault",
    copy: "Save cards to your collection. It lives in this browser's storage only — no account, no server, no tracking.",
    accent: "text-red-400",
  },
  {
    icon: LineChart,
    title: "Dated GBP references",
    copy: "Cardmarket EUR prices converted with the Frankfurter daily rate. Every figure shows its source and update date.",
    accent: "text-[#10b981]",
  },
  {
    icon: Camera,
    title: "On-device scanning",
    copy: "OCR runs in your browser with Tesseract.js. It suggests matches and you confirm the card — nothing is uploaded.",
    accent: "text-[var(--accent-2)]",
  },
  {
    icon: Zap,
    title: "Fast by design",
    copy: "Route-level code splitting, cached API responses and right-sized images keep the app quick on mobile data.",
    accent: "text-[var(--link)]",
  },
  {
    icon: PackageOpen,
    title: "Pack simulator",
    copy: "Open unlimited virtual booster packs from every era. Pulls are generated from the real card pool and kept apart from your vault.",
    accent: "text-[var(--accent-2)]",
  },
  {
    icon: Layers,
    title: "Every set",
    copy: "Browse the full TCGdex set index, with release dates from a hand-curated UK set list.",
    accent: "text-purple-400",
  },
  {
    icon: Smartphone,
    title: "Installable PWA",
    copy: "Add PokeGuru to your home screen for an app-like experience with an offline shell and cached data.",
    accent: "text-[var(--accent-text)]",
  },
];

export default function AboutPage() {
  usePageMeta({
    title: "About & data sources",
    description:
      "How PokeGuru works: TCGdex card data, Cardmarket reference pricing converted with Frankfurter rates, on-device scanning, and a local-only collection vault.",
    path: "/about",
  });

  return (
    <div className="mx-auto max-w-4xl pb-12 animate-fade-in">
      <header className="relative mb-10 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center md:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[var(--accent)] opacity-5 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[var(--accent-2)] opacity-5 blur-3xl" />
        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent-text)]">
            <Book size={30} aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            The Pokémon <span className="text-[var(--accent-text)]">Guru</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
            PokeGuru is an open, privacy-first Pokémon TCG database for UK collectors: fast search, every set, dated
            GBP reference prices and a collection that never leaves your browser.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["React 19", "Vite", "Tailwind 4", "TypeScript", "TCGdex", "Frankfurter", "Open source"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-10 md:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          <section aria-labelledby="features">
            <h2 id="features" className="mb-4 text-2xl font-black uppercase tracking-tight">
              What&apos;s inside
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, copy, accent }) => (
                <div key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                  <Icon size={22} className={`mb-3 ${accent}`} aria-hidden="true" />
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="pricing">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              <h2 id="pricing" className="text-2xl font-black uppercase tracking-tight">
                How prices work
              </h2>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
              <p>
                Card data and marketplace references come from{" "}
                <a href="https://tcgdex.dev" target="_blank" rel="noopener noreferrer" className="text-[var(--link)]">
                  TCGdex
                </a>
                , a free community API. Prices are <strong className="text-[var(--text)]">Cardmarket reference
                values</strong> — the same numbers Cardmarket publishes to the API, never re-derived.
              </p>
              <p>
                <strong className="text-[var(--text)]">Printing matters.</strong> Cardmarket publishes a standard
                band and a holofoil band. PokeGuru first works out which printing a card has, then reads only that
                band, so a non-holo card is never valued using holofoil prices. When both printings exist, the second
                value is shown separately and labelled as an alternate printing.
              </p>
              <p>
                The headline figure uses Cardmarket&apos;s trend price, then average asking price, then the 30-day
                average, then the lowest listing — always one published band, never an average of unrelated numbers.
                Each figure carries a confidence label (<strong className="text-[var(--text)]">Verified</strong>,
                Indicative, Stale, Price Unverified or No Data Available) and a tooltip explaining exactly why.
              </p>
              <p>
                Euro prices are converted to GBP using{" "}
                <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer" className="text-[var(--link)]">
                  Frankfurter
                </a>
                , a free ECB-backed reference-rate API. The conversion rate and its date are always shown next to the
                price. There is no hard-coded exchange rate.
              </p>
              <p>
                Where Cardmarket publishes nothing, PokeGuru shows <strong className="text-[var(--text)]">No Data
                Available</strong>. It does not estimate, interpolate or invent values. TCGplayer figures are shown in
                USD and are never silently converted.
              </p>
              <div className="rounded-xl border border-[var(--accent-2)]/30 bg-[var(--accent-2)]/10 p-4 text-[var(--accent-2)]">
                <p className="flex items-start gap-2 font-semibold">
                  <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  These are marketplace reference prices, not completed sales, live quotes, graded valuations or
                  financial advice. Cardmarket updates its data roughly daily and TCGplayer more often; the exact update
                  timestamp is shown on each card.
                </p>
              </div>
              <p>
                Earlier versions of PokeGuru displayed &ldquo;PSA 10 estimates&rdquo; for sets. Those figures had no
                verifiable source and have been removed rather than presented as market data.
              </p>
            </div>
          </section>

          <section aria-labelledby="privacy">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-[#10b981]" aria-hidden="true" />
              <h2 id="privacy" className="text-2xl font-black uppercase tracking-tight">
                Privacy & storage
              </h2>
            </div>
            <ul className="space-y-2 text-sm leading-relaxed text-[var(--muted)]">
              <li className="flex items-start gap-2">
                <Lock size={15} className="mt-0.5 shrink-0 text-[#10b981]" aria-hidden="true" />
                Your collection, cached API responses and the OCR language model stay in your browser.
              </li>
              <li className="flex items-start gap-2">
                <Database size={15} className="mt-0.5 shrink-0 text-[#10b981]" aria-hidden="true" />
                Clearing site data removes your vault permanently — use &ldquo;Export JSON&rdquo; on the vault page to
                keep a backup.
              </li>
              <li className="flex items-start gap-2">
                <Camera size={15} className="mt-0.5 shrink-0 text-[#10b981]" aria-hidden="true" />
                Scanner images are processed on-device and never uploaded.
              </li>
            </ul>
          </section>

          <section aria-labelledby="sources">
            <h2 id="sources" className="mb-4 text-2xl font-black uppercase tracking-tight">
              Sources & credits
            </h2>
            <ul className="space-y-2 text-sm">
              {[
                { href: "https://tcgdex.dev", label: "TCGdex — card, set and pricing data" },
                { href: "https://www.cardmarket.com", label: "Cardmarket — European marketplace prices" },
                { href: "https://www.tcgplayer.com", label: "TCGplayer — North American marketplace prices" },
                { href: "https://frankfurter.dev", label: "Frankfurter — ECB exchange-rate references" },
                { href: "https://github.com/DLinacre/PokeGuru", label: "PokeGuru source code on GitHub" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[var(--link)]"
                  >
                    {link.label}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="simulator">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-[var(--accent-2)]" aria-hidden="true" />
              <h2 id="simulator" className="text-2xl font-black uppercase tracking-tight">
                Pack Opening Simulator
              </h2>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
              <p>
                The simulator opens virtual Pokémon TCG booster packs. It is free and unlimited, with no currency, no
                ads, no account and no purchase — and the pulls are entertainment only.
              </p>
              <p>
                <strong className="text-[var(--text)]">Pack contents are real.</strong> Cards are drawn from the chosen
                expansion&apos;s actual card list and rarity data in TCGdex, including Trainer Gallery, Shiny Vault and
                Galarian Gallery subsets, which are physically found inside the same packs. TCGdex does not publish
                booster-specific card associations, so the simulator never claims that a pack reproduces a specific
                product variant. Cards whose rarity the database does not report are excluded rather than guessed, and the
                pack panel shows how many were left out.
              </p>
              <p>
                <strong className="text-[var(--text)]">Structures differ by era.</strong> Wizards-era boosters, nine-card
                EX packs and modern ten-card packs do not share a format, so each era has its own rule. A rule is marked{" "}
                <em>documented</em> when the pack structure comes from product guidance — Scarlet &amp; Violet&apos;s
                ten-card structure is — and <em>estimated</em> when the pack size is documented but the slot split and
                tier weights are PokeGuru&apos;s model.
              </p>
              <p>
                <strong className="text-[var(--text)]">Odds are honest.</strong> Pokémon does not publish per-rarity pull
                odds for individual expansions. Where a measured community study exists we use it and say so: Scarlet &amp;
                Violet tier shares come from TCGplayer&apos;s Authentication Center openings (8,000+ packs, published March
                2023), shown with the source, sample size and the date we checked it. Everywhere else the percentages are
                PokeGuru estimates derived from the pack layout and the set&apos;s own rarity mix, and they are labelled as
                estimates. There is no pity timer, no hidden boost and no rigged &ldquo;exciting&rdquo; pull; random
                outcomes use the browser&apos;s cryptographic generator, and a reported seed reproduces the same pack.
              </p>
              <p>
                <strong className="text-[var(--text)]">Kept separate.</strong> Simulated pulls live under their own
                storage key, are never added to your collection, never priced, and are excluded from every valuation. The
                reset button clears only simulated data.
              </p>
              <p>
                <strong className="text-[var(--text)]">Artwork.</strong> TCGdex does not publish product-wrapper images,
                so every wrapper is a PokeGuru illustration built from the expansion&apos;s logo and series colours. It is
                labelled as such and is never presented as an official product image.
              </p>
              <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-xs leading-relaxed">
                PokeGuru is an unofficial fan-made Pokémon TCG companion. Pack openings are virtual simulations for
                entertainment only. No physical cards or products are supplied, and simulated pulls have no real-world
                ownership or monetary value. Pull rates are estimates unless explicitly identified otherwise. PokeGuru is
                not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures Inc. or GAME FREAK.
              </p>
            </div>
          </section>

          <BuyMeAPackPanel />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-tight">Install app</h2>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              PokeGuru is a progressive web app. On Android/Chrome use the browser menu → &ldquo;Install app&rdquo;; on
              desktop Chrome/Edge use the install icon in the address bar; on iOS use Share → &ldquo;Add to Home
              Screen&rdquo;.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-tight">Limitations</h2>
            <ul className="space-y-2 text-xs leading-relaxed text-[var(--muted)]">
              <li>· Price sorting ranks the current page only (the search API returns no prices).</li>
              <li>· Release dates for some newer sets are not in the UK index and are shown as unavailable.</li>
              <li>· OCR works best on sharp, well-lit photos and can misread card names.</li>
              <li>· Cards are added once each; the vault has no quantity support yet.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-tight">Roadmap</h2>
            <ul className="space-y-2 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" aria-hidden="true" />
                On-device OCR scanner
              </li>
              <li className="flex items-center gap-2 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" aria-hidden="true" />
                Card quantities &amp; conditions
              </li>
              <li className="flex items-center gap-2 opacity-60">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" aria-hidden="true" />
                Price alerts (needs an account)
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
