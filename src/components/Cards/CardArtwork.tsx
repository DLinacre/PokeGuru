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
}

export type ArtworkState = "loading" | "loaded" | "missing" | "failed";

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
  /** Lets parents react to the artwork state (e.g. shimmer or reveal effects). */
  onStateChange?: (state: ArtworkState) => void;
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
  emptyLabel = "No artwork",
  failedLabel = "Artwork unavailable",
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
      <div
        role="img"
        aria-label={`${alt} — no artwork available`}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[var(--bg-inset)] p-2 text-center",
          className
        )}
      >
        <ImageOff size={20} className="text-[var(--muted-dim)]" aria-hidden="true" />
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--muted-dim)]">{emptyLabel}</span>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div
        role="img"
        aria-label={`${alt} — artwork could not be loaded`}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[var(--bg-inset)] p-2 text-center",
          className
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIndex(0);
            setAttempt((value) => value + 1);
            report("loading");
          }}
          className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-1 text-[var(--muted-dim)] transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <RotateCcw size={18} aria-hidden="true" />
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
