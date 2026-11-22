/**
 * "Top 100" data: a ranked, fully traceable list of the most valuable Pokémon
 * cards by Cardmarket trend.
 *
 * How the ranking is built — and why it is built this way
 * ------------------------------------------------------
 * TCGdex's search endpoint returns briefs with no pricing data and cannot sort
 * by price, so a price ranking has to come from card details (one request per
 * card). Fetching the whole ~20,000 card catalogue on every visit is not
 * something we are willing to do to a free public API.
 *
 * So the page builds a *price index*:
 *   1. candidate discovery — a fixed, published list of the rarities that hold
 *      essentially all expensive raw cards, one request per 100 cards
 *      (~2,600 candidates);
 *   2. enrichment — card details, a bounded number per visit, resumable,
 *      cached in localStorage so repeat visits cost nothing;
 *   3. ranking — only cards with a real, positive Cardmarket trend for a
 *      specific printing are ranked. Nothing is estimated, interpolated or
 *      padded, and the page always states how much of the candidate pool has
 *      been priced.
 *
 * Every figure carries: source currency (EUR), the printing it belongs to, the
 * Cardmarket update timestamp and the FX rate used for the GBP figure.
 */

import { loadCardDetails, searchCards } from "./tcgdex";
import { getCardPrice, type PriceConfidence } from "./pricing";
import type { TcgCard } from "../types/pokemon";

// Bumped when the candidate definition changes, so a stale stored index is
// discarded instead of being mixed with a new pool (v3 adds the additional
// rarity categories and per-category discovery counts).
export const INDEX_VERSION = 3;
export const INDEX_KEY = "pokeguru.top100.index.v3";

/**
 * Rarities that carry the market's value, in scan order. Page counts are the
 * per-visit discovery budget; discovery is cached for a week so this cost is
 * paid rarely.
 */
export const CANDIDATE_RARITIES: { rarity: string; label: string; pages: number }[] = [
  { rarity: "Special illustration rare", label: "Special Illustration Rare", pages: 4 },
  { rarity: "Illustration rare", label: "Illustration Rare", pages: 4 },
  { rarity: "Hyper rare", label: "Hyper Rare", pages: 2 },
  { rarity: "Secret Rare", label: "Secret Rare", pages: 2 },
  { rarity: "Ultra Rare", label: "Ultra Rare", pages: 3 },
  { rarity: "Rare Holo", label: "Rare Holo", pages: 4 },
  { rarity: "Holo Rare", label: "Holo Rare", pages: 2 },
  { rarity: "Shiny rare", label: "Shiny Rare", pages: 2 },
  { rarity: "Shiny Ultra Rare", label: "Shiny Ultra Rare", pages: 1 },
  { rarity: "Radiant Rare", label: "Radiant Rare", pages: 1 },
  { rarity: "ACE SPEC Rare", label: "ACE SPEC Rare", pages: 1 },
  { rarity: "Amazing Rare", label: "Amazing Rare", pages: 1 },
  { rarity: "Classic Collection", label: "Classic Collection", pages: 1 },
  { rarity: "Rare Holo VMAX", label: "Rare Holo VMAX", pages: 1 },
  { rarity: "Rare Holo VSTAR", label: "Rare Holo VSTAR", pages: 1 },
  { rarity: "Rare Holo V", label: "Rare Holo V", pages: 2 },
  { rarity: "Rare PRIME", label: "Rare PRIME", pages: 1 },
  { rarity: "Rare Holo LV.X", label: "Rare Holo LV.X", pages: 1 },
  { rarity: "LEGEND", label: "LEGEND", pages: 1 },
  // Additional categories that also hold expensive raw cards. The strings match
  // rarity values this project already models elsewhere; if the API has no cards
  // under one of them the category simply yields nothing and is reported as
  // empty on the page — no candidate is ever invented to fill a gap.
  { rarity: "Double rare", label: "Double Rare", pages: 3 },
  { rarity: "Holo Rare V", label: "Holo Rare V", pages: 2 },
  { rarity: "Holo Rare VMAX", label: "Holo Rare VMAX", pages: 1 },
  { rarity: "Holo Rare VSTAR", label: "Holo Rare VSTAR", pages: 1 },
  { rarity: "Shiny rare V", label: "Shiny Rare V", pages: 1 },
  { rarity: "Shiny rare VMAX", label: "Shiny Rare VMAX", pages: 1 },
  { rarity: "Mega Hyper Rare", label: "Mega Hyper Rare", pages: 1 },
  { rarity: "Black White Rare", label: "Black & White Rare", pages: 1 },
  { rarity: "Legendary Collection", label: "Legendary Collection", pages: 1 },
];

