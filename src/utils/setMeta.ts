import type { TcgSet } from "../types/pokemon";
import { getAllSets } from "../data/ukSets";

/**
 * The UK set index carries editorial release dates and era names that the
 * TCGdex set *briefs* do not include. We merge them by exact set name (never
 * by guessing ids) and leave values blank when we have no match, rather than
 * inventing a date.
 */
export interface WikiSetMeta {
  releaseDate?: string;
  eraName?: string;
  type?: "main" | "special" | "promo";
  editorialCards?: number;
}

let index: Map<string, WikiSetMeta> | null = null;

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export function getWikiSetIndex(): Map<string, WikiSetMeta> {
  if (index) return index;
  const map = new Map<string, WikiSetMeta>();
  for (const set of getAllSets()) {
    map.set(normalise(set.name), {
      releaseDate: set.releaseDate,
      eraName: set.eraName,
      type: set.type,
      editorialCards: set.cards,
    });
  }
  index = map;
  return map;
}

export function getWikiMeta(setName: string): WikiSetMeta | undefined {
  return getWikiSetIndex().get(normalise(setName));
}

export function enrichSetWithWikiMeta(set: TcgSet): TcgSet {
  const meta = getWikiMeta(set.name);
  if (!meta) return set;
  return {
    ...set,
    releaseDate: set.releaseDate ?? meta.releaseDate,
    series: set.series || meta.eraName || "",
  };
}

export function seriesOptions(sets: TcgSet[]): string[] {
  const values = new Set<string>();
  sets.forEach((set) => {
    if (set.series) values.add(set.series);
  });
  return [...values].sort((a, b) => a.localeCompare(b));
}
