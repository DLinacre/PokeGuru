import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Heart, X } from "lucide-react";
import type { TcgCard } from "../../types/pokemon";
import type { ExchangeRate } from "../../services/currency";
import { formatGbp, getCardValueGbp, pickCardmarketQuote, formatUpdatedAt } from "../../services/pricing";
import { NoData } from "../UI/EmptyState";
import { useExchangeRate } from "../../hooks/useApi";

interface CardPreviewModalProps {
  card: TcgCard;
  rate?: ExchangeRate | null;
  onClose: () => void;
  onAddToCollection?: (card: TcgCard) => void;
  isInCollection?: boolean;
  onRemoveFromCollection?: (cardId: string) => void;
}

export default function CardPreviewModal({
  card,
  rate: rateProp,
  onClose,
  onAddToCollection,
  isInCollection,
  onRemoveFromCollection,
}: CardPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { rate: fetchedRate } = useExchangeRate();
  const rate = rateProp ?? fetchedRate;

  const value = getCardValueGbp(card, rate);
  const quote = pickCardmarketQuote(card.pricing);
  const updated = formatUpdatedAt(quote?.updatedAt);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-preview-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full border border-[var(--border)] bg-[var(--bg)]/90 p-2 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          aria-label="Close card preview"
        >
          <X size={16} />
        </button>

        <div className="grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
          <div className="mx-auto w-full max-w-[220px]">
            {card.images.large || card.images.small ? (
              <img
                src={card.images.large || card.images.small}
                alt={`${card.name} card`}
                width={600}
                height={825}
                className="w-full rounded-xl shadow-[var(--shadow)]"
                decoding="async"
              />
            ) : (
              <div className="flex aspect-[245/337] items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
                Image unavailable
              </div>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
              {card.set.name || "Set not listed"} {card.localId ? `· #${card.localId}` : ""}
            </p>
            <h2 id="card-preview-title" className="mt-1 text-2xl font-bold text-[var(--text)]">
              {card.name}
            </h2>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Rarity</dt>
                <dd className="text-[var(--text)]">{card.rarity ?? <NoData />}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Illustrator</dt>
                <dd className="text-[var(--text)]">{card.illustrator ?? <NoData />}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                Cardmarket reference · GBP
              </p>
              <p className="mt-1 text-2xl font-black text-[#10b981]">
                {formatGbp(value) ?? <NoData />}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {updated ? `Marketplace data updated ${updated}. ` : ""}
                Reference prices, not completed sales.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={`/card/${card.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white no-underline transition-colors hover:bg-[#dc2626] hover:no-underline"
              >
                Full details
                <ExternalLink size={14} />
              </Link>
              {onAddToCollection && (
                <button
                  type="button"
                  onClick={() =>
                    isInCollection
                      ? onRemoveFromCollection?.(card.id)
                      : onAddToCollection(card)
                  }
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                    isInCollection
                      ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text)] hover:border-[var(--accent)]"
                  }`}
                  aria-pressed={isInCollection}
                >
                  <Heart size={14} fill={isInCollection ? "currentColor" : "none"} />
                  {isInCollection ? "In vault" : "Add to vault"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
