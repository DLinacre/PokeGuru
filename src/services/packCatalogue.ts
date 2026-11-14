/**
 * Pack catalogue.
 *
 * TCGdex set *briefs* do not carry the series, so the simulator asks each
 * booster series for its set list (one cached request per series) instead of
 * guessing from set ids. Release dates are joined from the curated UK set
 * index by exact name; when there is no match the date stays blank rather
 * than being invented.
 */

import type { PackSetSummary } from "../types/packs";
import type { PackConfig } from "../types/packs";
import {
  isBoosterSeries,
  isBoosterSet,
  resolvePackConfig,
  SERIES_ORDER,
} from "../data/packRules";
import { getWikiMeta } from "../utils/setMeta";
import { TCGDEX_BASE } from "./tcgdex";
import { fetchJson, raceAbort } from "./http";

const CATALOGUE_TTL = 24 * 60 * 60 * 1000;

/** Minimum printed cards for a product to count as a booster expansion. */
const MIN_CARDS = 20;

interface RawSeriesBrief {
  id?: string;
  name?: string;
}

interface RawSeriesSet {
  id?: string;
  name?: string;
  logo?: string | null;
  symbol?: string | null;
  cardCount?: { total?: number; official?: number };
}

interface RawSeriesDetail {
  id?: string;
  name?: string;
  sets?: RawSeriesSet[];
}

interface RawSetDetail {
  id?: string;
  releaseDate?: string;
}

/** Product ids that are boxed play products rather than booster sets. */
const NON_BOOSTER_IDS = new Set(["mfb"]);

const DATE_ENRICH_LIMIT = 40;
const DATE_CONCURRENCY = 5;

export interface CatalogueEntry extends PackSetSummary {
  config: PackConfig;
}

async function fetchJsonCached<T>(url: string, signal?: AbortSignal): Promise<T> {
  const { data } = await raceAbort(
    fetchJson<T>(url, {
      ttlMs: CATALOGUE_TTL,
      cacheKey: `packcatalogue:en:${url.replace(TCGDEX_BASE, "")}`,
    }),
    signal
  );
  return data;
}

/** Pure catalogue assembly, split out so it can be tested without fetch. */
export function buildCatalogue(
  details: { seriesId: string; sets: RawSeriesSet[] }[],
  releaseDates: (setName: string) => string | undefined = (name) => getWikiMeta(name)?.releaseDate
): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  const seen = new Set<string>();

  for (const detail of details) {
    if (!isBoosterSeries(detail.seriesId)) continue;
    for (const raw of detail.sets) {
      if (!raw.id || !raw.name || seen.has(raw.id)) continue;
      if (!isBoosterSet(raw.name) || NON_BOOSTER_IDS.has(raw.id)) continue;
      const official = raw.cardCount?.official ?? raw.cardCount?.total ?? 0;
      if (official < MIN_CARDS) continue;

      const config = resolvePackConfig({ id: raw.id, seriesId: detail.seriesId });
      if (!config) continue;

      seen.add(raw.id);
      const releaseDate = releaseDates(raw.name);
      entries.push({
        setId: raw.id,
        setName: raw.name,
        seriesId: detail.seriesId,
        seriesName: seriesName(detail.seriesId),
        releaseDate,
        cardCount: official || undefined,
        logo: raw.logo ?? undefined,
        symbol: raw.symbol ?? undefined,
        configId: config.id,
        era: config.era,
        confidence: config.confidence,
        boxPacks: config.boxPacks,
        supported: true,
        config,
      });
    }
  }

  return entries.sort((a, b) => {
    const aDate = a.releaseDate ? Date.parse(a.releaseDate) : Number.NaN;
    const bDate = b.releaseDate ? Date.parse(b.releaseDate) : Number.NaN;
    if (Number.isNaN(aDate) && Number.isNaN(bDate)) return a.setName.localeCompare(b.setName);
    if (Number.isNaN(aDate)) return 1;
    if (Number.isNaN(bDate)) return -1;
    return bDate - aDate;
  });
}

const SERIES_NAMES: Record<string, string> = {
  base: "Base",
  gym: "Gym",
  neo: "Neo",
  lc: "Legendary Collection",
  ecard: "E-Card",
  ex: "EX",
  dp: "Diamond & Pearl",
  pl: "Platinum",
  hgss: "HeartGold & SoulSilver",
  col: "Call of Legends",
  bw: "Black & White",
  xy: "XY",
  sm: "Sun & Moon",
  swsh: "Sword & Shield",
  sv: "Scarlet & Violet",
  me: "Mega Evolution",
};

export function seriesName(id: string): string {
  return SERIES_NAMES[id] ?? id;
}

export interface LoadedCatalogue {
  entries: CatalogueEntry[];
  seriesAvailable: { id: string; name: string; count: number }[];
  failedSeries: string[];
}

/** Load every booster series and assemble the catalogue. */
export async function loadPackCatalogue(signal?: AbortSignal): Promise<LoadedCatalogue> {
  const list = await fetchJsonCached<RawSeriesBrief[]>(`${TCGDEX_BASE}/series`, signal);
  const boosterIds = (Array.isArray(list) ? list : [])
    .map((entry) => entry.id)
    .filter((id): id is string => Boolean(id) && isBoosterSeries(id));

  // Keep the historical order rather than the API's arbitrary one.
  const ordered = SERIES_ORDER.filter((id) => boosterIds.includes(id));

  const failedSeries: string[] = [];
  const details = await Promise.all(
    ordered.map(async (seriesId) => {
      try {
        const detail = await fetchJsonCached<RawSeriesDetail>(`${TCGDEX_BASE}/series/${seriesId}`, signal);
        return { seriesId, sets: Array.isArray(detail.sets) ? detail.sets : [] };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        failedSeries.push(seriesId);
        return null;
      }
    })
  );

  const entries = buildCatalogue(details.filter((detail): detail is { seriesId: string; sets: RawSeriesSet[] } => Boolean(detail)));

  // The curated UK index stops at its last editorial update, so recent sets
  // have no date there. Ask TCGdex for just those sets (never for the whole
  // catalogue) and keep the blank when the request fails.
  const undated = entries.filter((entry) => !entry.releaseDate).slice(0, DATE_ENRICH_LIMIT);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(DATE_CONCURRENCY, undated.length) }, async () => {
      while (cursor < undated.length) {
        const entry = undated[cursor];
        cursor += 1;
        try {
          const detail = await fetchJsonCached<RawSetDetail>(`${TCGDEX_BASE}/sets/${entry.setId}`, signal);
          if (detail?.releaseDate) entry.releaseDate = detail.releaseDate;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          /* leave the date unavailable rather than guessing */
        }
      }
    })
  );

  entries.sort((a, b) => {
    const aDate = a.releaseDate ? Date.parse(a.releaseDate) : Number.NaN;
    const bDate = b.releaseDate ? Date.parse(b.releaseDate) : Number.NaN;
    if (Number.isNaN(aDate) && Number.isNaN(bDate)) return a.setName.localeCompare(b.setName);
    if (Number.isNaN(aDate)) return 1;
    if (Number.isNaN(bDate)) return -1;
    return bDate - aDate;
  });

  const seriesAvailable = ordered
    .map((id) => ({
      id,
      name: seriesName(id),
      count: entries.filter((entry) => entry.seriesId === id).length,
    }))
    .filter((entry) => entry.count > 0);

  return { entries, seriesAvailable, failedSeries };
}
