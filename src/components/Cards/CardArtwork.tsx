import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageOff, RotateCcw } from "lucide-react";
import { cn } from "../../utils/cn";
import { cardImageCandidates, type CardImageSize } from "../../services/cardImages";

export interface ArtworkCard {
  id?: string;
  name?: string;
  imageBase?: string | null;
  images?: { small?: string; large?: string } | null;
  image?: string | null;
  /** Shown in the stand-in when the provider publishes no scan. */
  localId?: string | number;
  setName?: string;
  set?: { name?: string } | null;
  rarity?: string | null;
  tier?: string | null;
}

export type ArtworkState = "loading" | "loaded" | "missing" | "failed";

/** How much the stand-in says when there is no scan to show. */
export type PlaceholderDetail = "full" | "name" | "motif";

interface CardArtworkProps {
  card: ArtworkCard | null | undefined;
  size?: CardImageSize;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** First rows load eagerly. */
  priority?: boolean;
  /** Rendered inside the placeholder states. */
  emptyLabel?: string;
  failedLabel?: string;
  /** `full` (grid tiles), `name` (small pack cards) or `motif` (thumbnails). */
  placeholder?: PlaceholderDetail;
  /** Lets parents react to the artwork state (e.g. shimmer or reveal effects). */
  onStateChange?: (state: ArtworkState) => void;
}

/**
 * Rarity → hue, so the stand-in carries the same colour language as the rest of
 * the card UI without inventing artwork. Purely decorative: nothing here is
 * presented as card data.
 */
const RARITY_TONES: ReadonlyArray<{ test: RegExp; hue: number }> = [
  { test: /secret|hyper/i, hue: 32 },
  { test: /special illustration/i, hue: 285 },
  { test: /illustration/i, hue: 264 },
  { test: /ultra|double rare/i, hue: 214 },
  { test: /shiny|radiant/i, hue: 190 },
  { test: /holo/i, hue: 46 },
  { test: /rare/i, hue: 40 },
  { test: /uncommon/i, hue: 154 },
];

const NEUTRAL_HUES = [212, 264, 154, 26];

function placeholderHue(card: ArtworkCard): number {
  const rarity = `${card.rarity ?? ""} ${card.tier ?? ""}`;
  const match = RARITY_TONES.find((tone) => tone.test.test(rarity));
  if (match) return match.hue;
  // Stable, deterministic variety for everything else (no randomness per render).
  const seed = card.id ?? card.name ?? "";
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return NEUTRAL_HUES[hash % NEUTRAL_HUES.length];
}

/**
 * The stand-in used when TCGdex has no scan for a card.
 *
 * Some sets — Shining Fates Shiny Vault, Galarian Gallery, Trainer Gallery and
 * other subsets — have no artwork in the TCGdex asset library at all. Showing a
 * grey box made the app look broken, and substituting art from somewhere else
 * would be inventing card data, so instead the tile becomes a deliberate
 * card-shaped plate: the card's own name, set and number over a tinted,
 * pattern-lit background, plus a plain "No scan" badge. It never pretends to be
 * the card's artwork.
 */
