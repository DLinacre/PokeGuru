import { cn } from "../../utils/cn";
import CardArtwork from "../Cards/CardArtwork";
import type { PulledCard } from "../../types/packs";
import { TIER_LABELS, tierRank } from "../../data/packRules";

/**
 * Rarity tiers that always get the chase treatment (gold ring, glow, trophy
 * cue). Shared with the reveal stage and the batch summary so a card is never
 * "rare" in one place and ordinary in another.
 */
export const CHASE_TIERS: ReadonlySet<string> = new Set([
  "doubleRare",
  "ultraRare",
  "illustrationRare",
  "specialIllustrationRare",
  "hyperRare",
  "secretRare",
  "aceSpec",
  "shinyUltraRare",
]);

export function isChase(pull: { tier: string }): boolean {
  return CHASE_TIERS.has(pull.tier);
}

export function tierTreatmentClasses(pull: PulledCard): string {
  if (CHASE_TIERS.has(pull.tier))
    return "ring-2 ring-[var(--accent-2)] shadow-[0_0_28px_-6px_rgba(245,165,36,0.65)]";
  if (pull.treatment === "reverse") return "ring-1 ring-[#a78bfa]/70";
  if (pull.treatment === "holo") return "ring-1 ring-[#7cc4ff]/70";
  return "ring-1 ring-[var(--border)]";
}

interface PackCardProps {
  pull: PulledCard;
  revealed: boolean;
  onReveal?: () => void;
  motion?: boolean;
  priority?: boolean;
  className?: string;
  /** Compact mode for batch summaries. */
  compact?: boolean;
}

export default function PackCard({
  pull,
  revealed,
  onReveal,
  motion = true,
  priority = false,
  className,
  compact = false,
}: PackCardProps) {
  const chase = CHASE_TIERS.has(pull.tier);
  const face = (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-[10px] bg-[var(--bg-soft)]",
        tierTreatmentClasses(pull),
      )}
    >
      {revealed ? (
        <CardArtwork
          card={{
            id: pull.id,
            name: pull.name,
            imageBase: pull.imageBase ?? pull.image,
          }}
          size="thumb"
          priority={priority}
          alt={`${pull.name} from ${pull.setName}`}
          emptyLabel="No artwork"
          imgClassName="rounded-[9px]"
        />
      ) : (
        <div className="h-full w-full" aria-hidden="true" />
      )}

      {(chase || pull.treatment !== "normal") && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 mix-blend-overlay",
            chase
              ? "bg-[linear-gradient(135deg,rgba(255,138,146,0.5),rgba(245,165,36,0.5),rgba(124,196,255,0.5))]"
              : pull.treatment === "reverse"
                ? "bg-[linear-gradient(135deg,rgba(167,139,250,0.35),transparent_60%)]"
                : "bg-[linear-gradient(135deg,rgba(124,196,255,0.28),transparent_60%)]",
          )}
        />
      )}

      {chase && (
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[7px] font-black uppercase tracking-widest text-[var(--accent-2)]">
          {TIER_LABELS[pull.tier]}
        </span>
      )}

      {!compact && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1.5 pt-5">
          <p className="truncate text-[10px] font-bold leading-tight text-white">
            {pull.name}
          </p>
          <p className="truncate text-[8px] text-white/70">
            {pull.setName} · #{pull.localId}
            {pull.treatment === "reverse"
              ? " · Reverse"
              : pull.treatment === "holo"
                ? " · Holo"
                : ""}
          </p>
        </div>
      )}
    </div>
  );

  const card = (
    <div
      className={cn(
        "relative aspect-[245/337] w-full [perspective:1200px]",
        className,
      )}
      data-tier={pull.tier}
      data-rank={tierRank(pull.tier)}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
        )}
        style={{
          transform: revealed || !motion ? "rotateY(0deg)" : "rotateY(180deg)",
        }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          {revealed ? (
            face
          ) : (
            <div className="h-full w-full rounded-[10px] bg-[var(--bg-card)] ring-1 ring-[var(--border)]" />
          )}
        </div>
        {!revealed && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center rounded-[10px] border border-[var(--border-strong)] bg-[radial-gradient(circle_at_30%_20%,rgba(240,68,82,0.35),rgba(16,19,25,0.95)_65%)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <span className="font-[family-name:var(--font-display)] text-lg font-black text-white/25">
              PG
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (!revealed && onReveal) {
    return (
      <button
        type="button"
        onClick={onReveal}
        className="group w-full cursor-pointer rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={`Reveal card ${pull.name}`}
      >
        {card}
      </button>
    );
  }

  return card;
}
