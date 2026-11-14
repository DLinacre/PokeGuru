import type { CardVariants } from "../types/pokemon";
import type { SearchFilters, SearchSort } from "../types/pokemon";

export const SEARCH_PAGE_SIZE = 24;

export const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "Pokemon", label: "Pokémon" },
  { value: "Trainer", label: "Trainer" },
  { value: "Energy", label: "Energy" },
] as const;

/**
 * TCGdex publishes rarity strings in sentence case (see /v2/en/rarities), and
 * filters match exactly. Keep the API value and present a tidier label.
 */
export const RARITY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All rarities" },
  { value: "Common", label: "Common" },
  { value: "Uncommon", label: "Uncommon" },
  { value: "Rare", label: "Rare" },
  { value: "Rare Holo", label: "Rare Holo" },
  { value: "Holo Rare", label: "Holo Rare" },
  { value: "Double rare", label: "Double Rare" },
  { value: "Ultra Rare", label: "Ultra Rare" },
  { value: "Illustration rare", label: "Illustration Rare" },
  { value: "Special illustration rare", label: "Special Illustration Rare" },
  { value: "Hyper rare", label: "Hyper Rare" },
  { value: "Secret Rare", label: "Secret Rare" },
  { value: "Radiant Rare", label: "Radiant Rare" },
  { value: "ACE SPEC Rare", label: "ACE SPEC Rare" },
  { value: "Shiny rare", label: "Shiny Rare" },
  { value: "Full Art Trainer", label: "Full Art Trainer" },
  { value: "Classic Collection", label: "Classic Collection" },
  { value: "Promo", label: "Promo" },
];

const RARITY_LOOKUP = new Map(
  RARITY_OPTIONS.filter((option) => option.value).map((option) => [option.value.toLowerCase(), option.value])
);

/** Accept legacy/title-cased rarity links and return the exact API value. */
export function canonicalRarity(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return RARITY_LOOKUP.get(trimmed.toLowerCase()) ?? trimmed;
}

export function rarityLabel(value: string | null | undefined): string {
  if (!value) return "";
  const match = RARITY_OPTIONS.find((option) => option.value.toLowerCase() === value.toLowerCase());
  return match?.label ?? value;
}

export const SORT_OPTIONS: { value: SearchSort; label: string; note?: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest sets" },
  { value: "oldest", label: "Oldest sets" },
  { value: "value_high", label: "Highest price (this page)", note: "Ranks the cards on this page using Cardmarket reference prices." },
  { value: "value_low", label: "Lowest price (this page)", note: "Ranks the cards on this page using Cardmarket reference prices." },
];

const VALID_SORTS = new Set<SearchSort>(["name", "newest", "oldest", "value_high", "value_low"]);

export function parseSort(value: string | null): SearchSort {
  return value && VALID_SORTS.has(value as SearchSort) ? (value as SearchSort) : "name";
}

export function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export const PRINTING_OPTIONS = [
  { value: "", label: "Any printing" },
  { value: "normal", label: "Standard" },
  { value: "holo", label: "Holofoil" },
  { value: "reverse", label: "Reverse holofoil" },
  { value: "firstEdition", label: "1st edition" },
] as const;

export function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    rarity: canonicalRarity(params.get("rarity")),
    setId: params.get("set") ?? "",
    illustrator: params.get("illustrator") ?? "",
    number: params.get("number") ?? "",
    sort: parseSort(params.get("sort")),
    page: parsePage(params.get("page")),
    pageSize: SEARCH_PAGE_SIZE,
    minValue: params.get("min") ?? "",
    maxValue: params.get("max") ?? "",
    printing: params.get("printing") ?? "",
  };
}

/** Filters that only make sense once the page's card details are loaded. */
export function hasPageOnlyFilters(filters: SearchFilters): boolean {
  return Boolean(filters.minValue || filters.maxValue || filters.printing);
}

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Apply price/printing filters to an already-hydrated page of cards. */
export function filterHydratedPage<T extends { card: { variants?: CardVariants } }>(
  rows: T[],
  filters: SearchFilters,
  valueOf: (row: T) => number | null
): T[] {
  const min = parsePrice(filters.minValue);
  const max = parsePrice(filters.maxValue);
  const printing = filters.printing;

  return rows.filter((row) => {
    const value = valueOf(row);
    if (min !== null && (value === null || value < min)) return false;
    if (max !== null && (value === null || value > max)) return false;
    if (printing) {
      const variants = row.card.variants;
      if (!variants || variants[printing as keyof CardVariants] !== true) return false;
    }
    return true;
  });
}

/**
 * Apply updates to a URLSearchParams object, dropping empty values and
 * resetting to page 1 whenever a filter (not the page itself) changes.
 */
export function applyParamUpdates(
  current: URLSearchParams,
  updates: Record<string, string | number | undefined>
): URLSearchParams {
  const next = new URLSearchParams(current);
  const changedFilters = Object.keys(updates).some((key) => key !== "page");

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) === 1)) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  if (changedFilters) next.delete("page");
  return next;
}

/** Shareable, human-readable description of the active filters. */
export function describeFilters(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.query) parts.push(`“${filters.query}”`);
  if (filters.category) parts.push(filters.category === "Pokemon" ? "Pokémon" : filters.category);
  if (filters.rarity) parts.push(rarityLabel(filters.rarity));
  if (filters.setId) parts.push(`set ${filters.setId}`);
  if (filters.number) parts.push(`#${filters.number}`);
  if (filters.illustrator) parts.push(`illus. ${filters.illustrator}`);
  if (filters.minValue || filters.maxValue) {
    parts.push(`£${filters.minValue || "0"}–${filters.maxValue ? `£${filters.maxValue}` : "any"}`);
  }
  if (filters.printing) parts.push(PRINTING_OPTIONS.find((o) => o.value === filters.printing)?.label ?? filters.printing);
  return parts.join(" · ");
}
