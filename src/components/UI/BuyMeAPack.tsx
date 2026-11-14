import { ExternalLink, Package, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * "Buy Me a Pack" — support PokeGuru by buying the developer a pack of
 * Pokémon cards.
 *
 * The destination is fixed at https://paypal.me/dlinacre16 so the button works
 * on every deployment (production, previews, GitHub Pages) with no build-time
 * configuration. Every instance renders the same link, opens in a new tab and
 * carries `rel="noopener noreferrer"`.
 */

export const BUY_ME_A_PACK_URL = "https://paypal.me/dlinacre16";

const SUPPORT_LEAD = "Enjoying PokeGuru? Help support development and buy me a pack of Pokémon cards!";

interface BuyMeAPackProps {
  variant?: "compact" | "full" | "icon";
  className?: string;
}

export function isBuyMeAPackConfigured(): boolean {
  // Always configured: the support link is a constant, not a build setting.
  return true;
}

export default function BuyMeAPack({ variant = "compact", className }: BuyMeAPackProps) {
  const baseClasses = cn(
    "group inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 font-extrabold text-[var(--accent-2)] transition-all hover:border-[var(--accent-2)] hover:bg-[var(--accent-2)]/20 hover:text-[var(--accent-2)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]",
    variant === "compact" && "px-3 py-1.5 text-[10px] uppercase tracking-widest",
    variant === "full" && "px-5 py-3 text-sm",
    variant === "icon" && "h-9 w-9",
    className
  );

  return (
    <a
      href={BUY_ME_A_PACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(baseClasses, "no-underline hover:no-underline")}
      title={SUPPORT_LEAD}
      aria-label="Buy me a pack (opens in a new tab)"
    >
      <Package size={variant === "icon" ? 16 : 14} className="transition-transform group-hover:-rotate-6" aria-hidden="true" />
      {variant !== "icon" && <span>Buy me a pack</span>}
      {variant !== "icon" && <ExternalLink size={12} className="opacity-60" aria-hidden="true" />}
    </a>
  );
}

/** Footer/About support panel. */
export function BuyMeAPackPanel({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-soft)] p-5",
        className
      )}
      aria-labelledby="support-heading"
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--accent-2)]" aria-hidden="true" />
        <h2 id="support-heading" className="text-sm font-black uppercase tracking-widest text-[var(--text)]">
          Buy me a pack
        </h2>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">{SUPPORT_LEAD}</p>
      <BuyMeAPack variant="full" />
    </section>
  );
}
