import { useMemo, type CSSProperties } from "react";
import { cn } from "../../utils/cn";

/**
 * Decorative effects for the pack-opening "theatre".
 *
 * Everything here is CSS-only (no canvas, no external assets) so it keeps
 * working under the app's strict CSP, in print, and with the app's own
 * reduced-motion switch — callers simply do not render these when motion is
 * off. Every element is `aria-hidden`; the real information always lives in
 * text elsewhere in the stage.
 */

/** Tiny deterministic PRNG so a given pull always looks the same. */
function makeRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return ((hash >>> 0) % 10_000) / 10_000;
  };
}

const CONFETTI_COLOURS = ["#f2c14e", "#ff8a92", "#7cc4ff", "#a78bfa", "#ffffff", "#f0abfc"];

interface ConfettiProps {
  /** Changing this replays the burst (use the pull id or reveal counter). */
  seed: string;
  count?: number;
  className?: string;
  intense?: boolean;
}

/** Falling confetti for chase pulls and the final reveal. */
export function Confetti({ seed, count = 26, className, intense = false }: ConfettiProps) {
  const pieces = useMemo(() => {
    const random = makeRandom(seed);
    return Array.from({ length: count }, (_, index) => {
      const width = 4 + Math.round(random() * 4);
      return {
        id: index,
        left: 4 + random() * 92,
        drift: Math.round((random() - 0.5) * 190),
        rotation: Math.round(180 + random() * 540),
        delay: Math.round(random() * 320),
        duration: 900 + Math.round(random() * 700),
        width,
        height: width * (1.4 + random() * 1.1),
        colour: CONFETTI_COLOURS[Math.floor(random() * CONFETTI_COLOURS.length)],
        round: random() > 0.65,
      };
    });
  }, [seed, count]);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 block opacity-0"
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.width}px`,
              height: `${piece.height}px`,
              backgroundColor: piece.colour,
              borderRadius: piece.round ? "9999px" : "1px",
              animation: `confetti-fall ${piece.duration}ms ease-in ${piece.delay}ms both`,
              "--dx": `${piece.drift}px`,
              "--rot": `${piece.rotation}deg`,
              boxShadow: intense ? `0 0 8px ${piece.colour}` : undefined,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Warm flare behind a chase pull. */
export function RareFlare({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-rare-flare pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full",
        "bg-[radial-gradient(circle,rgba(255,214,102,0.85)_0%,rgba(245,165,36,0.45)_38%,rgba(245,165,36,0)_70%)]",
        className
      )}
    />
  );
}

/** The dark room: spotlight cone, floor pool, drifting dust. */
export function StageBackdrop({ motion, seed = "stage" }: { motion: boolean; seed?: string }) {
  const dust = useMemo(() => {
    const random = makeRandom(seed);
    return Array.from({ length: 14 }, (_, index) => ({
      id: index,
      left: 6 + random() * 88,
      top: 10 + random() * 70,
      size: 1.5 + random() * 2.5,
      delay: Math.round(random() * 2600),
      duration: 2600 + Math.round(random() * 2200),
      opacity: 0.25 + random() * 0.4,
    }));
  }, [seed]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Spotlight cone from the top of the stage. */}
      <div
        className={cn(
          "absolute left-1/2 top-0 h-[130%] w-[80%] -translate-x-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_45%,transparent_75%)]",
          motion && "animate-spotlight"
        )}
        style={{ clipPath: "polygon(42% 0%, 58% 0%, 92% 100%, 8% 100%)" }}
      />
      {/* Warm floor pool behind the card. */}
      <div className="absolute bottom-0 left-1/2 h-28 w-[70%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(240,68,82,0.28),transparent_70%)] blur-md" />
      {/* Vignette so the card is the brightest thing on screen. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(6,7,11,0.72)_100%)]" />
      {motion &&
        dust.map((mote) => (
          <span
            key={mote.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              width: `${mote.size}px`,
              height: `${mote.size}px`,
              opacity: mote.opacity,
              animation: `dust-drift ${mote.duration}ms linear ${mote.delay}ms infinite`,
            }}
          />
        ))}
    </div>
  );
}

/** Embers thrown off by the torn wrapper. */
export function TearEmbers({ motion }: { motion: boolean }) {
  const embers = useMemo(() => {
    const random = makeRandom("embers");
    return Array.from({ length: 10 }, (_, index) => ({
      id: index,
      left: 15 + random() * 70,
      top: 30 + random() * 40,
      dx: Math.round((random() - 0.5) * 120),
      dy: -30 - Math.round(random() * 60),
      delay: Math.round(random() * 180),
      size: 2 + Math.round(random() * 2),
    }));
  }, []);

  if (!motion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((ember) => (
        <span
          key={ember.id}
          className="absolute rounded-full bg-[var(--accent-2)]"
          style={
            {
              left: `${ember.left}%`,
              top: `${ember.top}%`,
              width: `${ember.size}px`,
              height: `${ember.size}px`,
              animation: `tear-ember 760ms ease-out ${ember.delay}ms both`,
              "--dx": `${ember.dx}px`,
              "--dy": `${ember.dy}px`,
              boxShadow: "0 0 6px rgba(245,165,36,0.9)",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Reveal progress as a row of tier-coloured segments. */
export function RevealProgress({
  tiers,
  revealed,
  className,
}: {
  tiers: { tier: string; chase: boolean }[];
  revealed: number;
  className?: string;
}) {
  return (
    <ol aria-hidden="true" className={cn("flex gap-1", className)}>
      {tiers.map((entry, index) => (
        <li
          key={index}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-300",
            index >= revealed
              ? "bg-[var(--border)]"
              : entry.chase
                ? "bg-[var(--accent-2)]"
                : "bg-[var(--accent)]/70"
          )}
        />
      ))}
    </ol>
  );
}
