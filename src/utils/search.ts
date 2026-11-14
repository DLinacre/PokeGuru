import type { SearchFilters, SearchSort } from "../types/pokemon";

export const SEARCH_PAGE_SIZE = 24;

export const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "Pokemon", label: "Pokémon" },
  { value: "Trainer", label: "Trainer" },
  { value: "Energy", label: "Energy" },
] as const;

/** Rarity values used by TCGdex (filtered with exact matching). */
export const RARITY_OPTIONS = [
  "",
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Double Rare",
  "Ultra Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Hyper Rare",
  "Rare Ultra",
  "Rare Secret",
  "Rare Rainbow",
  "Radiant Rare",
  "ACE SPEC Rare",
  "Shiny Rare",
  "Promo",
];

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

export function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    query: params.get("q") ?? "",
    category: params.get("category") ?? "",
    rarity: params.get("rarity") ?? "",
    setId: params.get("set") ?? "",
    sort: parseSort(params.get("sort")),
    page: parsePage(params.get("page")),
    pageSize: SEARCH_PAGE_SIZE,
  };
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
  if (filters.rarity) parts.push(filters.rarity);
  if (filters.setId) parts.push(`set ${filters.setId}`);
  return parts.join(" · ");
}
