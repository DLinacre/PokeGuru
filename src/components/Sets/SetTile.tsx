import { Link } from "react-router-dom";
import { CalendarDays, Layers } from "lucide-react";
import type { TcgSet } from "../../types/pokemon";
import { NoData } from "../UI/EmptyState";

interface SetTileProps {
  set: TcgSet;
}

export default function SetTile({ set }: SetTileProps) {
  const releaseDate = set.releaseDate
    ? new Date(set.releaseDate).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
      })
    : null;

  return (
    <Link
      to={`/set/${set.id}`}
      className="group flex items-center gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4 no-underline transition-all hover:-translate-y-0.5 hover:border-[var(--accent-2)] hover:shadow-[var(--shadow)] hover:no-underline"
    >
      <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg)]/60 p-1.5">
        {set.images.logo ? (
          <img
            src={set.images.logo}
            alt={`${set.name} set logo`}
            width={80}
            height={56}
            loading="lazy"
            decoding="async"
            className="max-h-12 w-auto object-contain"
          />
        ) : (
          <Layers size={22} className="text-[var(--muted)]" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-[var(--text)] transition-colors group-hover:text-[var(--accent-2)]">
          {set.name}
        </h3>
        {set.series && <p className="truncate text-xs text-[var(--muted)]">{set.series}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={11} aria-hidden="true" />
            {releaseDate ?? <NoData label="Date unavailable" />}
          </span>
          <span className="inline-flex items-center gap-1">
            <Layers size={11} aria-hidden="true" />
            {set.cardCount.total ?? set.cardCount.official ?? "—"} cards
          </span>
        </p>
      </div>
    </Link>
  );
}