const PAGE_SIZE = 100;
/** Parallel discovery requests (cheap briefs, cached after the first visit). */
const DISCOVERY_CONCURRENCY = 4;
const CANDIDATE_TTL = 7 * 24 * 60 * 60 * 1000;

export interface TopCardEntry {
  id: string;
  name: string;
  localId: string;
  setId: string;
  setName: string;
  rarity: string;
  /** Set release date (YYYY-MM-DD) when the API publishes one. */
  release?: string;
  imageBase?: string;
  /** Cardmarket trend for the ranked printing, in EUR (source currency). */
  eur: number;
  /** GBP at the FX rate in force when the entry was priced. */
  gbp: number | null;
  /** FX rate used for `gbp`, so a stale conversion is traceable. */
  rate: number | null;
  variant: string;
  printing: string;
  updatedAt?: string;
  confidence: PriceConfidence;
  /** When PokeGuru priced this card. */
  pricedAt: number;
}

export interface TopIndex {
  version: number;
  /** Milliseconds since epoch when candidates were discovered. */
  candidatesBuiltAt: number;
  /** Candidate card ids, in scan order. */
  candidates: string[];
  /** Rarity label per candidate id, so we can show what we scanned. */
  candidateRarities: Record<string, string>;
  /** Cards found per rarity category at discovery time (0 = none in the API). */
  rarityCounts?: Record<string, number>;
  /** Card ids we have already priced or found unpriceable. */
  done: string[];
  entries: Record<string, TopCardEntry>;
  /** Last time enrichment ran. */
  scannedAt: number;
}

export function emptyIndex(): TopIndex {
  return {
    version: INDEX_VERSION,
    candidatesBuiltAt: 0,
    candidates: [],
    candidateRarities: {},
    rarityCounts: {},
    done: [],
    entries: {},
    scannedAt: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the stored index, discarding anything that does not match this version. */
export function readIndex(): TopIndex {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return emptyIndex();
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== INDEX_VERSION) return emptyIndex();
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates.filter((id): id is string => typeof id === "string") : [];
    const done = Array.isArray(parsed.done) ? parsed.done.filter((id): id is string => typeof id === "string") : [];
    const entries: Record<string, TopCardEntry> = {};
    if (isRecord(parsed.entries)) {
      for (const [id, value] of Object.entries(parsed.entries)) {
        if (!isRecord(value)) continue;
        if (typeof value.eur !== "number" || !Number.isFinite(value.eur) || value.eur <= 0) continue;
        entries[id] = {
          id,
          name: typeof value.name === "string" ? value.name : "",
          localId: typeof value.localId === "string" ? value.localId : "",
          setId: typeof value.setId === "string" ? value.setId : "",
          setName: typeof value.setName === "string" ? value.setName : "",
          rarity: typeof value.rarity === "string" ? value.rarity : "",
          release: typeof value.release === "string" ? value.release : undefined,
          imageBase: typeof value.imageBase === "string" ? value.imageBase : undefined,
          eur: value.eur,
          gbp: typeof value.gbp === "number" && Number.isFinite(value.gbp) ? value.gbp : null,
          rate: typeof value.rate === "number" && Number.isFinite(value.rate) ? value.rate : null,
          variant: typeof value.variant === "string" ? value.variant : "",
          printing: typeof value.printing === "string" ? value.printing : "",
          updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
          confidence: (typeof value.confidence === "string" ? value.confidence : "verified") as PriceConfidence,
          pricedAt: typeof value.pricedAt === "number" ? value.pricedAt : 0,
        };
      }
    }
    const candidateRarities: Record<string, string> = {};
    if (isRecord(parsed.candidateRarities)) {
      for (const [id, value] of Object.entries(parsed.candidateRarities)) {
        if (typeof value === "string") candidateRarities[id] = value;
      }
    }
    const rarityCounts: Record<string, number> = {};
    if (isRecord(parsed.rarityCounts)) {
      for (const [label, value] of Object.entries(parsed.rarityCounts)) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) rarityCounts[label] = value;
      }
    }
    return {
      version: INDEX_VERSION,
      candidatesBuiltAt: typeof parsed.candidatesBuiltAt === "number" ? parsed.candidatesBuiltAt : 0,
      candidates,
      candidateRarities,
      rarityCounts,
      done,
      entries,
      scannedAt: typeof parsed.scannedAt === "number" ? parsed.scannedAt : 0,
    };
  } catch {
    return emptyIndex();
  }
}

