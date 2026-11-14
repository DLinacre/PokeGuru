import { useState } from "react";
import { ExternalLink, Package, Sparkles, X } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * "Buy Me a Pack" — support PokeGuru by buying the developer a pack of
 * Pokémon cards.
 *
 * The destination is configured with VITE_BUY_ME_A_PACK_URL. If no URL has
 * been supplied, the button explains that support is not set up yet rather
 * than linking to an invented or inactive payment page.
 */

function supportUrl(): string | null {
  const configured = import.meta.env.VITE_BUY_ME_A_PACK_URL;
  if (typeof configured !== "string") return null;
  const trimmed = configured.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isBuyMeAPackConfigured(): boolean {
  return supportUrl() !== null;
}

const SUPPORT_LEAD = "Enjoying PokeGuru? Help support development and buy me a pack of Pokémon cards!";

interface BuyMeAPackProps {
  variant?: "compact" | "full" | "icon";
  className?: string;
}

export default function BuyMeAPack({ variant = "compact", className }: BuyMeAPackProps) {
  const url = supportUrl();
  const [showNote, setShowNote] = useState(false);

  const baseClasses = cn(
    "group inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 font-extrabold text-[var(--accent-2)] transition-all hover:border-[var(--accent-2)] hover:bg-[var(--accent-2)]/20 hover:text-[var(--accent-2)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]",
    variant === "compact" && "px-3 py-1.5 text-[10px] uppercase tracking-widest",
    variant === "full" && "px-5 py-3 text-sm",
    variant === "icon" && "h-9 w-9",
    className
  );

  if (!url) {
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          className={cn(baseClasses, "cursor-help")}
          onClick={() => setShowNote((value) => !value)}
          aria-expanded={showNote}
          aria-label="Buy me a pack — support link not configured yet"
        >
          <Package size={variant === "icon" ? 16 : 14} aria-hidden="true" />
          {variant !== "icon" && <span>Buy me a pack</span>}
        </button>
        {showNote && (
          <span
            role="status"
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 text-left text-xs font-medium normal-case tracking-normal text-[var(--muted)] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowNote(false)}
              className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--muted)] hover:text-[var(--text)]"
              aria-label="Dismiss support notice"
            >
              <X size={12} />
            </button>
            <strong className="mb-1 block text-[var(--text)]">Support isn&apos;t live yet</strong>
            {SUPPORT_LEAD} This deployment has no support link configured, so there is nothing to open. Set{" "}
            <code className="rounded bg-[var(--bg)] px-1 py-0.5">VITE_BUY_ME_A_PACK_URL</code> to enable it.
          </span>
        )}
      </span>
    );
  }

  return (
    <a
      href={url}
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

/** Footer/About support panel with the same configuration rules. */
export function BuyMeAPackPanel({ className }: { className?: string }) {
  const configured = isBuyMeAPackConfigured();

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
      {!configured && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          Support links aren&apos;t live on this deployment yet. If you host PokeGuru yourself, set{" "}
          <code className="rounded bg-[var(--bg)] px-1 py-0.5">VITE_BUY_ME_A_PACK_URL</code> to enable this button.
        </p>
      )}
    </section>
  );
}
