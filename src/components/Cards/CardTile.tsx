import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { TcgCard } from "../../types/pokemon";
import { useExchangeRate } from "../../hooks/useApi";
import { getCardValueGbp, formatGbp } from "../../services/pricing";
import { cn } from "../../utils/cn";
import { rarityLabel } from "../../utils/search";

const TYPE_COLORS: Record<string, string> = {
  Colorless: "#a8a8a8",
  Darkness: "#5a4e4e",
  Dragon: "#e6a100",
  Fairy: "#e898d4",
  Fighting: "#c05a3e",
  Fire: "#f08030",
  Grass: "#78c850",
  Lightning: "#f8d030",
  Metal: "#b8b8d0",
  Psychic: "#f85888",
  Water: "#6890f0",
};

interface CardTileProps {
  card: TcgCard;
  /** First row of cards should load eagerly for a fast LCP. */
  priority?: boolean;
  onPreview?: () => void;
  showPrice?: boolean;
  className?: string;
}

export default function CardTile({ card, priority = false, onPreview, showPrice = true, className }: CardTileProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const { rate } = useExchangeRate();

  /**
   * Prefer the 245×337 thumbnail, but fall back through the other published
   * derivatives if a specific variant is missing upstream (TCGdex serves
   * `{low,high}.{webp,png,jpg}` and not every combination exists for every
   * card). Without this a single missing file leaves a blank tile.
   */
  const sources = useMemo(() => {
    const base = card.imageBase?.replace(/\.(webp|png|jpg|jpeg)$/i, "");
    const candidates = card.imageBase && base
      ? [`${base}/low.webp`, `${base}/low.png`, `${base}/high.webp`]
      : [card.images.small, card.images.large].filter((value): value is string => Boolean(value));
    return [...new Set(candidates)];
  }, [card.imageBase, card.images.small, card.images.large]);

  useEffect(() => {
    setSourceIndex(0);
    setImageLoaded(false);
    setImageFailed(false);
  }, [sources]);

  const imageUrl = sources[sourceIndex];
  const subtitle = [card.set?.name, card.localId ? `#${card.localId}` : ""].filter(Boolean).join(" · ");
  const value = showPrice ? getCardValueGbp(card, rate) : null;
  const priceLabel = formatGbp(value);
  const label = `${card.name}${card.set?.name ? ` — ${card.set.name}` : ""}`;

  const image = (
    <>
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={`${label} card image`}
          width={245}
          height={337}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (sourceIndex + 1 < sources.length) {
              setSourceIndex((index) => index + 1);
              setImageLoaded(false);
            } else {
              setImageFailed(true);
            }
          }}
          className={cn(
            "h-full w-full object-contain transition-opacity duration-300 group-hover:scale-[1.03] motion-reduce:transform-none",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]/60">
          <span aria-hidden="true" className="text-2xl">🃏</span>
          Image unavailable
        </span>
      )}
    </>
  );

  return (
    <article className={cn("group relative", className)}>
      <div
        className={cn(
          "holo-shimmer relative aspect-[245/337] w-full overflow-hidden rounded-t-[var(--radius)] border border-b-0 border-[var(--border)] bg-[#0b0d12]",
          !imageLoaded && !imageFailed && "animate-shimmer"
        )}
      >
        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className="block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={`Preview ${label}`}
          >
            {image}
          </button>
        ) : (
          <Link
            to={`/card/${card.id}`}
            className="block h-full w-full"
            aria-label={`View ${label}`}
            tabIndex={-1}
          >
            {image}
          </Link>
        )}

        {card.types && card.types.length > 0 && (
          <div className="pointer-events-none absolute bottom-1 left-1 flex gap-0.5" aria-hidden="true">
            {card.types.map((type) => (
              <span
                key={type}
                className="inline-block h-3.5 w-3.5 rounded-full border border-black/30 shadow-sm"
                style={{ backgroundColor: TYPE_COLORS[type] || "#888" }}
                title={type}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        to={`/card/${card.id}`}
        className="block rounded-b-[var(--radius)] border border-t-0 border-[var(--border)] bg-[var(--bg-card)] p-3 no-underline transition-colors hover:border-[var(--accent)]/50 hover:no-underline"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-bold text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
            {card.name}
          </h3>
          {showPrice && (
            <span
              className={cn(
                "shrink-0 text-xs font-black tabular-nums",
                priceLabel ? "text-[#10b981]" : "text-[var(--muted)]/60 text-[9px] font-bold uppercase tracking-tight"
              )}
              title={priceLabel ? "Cardmarket reference price converted to GBP" : "No Cardmarket price published for this card"}
            >
              {priceLabel ?? "No Data Available"}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-bold uppercase tracking-tight text-[var(--muted)]">
          {subtitle || "Set not listed"}
        </p>
        {showPrice && card.isDetailed && card.rarity && (
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]/80">{rarityLabel(card.rarity)}</p>
        )}
      </Link>
    </article>
  );
}