export function writeIndex(index: TopIndex): void {
  try {
    window.localStorage.setItem(
      INDEX_KEY,
      JSON.stringify({
        ...index,
        version: INDEX_VERSION,
        // Stored quotes are recomputed against the live FX rate when rendered,
        // so a rate change never silently rewrites history.
      })
    );
  } catch {
    /* private mode / quota — the page still works from memory */
  }
}

export function clearIndex(): void {
  try {
    window.localStorage.removeItem(INDEX_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Discovers candidate cards from the published rarity list. One request per
 * 100 cards; results are cheap briefs.
 */
export async function discoverCandidates(
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void
): Promise<{ candidates: string[]; rarities: Record<string, string>; counts: Record<string, number> }> {
  const jobs: { rarity: string; label: string; page: number }[] = [];
  for (const entry of CANDIDATE_RARITIES) {
    for (let page = 1; page <= entry.pages; page += 1) {
      jobs.push({ rarity: entry.rarity, label: entry.label, page });
    }
  }

  const perRarity = new Map<string, { label: string; pages: { page: number; ids: string[] }[] }>();
  let done = 0;
  let index = 0;

  const worker = async () => {
    while (index < jobs.length) {
      if (signal?.aborted) return;
      const job = jobs[index++];
      try {
        const result = await searchCards(
          { query: "", category: "", rarity: job.rarity, setId: "", sort: "newest", page: job.page, pageSize: PAGE_SIZE },
          { signal }
        );
        const bucket = perRarity.get(job.rarity) ?? { label: job.label, pages: [] };
        bucket.pages.push({ page: job.page, ids: result.cards.map((card) => card.id) });
        perRarity.set(job.rarity, bucket);
      } catch {
        // A failed page must not lose the pages we already have.
      } finally {
        done += 1;
        onProgress?.(done, jobs.length);
      }
    }
  };

  // Parallel discovery keeps a first visit short; the API tolerates this and
  // every response is cached for the rest of the session.
  await Promise.all(Array.from({ length: Math.min(DISCOVERY_CONCURRENCY, jobs.length) }, worker));

  const seen = new Set<string>();
  const candidates: string[] = [];
  const rarities: Record<string, string> = {};
  const counts: Record<string, number> = {};
  // Keep a stable, highest-value-first order: rarity order, then page order.
  for (const entry of CANDIDATE_RARITIES) {
    const bucket = perRarity.get(entry.rarity);
    counts[entry.label] = bucket ? bucket.pages.reduce((total, page) => total + page.ids.length, 0) : 0;
    if (!bucket) continue;
    for (const page of bucket.pages.sort((a, b) => a.page - b.page)) {
      for (const id of page.ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        candidates.push(id);
        rarities[id] = entry.label;
      }
    }
  }

  return { candidates, rarities, counts };
}

export interface EnrichOptions {
  /** Maximum card-detail requests to spend in this pass. */
  budget: number;
  concurrency?: number;
  signal?: AbortSignal;
  onCard?: (entry: TopCardEntry | null) => void;
  onProgress?: (done: number, total: number) => void;
}

/** Converts a full card into a stored entry, or null when it has no usable price. */
export function entryFromCard(card: TcgCard): TopCardEntry | null {
  const price = getCardPrice(card, null);
  if (!price) return null;
  const eur = price.headlineEur;
  if (eur == null || !Number.isFinite(eur) || eur <= 0) return null;
  if (!price.basis) return null;
  return {
    id: card.id,
    name: card.name,
    localId: card.localId ?? "",
    setId: card.set?.id ?? "",
    setName: card.set?.name ?? "",
    rarity: card.rarity ?? "",
    release: card.set?.releaseDate,
    imageBase: card.imageBase ?? card.images?.large ?? card.images?.small,
    eur,
    gbp: price.headlineGbp,
    rate: price.rate?.rate ?? null,
    variant: price.variantLabel,
    printing: price.printing,
    updatedAt: price.updatedAt,
    confidence: price.confidence,
    pricedAt: Date.now(),
  };
}

/**
 * Prices the next `budget` unresolved candidates. Returns the mutated index and
 * whether candidates remain, so the caller can offer "keep scanning".
 */
export async function enrichIndex(
  index: TopIndex,
  options: EnrichOptions
): Promise<{ index: TopIndex; remaining: number; priced: number; attempted: number; rateLimited: boolean }> {
  const { budget, concurrency = 5, signal, onCard, onProgress } = options;
  const done = new Set(index.done);
  const pending = index.candidates.filter((id) => !done.has(id));
  const batch = pending.slice(0, Math.max(0, budget));

  const entries = { ...index.entries };
  const scanned: string[] = [];
  let priced = 0;
  let consecutiveErrors = 0;
  let rateLimited = false;

  // A pass can be stopped by the caller or by the API refusing us: burning the
  // whole budget on failing requests would be rude and pointless.
  const guard = new AbortController();
  const linkAbort = () => guard.abort();
  if (signal?.aborted) guard.abort();
  else signal?.addEventListener("abort", linkAbort);

  try {
    if (batch.length && !guard.signal.aborted) {
      await loadCardDetails(batch, {
        concurrency,
        signal: guard.signal,
        onCard: (card) => {
          consecutiveErrors = 0;
          const entry = entryFromCard(card);
          if (entry) {
            entries[card.id] = entry;
            priced += 1;
          }
          scanned.push(card.id);
          onCard?.(entry);
        },
        onError: (id) => {
          // Unpriceable/unreachable: mark as done so we do not retry it forever,
          // but never invent a value for it.
          consecutiveErrors += 1;
          if (consecutiveErrors > 25) {
            rateLimited = true;
            guard.abort();
            return;
          }
          scanned.push(id);
          onCard?.(null);
        },
      });
    }
  } finally {
    signal?.removeEventListener("abort", linkAbort);
  }

  const nextDone = [...index.done, ...scanned.filter((id) => !done.has(id))];
  const nextIndex: TopIndex = {
    ...index,
    entries,
    done: [...new Set(nextDone)],
    scannedAt: Date.now(),
  };

  onProgress?.(scanned.length, batch.length);
  return {
    index: nextIndex,
    remaining: nextIndex.candidates.filter((id) => !new Set(nextIndex.done).has(id)).length,
    priced,
    attempted: scanned.length,
    rateLimited,
  };
}

/** Ranks stored entries: highest Cardmarket trend first, GBP recomputed live. */
export function rankEntries(
  index: TopIndex,
  rate: { rate: number } | null,
  limit = 100
): { entries: TopCardEntry[]; priced: number } {
  const all = Object.values(index.entries)
    .filter((entry) => entry.eur > 0 && Number.isFinite(entry.eur))
    .map((entry) => {
      const gbp = rate && Number.isFinite(rate.rate) ? entry.eur * rate.rate : entry.gbp;
      return { ...entry, gbp };
    })
    .sort((a, b) => b.eur - a.eur || a.name.localeCompare(b.name));
  return { entries: all.slice(0, limit), priced: all.length };
}

/** Aggregate freshness of the index — used for the "updated" line. */
export function indexUpdatedAt(index: TopIndex): number | null {
  const times = Object.values(index.entries).map((entry) => entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN);
  const valid = times.filter((value) => Number.isFinite(value));
  if (!valid.length) return index.scannedAt || null;
  return Math.max(...valid);
}

export function coverage(index: TopIndex): { scanned: number; total: number; priced: number; percent: number } {
  const total = index.candidates.length;
  // Count only ids that are in the current pool: a stale `done` entry from an
  // older candidate list must never inflate the completion figure.
  const pool = new Set(index.candidates);
  const done = new Set(index.done.filter((id) => pool.has(id)));
  const scanned = done.size;
  const priced = Object.values(index.entries).filter((entry) => entry.eur > 0).length;
  return { scanned, total, priced, percent: total ? Math.min(100, (scanned / total) * 100) : 0 };
}

/** Per-category discovery coverage, for the page's honesty panel. */
export function rarityCoverage(index: TopIndex): { label: string; found: number }[] {
  const counts = index.rarityCounts ?? {};
  return CANDIDATE_RARITIES.map((entry) => ({
    label: entry.label,
    found: typeof counts[entry.label] === "number" ? counts[entry.label] : 0,
  }));
}

/** Freshness limits: discovery weekly, prices daily. */
export function needsDiscovery(index: TopIndex, now = Date.now()): boolean {
  return !index.candidates.length || now - index.candidatesBuiltAt > CANDIDATE_TTL;
}

export function candidatesRemain(index: TopIndex): boolean {
  const done = new Set(index.done);
  return index.candidates.some((id) => !done.has(id));
}

/** Exposed for the page's honesty note. */
export const RARITY_SCOPE_NOTE = `Candidates come from the ${CANDIDATE_RARITIES.length} rarity categories that hold the market's expensive raw cards (${CANDIDATE_RARITIES.map(
  (entry) => entry.label
).join(", ")}). Every ranked card has a real Cardmarket trend for one specific printing.`;