function CardPlaceholder({
  card,
  alt,
  label,
  detail,
  className,
}: {
  card: ArtworkCard;
  alt: string;
  label: string;
  detail: PlaceholderDetail;
  className?: string;
}) {
  const hue = placeholderHue(card);
  const setName = card.setName ?? card.set?.name ?? "";
  const number = card.localId != null && String(card.localId) ? `#${card.localId}` : "";
  const subline = [setName, number].filter(Boolean).join(" · ");
  const showName = detail !== "motif" && Boolean(card.name);
  const showBadge = detail !== "motif" && Boolean(label);

  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt ? `${alt} — no artwork available` : undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--bg-inset)]",
        className
      )}
    >
      {/* Light and rings give the plate depth without any external asset. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 18% 0%, hsl(${hue} 62% 46% / 0.34), transparent 62%), linear-gradient(155deg, hsl(${hue} 45% 26% / 0.22), transparent 72%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full border border-white/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full border border-white/[0.06]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,hsl(${hue} 70% 70% / 0.5),transparent)]"
      />

      <div className="relative flex w-full min-w-0 flex-col items-center gap-1 px-1.5 py-2 text-center">
        {showName && (
          <p className="line-clamp-3 w-full text-[9px] font-black uppercase leading-[1.15] tracking-[0.06em] text-[var(--text-soft)] sm:text-[11px]">
            {card.name}
          </p>
        )}
        {detail === "full" && subline && (
          <p className="w-full truncate text-[7px] font-bold uppercase tracking-[0.12em] text-[var(--muted-dim)] sm:text-[8px]">
            {subline}
          </p>
        )}
        {showBadge && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/30 px-1.5 py-[2px] text-[6px] font-black uppercase tracking-[0.14em] text-[var(--muted)] sm:text-[7px]">
            <ImageOff size={7} aria-hidden="true" />
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The single card-artwork component for the whole app.
 *
 * It walks the published TCGdex derivatives (webp → png → high/low), so one
 * missing format never leaves a hole, and it distinguishes "this card has no
 * artwork" from "the image did not load" — neither ever renders a bare broken
 * image. State resets whenever the card or the size changes, which is what
 * makes pack reveals and virtualised grids safe.
 */
export default function CardArtwork({
  card,
  size = "thumb",
  alt,
  className,
  imgClassName,
  priority = false,
  emptyLabel = "No scan",
  failedLabel = "Artwork unavailable",
  placeholder = "full",
  onStateChange,
}: CardArtworkProps) {
  const candidates = useMemo(
    () => (card ? cardImageCandidates(card, size) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id, card?.imageBase, card?.images?.small, card?.images?.large, card?.image, size]
  );

  const [index, setIndex] = useState(0);
  const [state, setState] = useState<ArtworkState>(candidates.length ? "loading" : "missing");
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // A different card (or a different size) is a different image entirely.
  useEffect(() => {
    setIndex(0);
    setAttempt(0);
    setState(candidates.length ? "loading" : "missing");
  }, [candidates]);

  const report = useCallback(
    (next: ArtworkState) => {
      setState(next);
      onStateChange?.(next);
    },
    [onStateChange]
  );

  // Cached images can finish before React attaches listeners, so check the
  // element directly on mount as well.
  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    if (node.complete && node.naturalWidth > 0) report("loaded");
  }, [index, attempt, candidates, report]);

  const candidate = candidates[index];

  if (!candidate) {
    return (
      <CardPlaceholder
        card={card ?? {}}
        alt={alt}
        label={emptyLabel}
        detail={emptyLabel ? placeholder : "motif"}
        className={className}
      />
    );
  }

  if (state === "failed") {
    return (
      <div
        role="img"
        aria-label={`${alt} — artwork could not be loaded`}
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden bg-[var(--bg-inset)] p-2 text-center",
          className
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 18% 0%, hsl(${placeholderHue(card ?? {})} 45% 40% / 0.22), transparent 62%)`,
          }}
        />
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIndex(0);
            setAttempt((value) => value + 1);
            report("loading");
          }}
          className="relative flex flex-col items-center gap-1.5 rounded-lg px-2 py-1 text-[var(--muted-dim)] transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span className="line-clamp-2 text-[8px] font-black uppercase leading-tight tracking-[0.1em] text-[var(--text-soft)]">
            {card?.name}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em]">{failedLabel}</span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.12em] opacity-70">Tap to retry</span>
        </button>
      </div>
    );
  }

  return (
    <img
      key={`${candidate.url}-${attempt}`}
      ref={imgRef}
      src={candidate.url}
      alt={alt}
      width={candidate.quality === "high" ? 600 : 245}
      height={candidate.quality === "high" ? 825 : 337}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      // TCGdex serves its own assets; never leak a referrer that a hotlink
      // policy could reject.
      referrerPolicy="no-referrer"
      draggable={false}
      className={cn(
        "h-full w-full object-contain transition-opacity duration-300",
        state === "loaded" ? "opacity-100" : "opacity-0",
        imgClassName,
        className
      )}
      onLoad={() => report("loaded")}
      onError={() => {
        if (index + 1 < candidates.length) {
          setIndex((value) => value + 1);
          return;
        }
        report("failed");
      }}
    />
  );
}
