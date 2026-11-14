import { useState } from "react";
import { cn } from "../../utils/cn";
import type { WrapperStyle } from "../../types/packs";

/**
 * PokeGuru-generated booster wrapper.
 *
 * TCGdex does not publish product-wrapper artwork, so the simulator does not
 * pretend to have it. Each wrapper is drawn from the expansion's own logo and
 * series palette and carries a permanent "PokeGuru illustration" label.
 */

const SERIES_PALETTE: Record<string, { from: string; via: string; to: string; ink: string }> = {
  base: { from: "#7c2d12", via: "#b45309", to: "#f59e0b", ink: "#1c1206" },
  gym: { from: "#3f1d5c", via: "#7e22ce", to: "#c084fc", ink: "#150a22" },
  neo: { from: "#0c3b52", via: "#0e7490", to: "#22d3ee", ink: "#04141b" },
  lc: { from: "#3f2d1a", via: "#8a6a3b", to: "#e2c88a", ink: "#1b1207" },
  ecard: { from: "#123b2f", via: "#15803d", to: "#86efac", ink: "#04140d" },
  ex: { from: "#1e2a63", via: "#4f46e5", to: "#a5b4fc", ink: "#080f2b" },
  dp: { from: "#2b1c4c", via: "#7c3aed", to: "#e9d5ff", ink: "#120726" },
  pl: { from: "#1f2937", via: "#4b5563", to: "#cbd5e1", ink: "#0a0f16" },
  hgss: { from: "#5b2b0f", via: "#d97706", to: "#fde68a", ink: "#241107" },
  col: { from: "#0f3d3e", via: "#0f766e", to: "#99f6e4", ink: "#041615" },
  bw: { from: "#1c1c22", via: "#3f3f46", to: "#d4d4d8", ink: "#08080a" },
  xy: { from: "#0c2a52", via: "#0369a1", to: "#7dd3fc", ink: "#04101f" },
  sm: { from: "#3b0764", via: "#a21caf", to: "#f5d0fe", ink: "#16031f" },
  swsh: { from: "#0b2e4f", via: "#1d4ed8", to: "#93c5fd", ink: "#040f1c" },
  sv: { from: "#5b0d18", via: "#e11d48", to: "#fecdd3", ink: "#2a0409" },
  me: { from: "#33124a", via: "#9333ea", to: "#fbcfe8", ink: "#150622" },
  default: { from: "#2a1520", via: "#be123c", to: "#fda4af", ink: "#1b0710" },
};

export function seriesPalette(seriesId: string | undefined) {
  return SERIES_PALETTE[seriesId ?? ""] ?? SERIES_PALETTE.default;
}

interface PackArtProps {
  setName: string;
  seriesId?: string;
  seriesName?: string;
  logo?: string;
  style?: WrapperStyle;
  className?: string;
  /** Larger typography for the detail hero. */
  size?: "tile" | "hero";
  year?: string;
  /** Shows the crimped "opened" state. */
  opened?: boolean;
  children?: React.ReactNode;
}

const STYLE_OVERLAYS: Record<WrapperStyle, string> = {
  crimson:
    "bg-[radial-gradient(120%_80%_at_15%_-10%,rgba(255,255,255,0.35),transparent_55%),linear-gradient(160deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55))]",
  prism:
    "bg-[conic-gradient(from_210deg_at_70%_20%,rgba(124,196,255,0.55),rgba(244,114,182,0.45),rgba(245,165,36,0.5),rgba(124,196,255,0.5))] mix-blend-screen opacity-70",
  vintage:
    "bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_2px,transparent_2px,transparent_9px)]",
};

export default function PackArt({
  setName,
  seriesId,
  seriesName,
  logo,
  style = "crimson",
  className,
  size = "tile",
  year,
  opened = false,
  children,
}: PackArtProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const palette = seriesPalette(seriesId);
  const showLogo = Boolean(logo) && !logoFailed;

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[3/5] w-full flex-col overflow-hidden rounded-[16px] border border-white/15 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(155deg, ${palette.from} 0%, ${palette.via} 52%, ${palette.to} 100%)`,
      }}
    >
      {/* foil sheen */}
      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", STYLE_OVERLAYS[style])} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/2 rotate-[18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent blur-md"
      />

      {/* crimped edges */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-2.5 opacity-80"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.55) 0 3px, rgba(255,255,255,0.4) 3px 6px)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2.5 opacity-80"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.55) 0 3px, rgba(255,255,255,0.4) 3px 6px)",
        }}
      />

      <div className={cn("relative z-10 flex h-full flex-col items-center justify-between px-3 pb-4 pt-6 text-center", size === "hero" && "px-5 pb-6 pt-8")}>
        <div className="flex flex-col items-center gap-1">
          <span
            className="rounded-full bg-black/45 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white/85 backdrop-blur"
            title={seriesName ? `Series: ${seriesName}` : undefined}
          >
            {seriesName ?? "Pokémon TCG"}
          </span>
          {year && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{year}</span>}
        </div>

        <div className={cn("flex w-full flex-1 items-center justify-center", size === "hero" ? "py-6" : "py-4")}>
          {showLogo ? (
            <img
              src={logo}
              alt={`${setName} set logo`}
              loading="lazy"
              onError={() => setLogoFailed(true)}
              className={cn("max-h-[46%] w-auto max-w-[92%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]", size === "hero" && "max-h-[52%]")}
            />
          ) : (
            <span
              className={cn(
                "font-[family-name:var(--font-display)] text-lg font-bold leading-tight text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]",
                size === "hero" && "text-3xl"
              )}
            >
              {setName}
            </span>
          )}
        </div>

        <div className="w-full space-y-1.5">
          <p className={cn("font-[family-name:var(--font-display)] text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-white/95", size === "hero" && "text-base")}>
            {setName}
          </p>
          <p className="text-[7px] font-black uppercase tracking-[0.22em] text-white/60">
            PokeGuru simulation · not official artwork
          </p>
        </div>
      </div>

      {opened && (
        <div aria-hidden="true" className="absolute inset-x-0 top-2.5 h-6 bg-gradient-to-b from-black/60 to-transparent" />
      )}
      {children}
    </div>
  );
}
