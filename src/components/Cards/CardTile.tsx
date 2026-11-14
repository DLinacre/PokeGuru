import { Link } from "react-router-dom";
import { memo, useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";
import type { TcgCard } from "../../types/pokemon";
import { useExchangeRate } from "../../hooks/useApi";
import { formatGbp, getCardPrice } from "../../services/pricing";
import type { ExchangeRate } from "../../services/currency";
import { rarityLabel } from "../../utils/search";
import { cn } from "../../utils/cn";

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

const CONFIDENCE_DOT: Record<string, string> = {
  verified: "#2fbf71",
  indicative: "#7cc4ff",
  stale: "#f5a524",
  unverified: "#f04452",
  unavailable: "#6f7889",
};

interface CardTileProps {
  card: TcgCard;
  /** First rows of cards load eagerly for a fast LCP. */
  priority?: boolean;
  onPreview?: () => void;
  showPrice?: boolean;
  className?: string;
  /** Optional shared rate so a grid does not subscribe 24 times. */
  rate?: ExchangeRate | null;
}

function CardTile({ card, priority = false, onPreview, showPrice = true, className, rate: rateProp }: CardTileProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const { rate: hookRate } = useExchangeRate();
  const rate = rateProp !== undefined ? rateProp : hookRate;

  /**
   * Prefer the 245×337 thumbnail, but fall back through the other published
   * derivatives if a specific variant is missing upstream (TCGdex serves
   * `{low,high}.{webp,png,jpg}` and not every combination exists for every
   * card).
   */
  const sources = useMemo(() => {
    const base = card.imageBase?.replace(/\.(webp|png|jpg|jpeg)$/i, "");
    const candidates =
      card.imageBase && base
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
  const price = useMemo(() => (showPrice ? getCardPrice(card, rate) : null), [card, rate, showPrice]);
  const priceLabel = price ? formatGbp(price.headlineGbp) : null;

  const subtitle = [card.set?.name, card.localId ? `#${card.localId}` : ""].filter(Boolean).join(" · ");
  const label = `${card.name}${card.set?.name ? ` — ${card.set.name}` : ""}`;
  const rarity = rarityLabel(card.rarity);

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
            "h-full w-full object-contain transition-[opacity,transform] duration-300 group-hover:scale-[1.035] motion-reduce:transform-none",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-dim)]">
          <ImageOff size={22} aria-hidden="true" />
          Image unavailable
        </span>
      )}
    </>
  );

  return (
    <article className={cn("group relative", className)}>
      <div
        className={cn(
          "holo-shimmer relative aspect-[245/337] w-full overflow-hidden rounded-t-[var(--radius)] border border-b-0 border-[var(--border)] bg-[var(--bg-inset)] transition-shadow duration-200 group-hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]",
          !imageLoaded && !imageFailed && "animate-shimmer"
        )}
      >
        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className="block h-full w-full cursor-zoom-in rounded-t-[var(--radius)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={`Preview ${label}`}
          >
            {image}
          </button>
        ) : (
          <Link to={`/card/${card.id}`} className="block h-full w-full" aria-label={`View ${label}`} tabIndex={-1}>
            {image}
          </Link>
        )}

        {card.types && card.types.length > 0 && (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex gap-0.5" aria-hidden="true">
            {card.types.map((type) => (
              <span
                key={type}
                className="inline-block h-3.5 w-3.5 rounded-full border border-black/40 shadow-sm"
                style={{ backgroundColor: TYPE_COLORS[type] || "#888" }}
                title={type}
              />
            ))}
          </div>
        )}

        {price && price.headlineGbp != null && price.confidence !== "verified" && (
          <span
            className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85 backdrop-blur"
            title={price.confidenceReason}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: CONFIDENCE_DOT[price.confidence] }}
              aria-hidden="true"
            />
            {price.confidence === "stale" ? "Stale" : price.confidence === "unverified" ? "Unverified" : "Indicative"}
          </span>
        )}
      </div>

      <Link
        to={`/card/${card.id}`}
        className="block rounded-b-[var(--radius)] border border-t-0 border-[var(--border)] bg-[var(--bg-card)] p-3 no-underline transition-colors hover:border-[var(--border-strong)] hover:no-underline"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-bold text-[var(--text)] transition-colors group-hover:text-[var(--accent-text)]">
            {card.name}
          </h3>
          {showPrice && (
            <span
              className={cn(
                "shrink-0 text-xs font-black tabular-nums",
                priceLabel ? "text-[var(--text)]" : "text-[9px] font-bold uppercase tracking-tight text-[var(--muted-dim)]"
              )}
              title={
                priceLabel
                  ? `${price?.confidenceLabel}: ${price?.confidenceReason}`
                  : "No Cardmarket price published for this card"
              }
            >
              {priceLabel ?? "No Data"}
            </span>
          )}
        </div>
        <p className="truncate text-[10px] font-bold uppercase tracking-tight text-[var(--muted)]">
          {subtitle || "Set not listed"}
        </p>
        {showPrice && card.isDetailed && rarity && (
          <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{rarity}</p>
        )}
      </Link>
    </article>
  );
}

export default memo(CardTile);
