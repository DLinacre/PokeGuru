import { ExternalLink, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { BuyMeAPackPanel } from "../UI/BuyMeAPack";

const LINKS = [
  { to: "/search", label: "Card search" },
  { to: "/sets", label: "All sets" },
  { to: "/wiki", label: "UK set wiki" },
  { to: "/collection", label: "Collection vault" },
  { to: "/scanner", label: "Card scanner" },
  { to: "/about", label: "About & sources" },
];

const SOURCES = [
  { href: "https://tcgdex.dev", label: "TCGdex card database" },
  { href: "https://www.cardmarket.com", label: "Cardmarket pricing" },
  { href: "https://www.tcgplayer.com", label: "TCGplayer pricing" },
  { href: "https://frankfurter.dev", label: "Frankfurter exchange rates" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-soft)] px-4 pb-24 pt-10 sm:pb-8 md:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-[var(--text)] no-underline hover:no-underline">
            <span
              aria-hidden="true"
              className="relative h-5 w-5 rounded-full border-[2.5px] border-[#111] bg-gradient-to-b from-[#ef4444] from-50% to-white to-50%"
            >
              <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full border-[2px] border-[#111] bg-white" />
            </span>
            Poke<strong className="text-[var(--accent)]">Guru</strong>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
            A fast, open Pokémon TCG card database with GBP reference pricing, set history and a private,
            local-only collection vault.
          </p>
          <a
            href="https://github.com/DLinacre/PokeGuru"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            aria-label="PokeGuru on GitHub (opens in a new tab)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            Source on GitHub
          </a>
        </div>

        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--text)]">
            Explore
          </h2>
          <ul className="space-y-2 text-sm">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-[var(--muted)] no-underline transition-colors hover:text-[var(--text)] hover:no-underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-[var(--text)]">Data sources</h2>
          <ul className="space-y-2 text-sm">
            {SOURCES.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                >
                  {source.label}
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Link
            to="/about"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline"
          >
            <Info size={12} aria-hidden="true" />
            How prices work
          </Link>
        </div>

        <BuyMeAPackPanel />
      </div>

      <div className="mx-auto mt-8 max-w-[1180px] space-y-2 border-t border-[var(--border)] pt-5 text-center text-xs text-[var(--muted)]">
        <p>
          Pokémon and all related names are trademarks of Nintendo, Game Freak &amp; The Pokémon Company. This is an
          unofficial, non-commercial fan project and is not affiliated with or endorsed by them.
        </p>
        <p>
          Prices are marketplace reference values (Cardmarket EUR converted to GBP with a dated daily rate), not
          completed sales or financial advice. Released under the{" "}
          <a
            href="https://opensource.org/licenses/MIT"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--link)]"
          >
            MIT License
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
