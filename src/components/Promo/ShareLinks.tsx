import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import { canonicalOrigin } from "../../services/seo";

/**
 * Share targets for the live application.
 *
 * These are plain, real intent URLs — no trackers, no third-party scripts and
 * no invented "follow us" accounts. `canonicalOrigin()` always resolves to the
 * official Vercel deployment, so a share always promotes the canonical app even
 * when it is triggered from the GitHub Pages mirror.
 */

interface ShareLinksProps {
  /** Route to share (canonical origin is prepended). */
  path?: string;
  /** Text used by X/Reddit/WhatsApp/email. */
  text?: string;
  className?: string;
  compact?: boolean;
}

const DEFAULT_TEXT =
  "PokeGuru — an open Pokémon TCG card database with GBP reference prices, every set, a private collection vault and free virtual pack openings.";

function ShareIcon({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
    >
      {children}
    </a>
  );
}

export default function ShareLinks({ path = "/", text = DEFAULT_TEXT, className, compact = false }: ShareLinksProps) {
  const [copied, setCopied] = useState(false);
  const url = `${canonicalOrigin()}${path === "/" ? "/" : path}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  const targets = [
    {
      label: "Share PokeGuru on X (opens in a new tab)",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: <span aria-hidden="true" className="text-[13px] font-black">𝕏</span>,
    },
    {
      label: "Share PokeGuru on Facebook (opens in a new tab)",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <span aria-hidden="true" className="text-[13px] font-black">f</span>,
    },
    {
      label: "Share PokeGuru on Reddit (opens in a new tab)",
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`,
      icon: <span aria-hidden="true" className="text-[12px] font-black">r/</span>,
    },
    {
      label: "Share PokeGuru on LinkedIn (opens in a new tab)",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <span aria-hidden="true" className="text-[12px] font-black">in</span>,
    },
    {
      label: "Share PokeGuru on WhatsApp (opens in a new tab)",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      icon: <MessageCircle size={15} aria-hidden="true" />,
    },
    {
      label: "Share PokeGuru by email",
      href: `mailto:?subject=${encodeURIComponent("PokeGuru — Pokémon TCG card database")}&body=${encodedText}%20${encodedUrl}`,
      icon: <Mail size={15} aria-hidden="true" />,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {!compact && <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-[var(--muted)]">Share</span>}
      {targets.map((target) => (
        <ShareIcon key={target.label} label={target.label} href={target.href}>
          {target.icon}
        </ShareIcon>
      ))}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
