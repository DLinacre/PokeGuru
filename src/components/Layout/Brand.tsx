import { useId } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

/**
 * The PokeGuru mark: an ivory "chase" card with a crimson header and a gold
 * guru star, fanned over a deep-blue card. Geometry mirrors
 * `assets/logo-mark.svg` (the vector source every icon is rasterised from) so
 * the header, favicon and social card can never drift apart.
 *
 * Gradient ids are namespaced with `useId` because the mark can appear more
 * than once on a page (header, footer, loading state) and duplicate SVG ids
 * would make the later instances reference the wrong paint server.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `pg-${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-8 w-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={id("tile")} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#1D2431" />
          <stop offset="0.55" stopColor="#12161F" />
          <stop offset="1" stopColor="#07080C" />
        </linearGradient>
        <radialGradient id={id("glowA")} cx="0.82" cy="0.1" r="0.72">
          <stop offset="0" stopColor="#F04452" stopOpacity="0.5" />
          <stop offset="1" stopColor="#F04452" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("glowB")} cx="0.1" cy="0.96" r="0.68">
          <stop offset="0" stopColor="#F5A524" stopOpacity="0.3" />
          <stop offset="1" stopColor="#F5A524" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("blue")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F7BFF" />
          <stop offset="0.55" stopColor="#2A3F8F" />
          <stop offset="1" stopColor="#131A33" />
        </linearGradient>
        <linearGradient id={id("crimson")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF7A7E" />
          <stop offset="0.5" stopColor="#E5484D" />
          <stop offset="1" stopColor="#B31E2B" />
        </linearGradient>
        <linearGradient id={id("ivory")} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFFDF7" />
          <stop offset="0.6" stopColor="#F5F0E4" />
          <stop offset="1" stopColor="#DED5C4" />
        </linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE7A8" />
          <stop offset="0.5" stopColor="#F5A524" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id={id("holo")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8ED0FF" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="0.78" stopColor="#E9B8FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFD166" stopOpacity="0.25" />
        </linearGradient>
        <clipPath id={id("front")}>
          <rect x="188" y="104" width="212" height="294" rx="28" />
        </clipPath>
      </defs>

      <rect width="512" height="512" rx="112" fill={`url(#${id("tile")})`} />
      <rect width="512" height="512" rx="112" fill={`url(#${id("glowA")})`} />
      <rect width="512" height="512" rx="112" fill={`url(#${id("glowB")})`} />
      <rect x="7" y="7" width="498" height="498" rx="106" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="4" />

      <ellipse cx="268" cy="432" rx="146" ry="30" fill="#000000" fillOpacity="0.45" />

      <g transform="rotate(-16 214 256)">
        <rect x="104" y="132" width="188" height="266" rx="26" fill={`url(#${id("blue")})`} />
        <rect x="104" y="132" width="188" height="266" rx="26" fill="none" stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="3" />
        <rect x="128" y="160" width="140" height="92" rx="14" fill="#06080F" fillOpacity="0.42" />
        <path d="M128 300h140" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="7" strokeLinecap="round" />
        <path d="M128 324h96" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="7" strokeLinecap="round" />
      </g>

      <g transform="rotate(7 268 256)">
        <rect x="188" y="104" width="212" height="294" rx="28" fill={`url(#${id("ivory")})`} />
        <g clipPath={`url(#${id("front")})`}>
          <rect x="150" y="60" width="78" height="384" fill={`url(#${id("holo")})`} fillOpacity="0.3" transform="rotate(24 294 256)" />
          <rect x="300" y="60" width="26" height="384" fill={`url(#${id("holo")})`} fillOpacity="0.18" transform="rotate(24 294 256)" />
          <rect x="188" y="104" width="212" height="62" fill={`url(#${id("crimson")})`} />
          <rect x="188" y="104" width="212" height="62" fill={`url(#${id("holo")})`} fillOpacity="0.2" />
          <circle cx="210" cy="135" r="7.5" fill="#FFFDF7" fillOpacity="0.92" />
          <circle cx="235" cy="135" r="5" fill="#FFFDF7" fillOpacity="0.45" />
        </g>

        <path
          d="M294 190c7.4 36 21 49.6 57 57-36 7.4-49.6 21-57 57-7.4-36-21-49.6-57-57 36-7.4 49.6-21 57-57Z"
          fill={`url(#${id("gold")})`}
        />
        <circle cx="294" cy="247" r="15" fill="#0B0D12" />
        <circle cx="294" cy="247" r="6.5" fill={`url(#${id("gold")})`} />

        <circle cx="232" cy="330" r="9.5" fill="#0B0D12" fillOpacity="0.62" />
        <circle cx="263" cy="330" r="9.5" fill="#0B0D12" fillOpacity="0.3" />
        <circle cx="294" cy="330" r="9.5" fill="#0B0D12" fillOpacity="0.15" />
        <path d="M226 364h110" stroke="#0B0D12" strokeOpacity="0.2" strokeWidth="10" strokeLinecap="round" />
        <rect x="188" y="104" width="212" height="294" rx="28" fill="none" stroke="#0B0D12" strokeOpacity="0.16" strokeWidth="4" />
      </g>

      <path d="M116 118c3 15.6 9.4 22 25 25-15.6 3-22 9.4-25 25-3-15.6-9.4-22-25-25 15.6-3 22-9.4 25-25Z" fill="#FFD166" />
      <path d="M414 356c2.6 13 7.4 17.8 20 20-12.6 2.6-17.4 7.4-20 20-2.6-12.6-7.4-17.4-20-20 12.6-2.2 17.4-7 20-20Z" fill="#8ED0FF" fillOpacity="0.92" />
      <circle cx="404" cy="120" r="5" fill="#FFFFFF" fillOpacity="0.68" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-display)] text-[1.15rem] font-bold leading-none tracking-[-0.02em] text-[var(--text)]",
        className
      )}
    >
      Poke<span className="text-[var(--accent-text)]">Guru</span>
    </span>
  );
}

export default function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="PokeGuru home"
      className={cn(
        "group flex shrink-0 items-center gap-2.5 rounded-xl no-underline transition-opacity hover:opacity-90 hover:no-underline",
        className
      )}
    >
      <BrandMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <BrandWordmark className={compact ? "text-base" : undefined} />
    </Link>
  );
}
