import { cn } from "../../utils/cn";

/**
 * Small piece of brand artwork for empty states and quiet moments.
 *
 * Pure SVG in the app's palette — no bitmap, no extra request, and it inherits
 * the dark theme so it never looks pasted on. Used where a page has nothing to
 * show yet (empty vault, no search results), so the empty state still feels
 * like PokeGuru rather than a generic dashed box.
 */
export default function BrandArtwork({
  className,
  label,
}: {
  className?: string;
  /** Accessible label; omit to render the artwork as decorative. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 150"
      className={cn("h-auto w-[190px] max-w-full", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {label ? <title>{label}</title> : null}

      {/* Halo */}
      <ellipse cx="112" cy="126" rx="82" ry="14" fill="#000000" fillOpacity="0.35" />
      <ellipse cx="112" cy="70" rx="88" ry="58" fill="url(#artGlow)" />

      {/* Fanned card backs */}
      <g transform="rotate(-18 78 78)">
        <rect x="44" y="30" width="62" height="88" rx="10" fill="#243357" stroke="#8ED0FF" strokeOpacity="0.35" />
        <path d="M56 92h38" stroke="#8ED0FF" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform="rotate(16 142 78)">
        <rect x="118" y="30" width="62" height="88" rx="10" fill="#3A2030" stroke="#FF7A7E" strokeOpacity="0.35" />
        <path d="M130 92h38" stroke="#FF7A7E" strokeOpacity="0.3" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Centre card: face down, "PG" back */}
      <g transform="rotate(-2 112 76)">
        <rect x="76" y="18" width="72" height="104" rx="12" fill="url(#artCard)" stroke="#FFFFFF" strokeOpacity="0.12" />
        <rect x="84" y="26" width="56" height="88" rx="8" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" />
        <path
          d="M112 60c2.6 12.4 7.4 17.2 20 20-12.6 2.8-17.4 7.6-20 20-2.6-12.4-7.4-17.2-20-20 12.6-2.8 17.4-7.6 20-20Z"
          fill="url(#artGold)"
        />
      </g>

      {/* Sparkles */}
      <path d="M40 74c1.8 8.6 5.2 12 14 14-8.8 2-12.2 5.4-14 14-1.8-8.6-5.2-12-14-14 8.8-2 12.2-5.4 14-14Z" fill="#FFD166" fillOpacity="0.75" />
      <circle cx="182" cy="52" r="3" fill="#FFFFFF" fillOpacity="0.5" />
      <circle cx="196" cy="96" r="2" fill="#FFFFFF" fillOpacity="0.35" />

      <defs>
        <radialGradient id="artGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F04452" stopOpacity="0.22" />
          <stop offset="1" stopColor="#F04452" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="artCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C2434" />
          <stop offset="1" stopColor="#0A0C12" />
        </linearGradient>
        <linearGradient id="artGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE7A8" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
      </defs>
    </svg>
  );
}
