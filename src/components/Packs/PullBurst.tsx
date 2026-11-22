import { useMemo } from "react";
import type { RarityTier } from "../../types/packs";
import { cn } from "../../utils/cn";

/**
 * How much of a show a pull is worth.
 *
 *  - `common`  — an ordinary card: no effects at all, so a fast reveal stays fast.
 *  - `nice`    — holo, reverse holo, rare: a warm shimmer.
 *  - `chase`   — double rare and above: sparks.
 *  - `top`     — special illustration, hyper, secret: sparks, flames and embers.
 */
export type Drama = "common" | "nice" | "chase" | "top";

const NICE_TIERS = new Set<RarityTier>([
  "rare",
  "holoRare",
  "shinyRare",
  "radiant",
  "amazingRare",
]);
const CHASE_TIERS = new Set<RarityTier>([
  "doubleRare",
  "ultraRare",
  "aceSpec",
  "illustrationRare",
  "prime",
  "legend",
  "lvX",
]);
const TOP_TIERS = new Set<RarityTier>([
  "specialIllustrationRare",
  "hyperRare",
  "secretRare",
  "shinyUltraRare",
]);

export function pullDrama(tier: RarityTier): Drama {
  if (TOP_TIERS.has(tier)) return "top";
  if (CHASE_TIERS.has(tier)) return "chase";
  if (NICE_TIERS.has(tier)) return "nice";
  return "common";
}

export const DRAMA_COPY: Record<Drama, string> = {
  common: "",
  nice: "Nice pull",
  chase: "Rare pull!",
  top: "Huge pull!!",
};

/**
 * Deterministic pseudo-random numbers for the particle layout.
 *
 * Seeded by the card so a given pull always looks the same (and so the effect
 * never re-rolls on a re-render), and kept out of Math.random so nothing here
 * can be mistaken for game logic.
 */
function seededSequence(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const TINT: Record<Exclude<Drama, "common">, string> = {
  nice: "#7cc4ff",
  chase: "#f5a524",
  top: "#ff5a5f",
};

interface BurstProps {
  /** Stable identity for the effect (card id + slot), so it never re-rolls. */
  seed: string;
  drama: Drama;
  /** Reduced motion: draw a static glow instead of moving particles. */
  static?: boolean;
  className?: string;
}

/**
 * Particles around a freshly revealed card. Purely decorative: aria-hidden,
 * pointer-events-none, and it never delays or blocks the reveal itself.
 */
export default function PullBurst({
  seed,
  drama,
  static: isStatic = false,
  className,
}: BurstProps) {
  const sparks = useMemo(() => {
    if (drama === "common") return [];
    const random = seededSequence(seed);
    const count = drama === "top" ? 18 : drama === "chase" ? 12 : 8;
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      left: 6 + random() * 88,
      delay: random() * 0.5,
      duration: 0.7 + random() * 0.6,
      drift: (random() - 0.5) * 44,
      size: drama === "top" ? 4 + random() * 3 : 3 + random() * 2,
      colour:
        drama === "nice"
          ? TINT.nice
          : random() > 0.5
            ? TINT.chase
            : drama === "top"
              ? TINT.top
              : "#ffd166",
    }));
  }, [seed, drama]);

  const flames = useMemo(() => {
    if (drama !== "top") return [];
    const random = seededSequence(`${seed}:flames`);
    return Array.from({ length: 7 }, (_, index) => ({
      id: index,
      left: 12 + (index / 6) * 76,
      delay: random() * 0.4,
      duration: 0.8 + random() * 0.5,
      height: 22 + random() * 20,
    }));
  }, [seed, drama]);

  if (drama === "common") return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-20 overflow-visible",
        className,
      )}
    >
      {/* Rarity glow: warm for chase, hot red-gold for the top tier. */}
      <div
        className={cn(
          "absolute inset-0 rounded-[12px]",
          isStatic ? "opacity-90" : "animate-pull-glow",
        )}
        style={{
          background:
            drama === "top"
              ? `radial-gradient(circle at 50% 60%, rgba(255,90,95,0.55), rgba(245,165,36,0.28) 45%, transparent 72%)`
              : drama === "chase"
                ? `radial-gradient(circle at 50% 60%, rgba(245,165,36,0.45), transparent 70%)`
                : `radial-gradient(circle at 50% 60%, rgba(124,196,255,0.35), transparent 70%)`,
        }}
      />

      {!isStatic && (
        <>
          {sparks.map((spark) => (
            <span
              key={`s-${spark.id}`}
              className="absolute bottom-1/3 rounded-full animate-spark"
              style={{
                left: `${spark.left}%`,
                width: spark.size,
                height: spark.size,
                background: spark.colour,
                boxShadow: `0 0 ${spark.size * 3}px ${spark.size}px ${spark.colour}66`,
                animationDelay: `${spark.delay}s`,
                animationDuration: `${spark.duration}s`,
                ["--spark-drift" as string]: `${spark.drift}px`,
              }}
            />
          ))}

          {flames.map((flame) => (
            <span
              key={`f-${flame.id}`}
              className="absolute bottom-0 w-2 rounded-full animate-flame"
              style={{
                left: `${flame.left}%`,
                height: flame.height,
                background:
                  "linear-gradient(to top, rgba(255,90,95,0.9), rgba(245,165,36,0.75), transparent)",
                filter: "blur(2px)",
                animationDelay: `${flame.delay}s`,
                animationDuration: `${flame.duration}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface SparkBurstProps {
  seed: string;
  drama: Drama;
  static?: boolean;
}

/**
 * The big, screen-level celebration when a chase card is flipped: a ring of
 * sparks from the centre of the stage plus a one-shot vignette flash.
 */
export function PullCelebration({
  seed,
  drama,
  static: isStatic = false,
}: SparkBurstProps) {
  const rays = useMemo(() => {
    if (drama !== "chase" && drama !== "top") return [];
    const random = seededSequence(`${seed}:celebration`);
    const count = drama === "top" ? 20 : 14;
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      angle: (index / count) * 360 + random() * 10,
      length: 28 + random() * 42,
      delay: random() * 0.18,
      colour:
        drama === "top" ? (index % 2 ? TINT.top : TINT.chase) : TINT.chase,
    }));
  }, [seed, drama]);

  if (drama !== "chase" && drama !== "top") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[var(--radius)]"
    >
      <div
        className={cn(
          "absolute inset-0",
          isStatic ? "opacity-40" : "animate-vignette",
        )}
        style={{
          background:
            drama === "top"
              ? "radial-gradient(circle at 50% 55%, rgba(255,120,60,0.32), transparent 60%)"
              : "radial-gradient(circle at 50% 55%, rgba(245,165,36,0.22), transparent 62%)",
        }}
      />
      {!isStatic && (
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {rays.map((ray) => (
            <span
              key={ray.id}
              className="absolute origin-left rounded-full animate-ray"
              style={{
                width: ray.length,
                height: 2,
                background: `linear-gradient(to right, ${ray.colour}, transparent)`,
                ["--ray-angle" as string]: `${ray.angle}deg`,
                animationDelay: `${ray.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
