import { useState } from "react";
import type { TcgCard } from "../../types/pokemon";
import CardTile from "./CardTile";
import CardPreviewModal from "./CardPreviewModal";
import { EmptyState } from "../UI/EmptyState";
import { SearchX } from "lucide-react";
import type { ExchangeRate } from "../../services/currency";
import { useCollection } from "../../hooks/useCollection";

interface CardGridProps {
  cards: TcgCard[];
  rate?: ExchangeRate | null;
  emptyMessage?: string;
  enablePreview?: boolean;
  /** Number of tiles in the first rows that should load eagerly. */
  priorityCount?: number;
  showPrice?: boolean;
}

export default function CardGrid({
  cards,
  rate,
  emptyMessage = "No cards found.",
  enablePreview = true,
  priorityCount = 6,
  showPrice = true,
}: CardGridProps) {
  const [previewCard, setPreviewCard] = useState<TcgCard | null>(null);
  const { addToCollection, removeFromCollection, isInCollection } = useCollection();

  if (!cards.length) {
    return (
      <EmptyState
        icon={<SearchX size={40} />}
        title="Nothing to show"
        description={emptyMessage}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((card, index) => (
          <CardTile
            key={card.id}
            card={card}
            priority={index < priorityCount}
            onPreview={enablePreview ? () => setPreviewCard(card) : undefined}
            showPrice={showPrice}
          />
        ))}
      </div>
      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          rate={rate}
          onClose={() => setPreviewCard(null)}
          onAddToCollection={addToCollection}
          onRemoveFromCollection={removeFromCollection}
          isInCollection={isInCollection(previewCard.id)}
        />
      )}
    </>
  );
}
