import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  candidatesRemain,
  clearIndex,
  coverage,
  discoverCandidates,
  enrichIndex,
  needsDiscovery,
  rankEntries,
  rarityCoverage,
  readIndex,
  writeIndex,
  type TopCardEntry,
  type TopIndex,
} from "../services/topCards";
import { useExchangeRate } from "./useApi";

export type TopStatus = "idle" | "discovering" | "pricing" | "ready" | "error";

const FIRST_PASS_BUDGET = 900;
const FOLLOW_UP_BUDGET = 600;

export interface UseTopCards {
  entries: TopCardEntry[];
  status: TopStatus;
  error: string | null;
  /** Cards with a verified Cardmarket trend, however many we have priced. */
  priced: number;
  scanned: number;
  total: number;
  percent: number;
  /** Untouched candidates left in the pool. */
  remaining: number;
  updatedAt: number | null;
  rate: ReturnType<typeof useExchangeRate>["rate"];
  continueScanning: () => void;
  rebuild: () => void;
  /** Cards discovered per candidate category, so the page can show coverage. */
  categories: { label: string; found: number }[];
}

/**
 * Drives the top-100 price index: discover candidates once a week, price a
 * bounded number per visit, rank what we have and expose honest coverage.
 * Nothing here invents a price — a card without a Cardmarket trend is skipped.
 */
export function useTopCards(): UseTopCards {
  const { rate } = useExchangeRate();
  const [index, setIndex] = useState<TopIndex>(() => readIndex());
  const [status, setStatus] = useState<TopStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [pass, setPass] = useState(0);
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (budget: number) => {
    const runId = runRef.current + 1;
    runRef.current = runId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);

    let current = readIndex();

    try {
      if (needsDiscovery(current)) {
        setStatus("discovering");
        const { candidates, rarities, counts } = await discoverCandidates(controller.signal);
        if (runRef.current !== runId) return;
        current = {
          ...current,
          candidates,
          candidateRarities: rarities,
          rarityCounts: counts,
          candidatesBuiltAt: Date.now(),
          // Keep prices for cards that are still candidates; drop the rest.
          done: current.done?.filter((id) => candidates.includes(id)) ?? [],
          entries: current.entries,
        };
        setIndex(current);
        writeIndex(current);
      }

      setStatus("pricing");
      // Show cards as they are priced instead of only at the end: the list
      // fills in while the pass runs, then the authoritative index replaces it.
      const partial: Record<string, TopCardEntry> = { ...current.entries };
      let seen = 0;
      const result = await enrichIndex(current, {
        budget,
        concurrency: 5,
        signal: controller.signal,
        onCard: (entry) => {
          if (entry) partial[entry.id] = entry;
          seen += 1;
          if (seen % 25 === 0 && runRef.current === runId) {
            setIndex((previous) => ({ ...previous, entries: { ...partial } }));
          }
        },
      });
      if (runRef.current !== runId) return;
      setIndex(result.index);
      writeIndex(result.index);
      setRemaining(result.remaining);
      setStatus("ready");
      if (result.rateLimited) {
        setError("The card database started refusing requests, so this pass stopped early. Try again in a minute.");
      }
    } catch (err) {
      if (runRef.current !== runId) return;
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(
        err instanceof Error && err.message
          ? `${err.message} — showing the cards already priced on this device.`
          : "The card database could not be reached — showing the cards already priced on this device."
      );
    }
  }, []);

  // First visit: use what is stored, then top it up once automatically.
  useEffect(() => {
    const stored = readIndex();
    setIndex(stored);
    const fresh = !needsDiscovery(stored) && Date.now() - stored.scannedAt < 6 * 60 * 60 * 1000;
    const complete = stored.candidates.length > 0 && !candidatesRemain(stored);
    if (fresh || complete) {
      setStatus("ready");
      setRemaining(candidatesRemain(stored) ? stored.candidates.length - stored.done.length : 0);
      return;
    }
    void run(FIRST_PASS_BUDGET);
  }, [run, pass]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ranked = useMemo(() => rankEntries(index, rate, 100), [index, rate]);

  const continueScanning = useCallback(() => {
    void run(FOLLOW_UP_BUDGET);
  }, [run]);

  const rebuild = useCallback(() => {
    clearIndex();
    setIndex(readIndex());
    setStatus("idle");
    setPass((value) => value + 1);
  }, []);

  const stats = coverage(index);
  const categories = useMemo(() => rarityCoverage(index), [index]);
  const updatedAt = useMemo(() => {
    const times = Object.values(index.entries)
      .map((entry) => (entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN))
      .filter((value) => Number.isFinite(value));
    if (!times.length) return index.scannedAt || null;
    return Math.max(...times);
  }, [index]);

  return {
    entries: ranked.entries,
    status,
    error,
    priced: ranked.priced,
    scanned: stats.scanned,
    total: stats.total,
    percent: stats.percent,
    remaining,
    updatedAt,
    rate,
    continueScanning,
    rebuild,
    categories,
  };
}
