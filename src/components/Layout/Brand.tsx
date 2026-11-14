import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

/**
 * The PokeGuru mark: two stacked trading cards with a four-point "guru" star.
 * Geometry mirrors `assets/logo-mark.svg` (the source used for every icon),
 * kept inline so it stays crisp and inherits the current colour scheme.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-8 w-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect width="512" height="512" rx="112" fill="#10141C" />
      <rect x="8" y="8" width="496" height="496" rx="106" fill="none" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="4" />
      <g transform="rotate(-12 256 268)">
        <rect x="150" y="126" width="196" height="272" rx="26" fill="#E5484D" />
        <rect x="150" y="126" width="196" height="272" rx="26" fill="none" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="3" />
        <path d="M170 336h156" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
        <path d="M170 360h108" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g transform="rotate(6 256 268)">
        <rect x="184" y="118" width="196" height="272" rx="26" fill="#F8F5EC" />
        <rect x="184" y="118" width="196" height="272" rx="26" fill="none" stroke="#0A0C11" strokeOpacity="0.22" strokeWidth="4" />
        <rect x="184" y="118" width="196" height="52" rx="26" fill="#E5484D" />
        <rect x="184" y="144" width="196" height="26" fill="#E5484D" />
        <path d="M282 198c6 30 18 42 48 48-30 6-42 18-48 48-6-30-18-42-48-48 30-6 42-18 48-48Z" fill="#F5A524" />
        <circle cx="282" cy="246" r="13" fill="#0A0C11" />
        <circle cx="282" cy="246" r="6" fill="#F5A524" />
        <circle cx="222" cy="332" r="9" fill="#0A0C11" fillOpacity="0.55" />
        <circle cx="252" cy="332" r="9" fill="#0A0C11" fillOpacity="0.28" />
        <circle cx="282" cy="332" r="9" fill="#0A0C11" fillOpacity="0.14" />
        <path d="M216 366h96" stroke="#0A0C11" strokeOpacity="0.2" strokeWidth="8" strokeLinecap="round" />
      </g>
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
