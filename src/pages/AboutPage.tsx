import { Book, Code, ExternalLink, Zap, Heart, Trophy, Globe } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

export default function AboutPage() {
  useTitle('About');

  return (
    <div className="mx-auto max-w-4xl pb-12 animate-fade-in">
      {/* Hero Header */}
      <div className="relative mb-12 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8 md:p-12 text-center">
        {/* Decorative elements */}
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[var(--accent)] opacity-5 blur-3xl" />
        <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-[var(--accent-2)] opacity-5 blur-3xl" />

        <div className="relative z-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <Book size={32} />
          </div>
          <h1 className="text-4xl font-extrabold md:text-5xl tracking-tight text-[var(--text)]">
            The Pokémon <span className="text-[var(--accent)]">Guru</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)] leading-relaxed">
            PokeGuru is a definitive, community-first Pokémon TCG database designed for speed,
            accuracy, and professional-grade portfolio tracking.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {['React 19', 'Vite 8', 'Tailwind 4', 'TypeScript', 'UK-Centric', 'Open Source'].map(tag => (
              <span key={tag} className="rounded-full bg-[var(--bg)] border border-[var(--border)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-[1fr_300px]">
        <div className="space-y-12">
          {/* Mission */}
          <section>
            <h2 className="mb-4 text-2xl font-black uppercase tracking-tight text-[var(--text)]">The Mission</h2>
            <p className="text-[var(--text)] text-lg leading-relaxed opacity-80">
              PokeGuru was built to solve a simple problem: <strong className="text-[var(--accent)]">finding Pokémon card data shouldn't be slow.</strong>
              We've stripped away the ads and the clutter to provide a high-performance interface for collectors to research prices,
              track their personal "Vault," and explore the rich history of the TCG.
            </p>
          </section>

          {/* Features */}
          <section>
            <h2 className="mb-6 text-2xl font-black uppercase tracking-tight text-[var(--text)]">Elite Features</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--accent)]/50">
                <Heart size={24} className="mb-4 text-red-500" />
                <h3 className="text-lg font-bold">The Vault</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">Save cards to your local browser storage and track your collection's total market value in GBP (£).</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--accent-2)]/50">
                <Trophy size={24} className="mb-4 text-yellow-500" />
                <h3 className="text-lg font-bold">PSA 10 Estimates</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">Exclusive access to average and maximum PSA 10 market values for over 120 historic sets.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--link)]/50">
                <Globe size={24} className="mb-4 text-blue-500" />
                <h3 className="text-lg font-bold">UK Card Wiki</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">A complete chronological database of English releases since 1999, tailored for the UK market.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 transition-colors hover:border-green-500/50">
                <Zap size={24} className="mb-4 text-green-500" />
                <h3 className="text-lg font-bold">Vite 7 Speed</h3>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">Sub-second load times and lightning-fast search using our optimized Lucene query builder.</p>
              </div>
            </div>
          </section>

          {/* Search Tags Documentation */}
          <section id="tags">
            <div className="mb-6 flex items-center gap-3">
              <div className="h-8 w-1.5 rounded-full bg-[var(--accent)]" />
              <h2 className="text-2xl font-black uppercase tracking-tight text-[var(--text)]">Search Tags</h2>
            </div>
            <p className="mb-6 text-[var(--muted)] text-lg">
              Master the engine. Combine these tags in the search bar to find rare cards instantly.
            </p>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-soft)]/50 text-[var(--muted)]">
                  <tr>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Tag</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Description</th>
                    <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Syntax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">types:</td>
                    <td className="px-6 py-4 font-medium">Filter by energy type</td>
                    <td className="px-6 py-4"><code>types:fire</code></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">subtypes:</td>
                    <td className="px-6 py-4 font-medium">Find Stage 2, VMAX, ex, etc.</td>
                    <td className="px-6 py-4"><code>subtypes:vmax</code></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">rarity:</td>
                    <td className="px-6 py-4 font-medium">Target specific pull rates</td>
                    <td className="px-6 py-4"><code>rarity:"Rare Holo"</code></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">hp:</td>
                    <td className="px-6 py-4 font-medium">Find cards with specific HP</td>
                    <td className="px-6 py-4"><code>hp:[300 TO *]</code></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-mono font-bold text-[var(--accent)]">set.id:</td>
                    <td className="px-6 py-4 font-medium">Search within one set</td>
                    <td className="px-6 py-4"><code>set.id:base1</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-soft)] p-8 shadow-xl">
            <h3 className="mb-6 text-xl font-black uppercase tracking-tighter">System Info</h3>
            <ul className="space-y-5 text-sm">
              <li className="flex items-center justify-between">
                <span className="font-bold text-[var(--muted)] uppercase tracking-tighter text-[10px]">Stable Version</span>
                <span className="font-mono font-black text-[var(--text)]">1.6.0</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-bold text-[var(--muted)] uppercase tracking-tighter text-[10px]">Build Health</span>
                <span className="flex items-center gap-1.5 font-bold text-[#10b981]">
                  <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
                  Optimal
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-bold text-[var(--muted)] uppercase tracking-tighter text-[10px]">Locale</span>
                <span className="font-bold text-[var(--text)]">en-GB</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-bold text-[var(--muted)] uppercase tracking-tighter text-[10px]">License</span>
                <span className="rounded bg-[var(--text)] px-1.5 py-0.5 text-[10px] font-black text-[var(--bg)]">MIT</span>
              </li>
            </ul>
            <div className="mt-8 pt-8 border-t border-[var(--border)]">
              <a
                href="https://github.com/DLinacre/PokeGuru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text)] py-3 text-sm font-black uppercase tracking-widest text-[var(--bg)] hover:opacity-90 transition-all active:scale-95 shadow-2xl"
              >
                <Code size={18} strokeWidth={3} />
                Open Source
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
            <h3 className="mb-4 text-xl font-black uppercase tracking-tighter text-[var(--accent)]">Roadmap</h3>
            <ul className="space-y-3 text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                AI Card Scanner (OCR)
              </li>
              <li className="flex items-center gap-2 opacity-50">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
                Price Alert System
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8">
            <h3 className="mb-4 text-xl font-black uppercase tracking-tighter">Credits</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6 font-medium">
              Data is live-synced from the Pokémon TCG API. Special thanks to the community for maintaining this data pool.
            </p>
            <a
              href="https://pokemontcg.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--link)] hover:text-[var(--text)] transition-colors"
            >
              pokemontcg.io
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
