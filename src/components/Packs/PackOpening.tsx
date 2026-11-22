import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FastForward,
  Hand,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from "lucide-react";
import type {
  PackConfig,
  PackPool,
  PackResult,
  RarityTier,
  WrapperStyle,
} from "../../types/packs";
import { TIER_LABELS } from "../../data/packRules";
import {
  cryptoRng,
  generatePack,
  generatePacks,
  seededRng,
} from "../../services/packEngine";
import {
  closeAudio,
  playBatchCheer,
  playCue,
  setSoundEnabled,
} from "../../services/packSound";
import PackArt from "./PackArt";
import PackCard, { isChase } from "./PackCard";
import PullBurst, {
  DRAMA_COPY,
  pullDrama,
  PullCelebration,
  type Drama,
} from "./PullBurst";
import RevealPile from "./RevealPile";
import PullSummary from "./PullSummary";
import type { PackCatalogueEntry } from "../../hooks/usePacks";
import { useExchangeRate } from "../../hooks/useApi";
import { usePackValues } from "../../hooks/usePackValues";
import { toOpeningSession } from "../../services/packValues";
import { recordOpening } from "../../services/simStore";
import PackValueBar from "./PackValueBar";
import PullValueLine from "./PullValueLine";
import { cn } from "../../utils/cn";

type Phase = "sealed" | "tearing" | "revealing" | "summary";

interface PackOpeningProps {
  pool: PackPool;
  config: PackConfig;
  meta: {
    setId: string;
    setName: string;
    seriesId: string;
    seriesName?: string;
    logo?: string;
    releaseDate?: string;
    cardCount?: number;
  };
  quantity: number;
  seed?: string;
  wrapperStyle: WrapperStyle;
  sound: boolean;
  reduceMotion: boolean;
  onToggleSound: () => void;
  onToggleMotion: () => void;
  onComplete: (results: PackResult[]) => void;
  onExit: () => void;
  onOpenAgain: (count: number) => void;
  /** Other expansions to offer when the opening completes. */
  catalogue?: PackCatalogueEntry[];
  /** Fast-replay pack counts (1, 5, box size…). */
  quickCounts?: number[];
}

/**
 * Cards sit in one fixed grid so a whole pack is always visible: no horizontal
 * strip to swipe through and no "where is the card I'm on?". Four columns on a
 * phone (three short rows) and five from `sm` up (two rows), which keeps every
 * card of a 9-11 card pack on screen at a readable size.
 */
const PACK_GRID =
  "grid grid-cols-4 gap-x-1.5 gap-y-2 sm:grid-cols-5 sm:gap-x-2";

export default function PackOpening({
  pool,
  config,
  meta,
  quantity,
  seed,
  wrapperStyle,
  sound,
  reduceMotion,
  onToggleSound,
  onToggleMotion,
  onComplete,
  onExit,
  onOpenAgain,
  catalogue = [],
  quickCounts = [1, 5, 10],
}: PackOpeningProps) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [results, setResults] = useState<PackResult[]>([]);
  const [packIndex, setPackIndex] = useState(0);
  /** Revealed card count per pack, so stepping between packs keeps its state. */
  const [revealed, setRevealed] = useState<number[]>([]);
  const [spotlight, setSpotlight] = useState<{
    name: string;
    tier: RarityTier;
    drama: Drama;
    key: number;
  } | null>(null);
  /**
   * Rapid taps are called out with a smaller, shorter banner instead of the
   * full-screen celebration, so spamming never turns into a strobe.
   */
  const [fastFlip, setFastFlip] = useState(false);

  /**
   * Prices. `useExchangeRate` is the same GBP rate every other page uses, and
   * `usePackValues` streams card prices in the background — the cards flip
   * immediately whether or not a single price has arrived.
   */
  const { rate } = useExchangeRate();
  /** Session ids already written to the opening history. */
  const savedSessionsRef = useRef(new Set<string>());

  const timerRef = useRef<number | null>(null);
  const spotlightRef = useRef<number | null>(null);
  const fastRef = useRef<number | null>(null);
  const motionChoiceRef = useRef(false);

  const lastFlipRef = useRef(0);
  const completedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  /**
   * Respect the OS "reduce motion" setting until the user makes a choice with
   * the toggle. Only the first visit is affected: after that, their saved
   * preference wins.
   */
  useEffect(() => {
    if (motionChoiceRef.current) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onToggleMotion();
    }
  }, [onToggleMotion]);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  const clearTimers = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (spotlightRef.current) window.clearTimeout(spotlightRef.current);
    if (fastRef.current) window.clearTimeout(fastRef.current);
    timerRef.current = null;
    spotlightRef.current = null;
    fastRef.current = null;
  };

  useEffect(() => {
    // Reset whenever the requested product changes.
    completedRef.current = false;
    setPhase("sealed");
    setResults([]);
    setPackIndex(0);
    setRevealed([]);
    setSpotlight(null);
    setFastFlip(false);
    lastFlipRef.current = 0;
    clearTimers();
    return clearTimers;
  }, [pool.setId, config.id, quantity, seed]);

  useEffect(() => () => closeAudio(), []);

  const current = results[packIndex] ?? null;
  const revealedCount = revealed[packIndex] ?? 0;
  const cards = current?.cards ?? [];
  const packComplete = Boolean(current) && revealedCount >= cards.length;
  const isLastPack = packIndex >= results.length - 1;
  const sealedLabel = quantity > 1 ? `Open ${quantity} packs` : "Open pack";

  /** Live valuations for every pack opened in this session. */
  const packValues = usePackValues({
    results,
    rate,
    activeIndex: packIndex,
    all: phase === "summary",
    enabled: results.length > 0,
  });

  const cardsKnown = Math.min(revealedCount, cards.length);
  const packTotals = useMemo(
    () =>
      results.map((pack) => {
        // A pack's total counts only the cards already turned over, so the
        // running figure matches what is on screen.
        if (pack.id !== current?.id) return packValues.totalsFor(pack.cards);
        return packValues.totalsFor(pack.cards.slice(0, cardsKnown));
      }),
    [results, packValues, current?.id, cardsKnown],
  );

  const activeTotals = packTotals[packIndex] ?? packValues.totalsFor([]);

  /** Cards still without a resolved price anywhere in the session. */
  const unresolved = useMemo(
    () => results.reduce((sum, pack) => sum + packValues.totalsFor(pack.cards).pending, 0),
    [results, packValues],
  );

  /**
   * Freeze the session's prices the first time the opening completes. This is
   * the record the history view shows; it is written once so a later market
   * move cannot rewrite what this opening was worth.
   */
  const persistSession = useCallback(() => {
    if (!results.length) return;
    const id = results[0].id;
    if (savedSessionsRef.current.has(id)) return;
    savedSessionsRef.current.add(id);
    recordOpening(
      toOpeningSession(
        id,
        results,
        results.map((pack) => pack.cards.map((card) => packValues.valueFor(card))),
        { setId: meta.setId, setName: meta.setName, seriesId: meta.seriesId },
      ),
    );
  }, [results, packValues, meta.setId, meta.setName, meta.seriesId]);

  useEffect(() => {
    if (phase !== "summary" || !results.length) return;
    // Wait for every price that is still in flight so the saved record is as
    // complete as the session allowed, but never block the UI on them: the
    // timer below writes whatever is known if anything stays unresolved.
    if (packValues.loading || unresolved > 0) return;
    persistSession();
  }, [phase, results.length, packValues.loading, unresolved, persistSession]);

  useEffect(() => {
    if (phase !== "summary" || !results.length) return;
    const timer = window.setTimeout(persistSession, 9000);
    return () => window.clearTimeout(timer);
  }, [phase, results.length, persistSession]);

  /**
   * Leaving mid-opening keeps whatever was known: a partial record is honest,
   * a missing one is not. The latest writer is held in a ref so this effect
   * runs once on unmount instead of after every render (which would snapshot
   * the opening before a single price had arrived).
   */
  const persistRef = useRef(persistSession);
  persistRef.current = persistSession;
  useEffect(() => () => persistRef.current(), []);

  /**
   * Announce a notable pull and play the cue that matches how good it is.
   *
   * Everything here is time-budgeted: flipping a whole pack in two seconds
   * still feels responsive because the long celebration is replaced by a short
   * callout, and the sound engine rate-limits itself.
   */
  const celebrate = useCallback((name: string, tier: RarityTier) => {
    const drama = pullDrama(tier);
    const time = Date.now();
    const rapid = time - lastFlipRef.current < 420;
    lastFlipRef.current = time;

    setFastFlip(rapid);
    if (fastRef.current) window.clearTimeout(fastRef.current);
    fastRef.current = window.setTimeout(() => setFastFlip(false), 500);

    if (drama === "common") {
      playCue("flip");
      return;
    }

    playCue(drama === "top" ? "hype" : "rare");
    setSpotlight({ name, tier, drama, key: time });
    if (spotlightRef.current) window.clearTimeout(spotlightRef.current);
    spotlightRef.current = window.setTimeout(
      () => setSpotlight(null),
      drama === "top" ? 2400 : 1700,
    );
  }, []);

  const generate = useCallback((): PackResult[] => {
    if (completedRef.current) return [];
    completedRef.current = true;

    const generated =
      quantity > 1
        ? generatePacks(
            {
              pool,
              config,
              setId: meta.setId,
              setName: meta.setName,
              seriesId: meta.seriesId,
            },
            quantity,
          )
        : [
            generatePack({
              pool,
              config,
              setId: meta.setId,
              setName: meta.setName,
              seriesId: meta.seriesId,
              seed: seed ?? undefined,
              rng: seed
                ? seededRng(`${seed}:${meta.setId}:${config.id}`)
                : cryptoRng(),
            }),
          ];

    setResults(generated);
    // Reduced motion skips the ceremony: every card is already face up.
    setRevealed(
      generated.map((pack) => (reduceMotion ? pack.cards.length : 0)),
    );
    onComplete(generated);
    return generated;
  }, [quantity, pool, config, meta, seed, reduceMotion, onComplete]);

  const begin = useCallback(() => {
    if (phase !== "sealed") return;
    playCue("tear");
    setPhase("tearing");
    timerRef.current = window.setTimeout(
      () => {
        generate();
        setPackIndex(0);
        setPhase("revealing");
      },
      reduceMotion ? 0 : 720,
    );
  }, [phase, reduceMotion, generate]);

  const revealNext = useCallback(() => {
    if (!current) return;
    const at = revealed[packIndex] ?? 0;
    const card = current.cards[at];
    if (!card) return;

    celebrate(card.name, card.tier);
    if (at + 1 === current.cards.length) playCue("complete");

    setRevealed((prev) => {
      const next = [...prev];
      next[packIndex] = at + 1;
      return next;
    });
  }, [current, revealed, packIndex, celebrate]);

  const revealPack = useCallback(() => {
    if (!current) return;
    setRevealed((prev) => {
      const next = [...prev];
      next[packIndex] = current.cards.length;
      return next;
    });
    const chase = current.cards.find(isChase);
    if (chase) {
      celebrate(chase.name, chase.tier);
    } else {
      playCue("flip");
    }
    playCue("complete");
  }, [current, packIndex, celebrate]);

  const openPack = useCallback(
    (index: number) => {
      const target = results[index];
      if (!target) return;

      if (reduceMotion) {
        setPackIndex(index);
        setRevealed((prev) => {
          const next = [...prev];
          next[index] = target.cards.length;
          return next;
        });
        setPhase("revealing");
        return;
      }

      playCue("tear");
      setPhase("tearing");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setPackIndex(index);
        setPhase("revealing");
        playCue("reveal");
      }, 520);
    },
    [results, reduceMotion],
  );

  /** Cheer for a finished pack, scaled by how many hits it contained. */
  const cheerForPack = useCallback((pack: PackResult | null) => {
    if (!pack) return;
    const hits = pack.cards.filter(isChase).length;
    playBatchCheer(hits >= 2 ? "high" : hits === 1 ? "mid" : "low");
  }, []);

  const advance = useCallback(() => {
    if (!current) return;
    if (!packComplete) {
      revealNext();
      return;
    }
    if (!isLastPack) {
      openPack(packIndex + 1);
      return;
    }
    cheerForPack(current);
    setPhase("summary");
  }, [
    current,
    packComplete,
    isLastPack,
    revealNext,
    openPack,
    packIndex,
    cheerForPack,
  ]);

  useEffect(() => {
    if (phase !== "revealing" || !current || !packComplete || !isLastPack)
      return;
    // Reduced motion keeps the finished pack on screen until the visitor asks
    // for the summary, instead of flashing it away.
    if (reduceMotion) return;
    const timer = window.setTimeout(() => setPhase("summary"), 700);
    return () => window.clearTimeout(timer);
  }, [phase, current, packComplete, isLastPack, reduceMotion]);

  // Keep the card you are on in view. `block: "nearest"` means this only
  // scrolls when the card is actually off-screen, so it never fights the page.
  useEffect(() => {
    if (phase !== "revealing") return;
    const active = Math.min(revealedCount, Math.max(0, cards.length - 1));
    cardRefs.current[active]?.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [phase, packIndex, revealedCount, cards.length, reduceMotion]);

  useEffect(() => {
    if (phase !== "revealing" || reduceMotion) return;
    // `→` and space both flip. Space is only swallowed when nothing focusable
    // would have used it, so keyboard users keep normal button behaviour.
    const onKey = (event: KeyboardEvent) => {
      const isArrow = event.key === "ArrowRight";
      const isSpace = event.key === " " || event.key === "Spacebar";
      if (!isArrow && !isSpace) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (isSpace && target && /^(BUTTON|A)$/.test(target.tagName)) return;
      event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reduceMotion, advance]);

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const distance = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (distance > 36) begin();
  };

  if (phase === "summary" && results.length) {
    return (
      <PullSummary
        results={results}
        onOpenAnother={onOpenAgain}
        onBack={onExit}
        packs={catalogue}
        ripCounts={quickCounts}
        quantity={quantity}
        activeSetId={meta.setId}
        hasSeparateHolo={Boolean(pool.tiers.holoRare?.length)}
        values={packValues}
        rate={rate}
      />
    );
  }

  return (
    <section aria-labelledby="opening-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">
            Pack simulator
          </p>
          <h2
            id="opening-heading"
            className="mt-0.5 truncate text-xl font-bold tracking-tight"
          >
            {meta.setName}
            {quantity > 1 ? ` · ${quantity} packs` : ""}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSound}
            className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
            aria-pressed={sound}
            title={sound ? "Mute sounds" : "Enable sounds"}
          >
            {sound ? (
              <Volume2 size={14} aria-hidden="true" />
            ) : (
              <VolumeX size={14} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {sound ? "Sound on" : "Muted"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              motionChoiceRef.current = true;
              onToggleMotion();
            }}
            className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
            aria-pressed={reduceMotion}
            title={reduceMotion ? "Enable animations" : "Reduce animation"}
          >
            <Wind size={14} aria-hidden="true" />
            <span className="hidden sm:inline">
              {reduceMotion ? "Motion reduced" : "Full motion"}
            </span>
          </button>
        </div>
      </div>

      <div className="surface relative overflow-hidden p-3 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(240,68,82,0.16),transparent_65%)]"
        />

        {phase === "sealed" && (
          <div className="relative flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={begin}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              className="group relative w-[170px] cursor-pointer rounded-[16px] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-[196px]"
              aria-label={`Open this ${meta.setName} pack`}
            >
              <div
                className={cn(
                  "relative",
                  !reduceMotion && "animate-pulse-soft",
                )}
              >
                <PackArt
                  setName={meta.setName}
                  seriesId={meta.seriesId}
                  seriesName={meta.seriesName}
                  logo={meta.logo}
                  style={wrapperStyle}
                  size="hero"
                />
                <span className="absolute inset-x-0 bottom-6 mx-auto flex w-max items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                  <Zap size={10} aria-hidden="true" /> Tap to open
                </span>
              </div>
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold">
                {quantity > 1
                  ? `Ready to open ${quantity} ${meta.setName} packs, one pack at a time`
                  : `Tap, click or swipe to tear open your ${meta.setName} pack`}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {config.cardsPerPack} cards · {config.era} ·{" "}
                {config.confidence === "documented"
                  ? "documented structure"
                  : "estimated structure"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={begin}
                >
                  {sealedLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onExit}
                >
                  Choose another pack
                </button>
              </div>
              {quantity > 1 && (
                <p className="mt-2 text-[11px] text-[var(--muted-dim)]">
                  Every pack is revealed with the same flip, rarity glow and
                  sounds as a single pack.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === "tearing" && (
          <div className="relative flex min-h-[320px] flex-col items-center justify-center gap-4">
            <div
              className={cn(
                "relative w-[170px] sm:w-[196px]",
                !reduceMotion && "animate-[pack-tear_0.7s_ease-in-out]",
              )}
              style={{ transform: reduceMotion ? undefined : "rotate(2deg)" }}
            >
              <PackArt
                setName={meta.setName}
                seriesId={meta.seriesId}
                seriesName={meta.seriesName}
                logo={meta.logo}
                style={wrapperStyle}
                size="hero"
                opened
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r from-transparent via-white to-transparent blur-[1px]"
              />
            </div>
            <p
              className="text-sm font-semibold text-[var(--muted)]"
              role="status"
              aria-live="polite"
            >
              {results.length > 1
                ? `Tearing pack ${packIndex + 1} of ${results.length}…`
                : "Tearing the wrapper…"}
            </p>
          </div>
        )}

        {phase === "revealing" && current && (
          <div className="relative">
            <PullCelebration
              seed={`${spotlight?.key ?? 0}-${packIndex}`}
              drama={
                spotlight && !reduceMotion && !fastFlip
                  ? spotlight.drama
                  : "common"
              }
              static={reduceMotion}
            />

            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  {results.length > 1 && (
                    <span className="text-[var(--accent-text)]">
                      Pack {packIndex + 1} of {results.length} ·{" "}
                    </span>
                  )}
                  {revealedCount} of {cards.length} flipped
                </p>
                <div
                  className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-[var(--bg-inset)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={cards.length}
                  aria-valuenow={revealedCount}
                  aria-label={`${revealedCount} of ${cards.length} cards revealed`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
                    style={{
                      width: `${(revealedCount / Math.max(1, cards.length)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!packComplete && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact text-[11px]"
                    onClick={revealPack}
                  >
                    <FastForward size={13} aria-hidden="true" /> Reveal pack
                  </button>
                )}
                {results.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact text-[11px]"
                    onClick={() => {
                      cheerForPack(current);
                      setPhase("summary");
                    }}
                    title="Skip the rest of the opening and jump to the summary"
                  >
                    Skip to summary
                  </button>
                )}
              </div>
            </div>

            <PackValueBar
              totals={activeTotals}
              loading={packValues.loading}
              failures={packValues.failures}
              onRetry={packValues.retry}
              reduceMotion={reduceMotion}
              className="mb-2"
            />

            {/* The pile: every flip lands on top of the last one. */}
            <div className="relative mb-2 flex min-h-[128px] items-center rounded-xl border border-[var(--border)] bg-[var(--bg-inset)]/70 p-2.5">
              <RevealPile
                revealed={cards.slice(0, revealedCount)}
                top={revealedCount > 0 ? cards[revealedCount - 1] : null}
                reduceMotion={reduceMotion}
                fast={fastFlip}
              />
              {spotlight && (
                <div
                  key={spotlight.key}
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "animate-callout pointer-events-none absolute inset-x-2 top-2 z-30 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-center text-[10px] font-black uppercase tracking-[0.14em]",
                    spotlight.drama === "top"
                      ? "bg-[var(--accent)]/25 text-[#ffd9a8] ring-1 ring-[var(--accent-2)]/60"
                      : "bg-[var(--accent-2)]/20 text-[var(--accent-2)] ring-1 ring-[var(--accent-2)]/45",
                  )}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  {DRAMA_COPY[spotlight.drama]} · {TIER_LABELS[spotlight.tier]}
                </div>
              )}
            </div>

            {/* One big, repeated-tap target: the whole stage flips the next card. */}
            <button
              type="button"
              onClick={advance}
              disabled={packComplete && isLastPack}
              aria-label={
                !packComplete
                  ? `Flip next card (${cards.length - revealedCount} left)`
                  : !isLastPack
                    ? "Open the next pack"
                    : "All cards flipped"
              }
              className="group relative flex w-full select-none items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2.5 text-sm font-bold text-[var(--accent-text)] transition-colors [touch-action:manipulation] hover:bg-[var(--accent)]/20 active:translate-y-px disabled:cursor-default disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--muted)]"
            >
              <Hand size={16} aria-hidden="true" className="shrink-0" />
              {!packComplete ? (
                <>
                  Tap anywhere here to flip
                  <span className="hidden text-[11px] font-semibold text-[var(--muted)] sm:inline">
                    ({cards.length - revealedCount} left · or press → / space)
                  </span>
                </>
              ) : !isLastPack ? (
                <>
                  Open pack {packIndex + 2} of {results.length}
                </>
              ) : (
                <>All {cards.length} cards flipped — see the summary below</>
              )}
            </button>

            {/* One grid for the whole pack: flipped cards stay face up, the rest
                wait face down, so the pack is always on one screen. */}
            <div
              role="list"
              aria-label={`Pack ${packIndex + 1} contents`}
              className={cn(PACK_GRID, "mt-2.5")}
            >
              {cards.map((card, index) => {
                const isFlipped = index < revealedCount;
                const isNext = index === revealedCount;
                return (
                  <div
                    key={`${card.id}-${card.slot}-${index}`}
                    role="listitem"
                    ref={(node) => {
                      cardRefs.current[index] = node;
                    }}
                    className="relative min-w-0"
                  >
                    <div className="relative">
                      <PackCard
                        pull={card}
                        revealed={isFlipped}
                        onReveal={isNext ? revealNext : undefined}
                        motion={!reduceMotion && isFlipped}
                        priority={index < 6}
                        compact
                      />
                      {isFlipped && (
                        <PullBurst
                          seed={`${card.id}-${card.slot}-${index}`}
                          drama={pullDrama(card.tier)}
                          static={reduceMotion || fastFlip}
                        />
                      )}
                      {isNext && !reduceMotion && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-0.5 animate-pulse-soft rounded-[12px] ring-2 ring-[var(--accent)]"
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 h-3 truncate text-center text-[9px] leading-3",
                        isFlipped
                          ? "font-semibold text-[var(--text-soft)]"
                          : "text-[var(--muted-dim)]",
                      )}
                      title={isFlipped ? card.name : undefined}
                    >
                      {isFlipped ? card.name : isNext ? "Tap to reveal" : ""}
                    </p>
                    {/* Fixed height: prices arriving never move the grid. */}
                    <div className="h-3.5">
                      {isFlipped && (
                        <PullValueLine
                          value={packValues.valueFor(card)}
                          pending={!packValues.valueFor(card) && packValues.loading}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {results.length > 1 && (
              <div
                className="mt-3 flex items-center gap-1"
                aria-label="Pack progress"
              >
                {results.map((pack, index) => {
                  const done = (revealed[index] ?? 0) >= pack.cards.length;
                  return (
                    <span
                      key={pack.id}
                      aria-hidden="true"
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        index === packIndex
                          ? "bg-[var(--accent)]"
                          : done
                            ? "bg-[var(--accent)]/45"
                            : "bg-[var(--bg-inset)]",
                      )}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">
                  <span className="font-semibold">
                    {cards.length - revealedCount > 0
                      ? `${cards.length - revealedCount} card${cards.length - revealedCount === 1 ? "" : "s"} left`
                      : "Pack complete"}
                  </span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {revealedCount} of {cards.length} flipped
                    {isLastPack && packComplete
                      ? " · this was the last pack"
                      : ""}
                  </span>
                </p>
              </div>
              {/* Always enabled: with reduced motion the pack is revealed at
                  once, so this is the only route to the summary. */}
              <button
                type="button"
                className="btn btn-primary btn-compact shrink-0 text-xs"
                onClick={advance}
              >
                {!packComplete ? (
                  <>
                    Flip next
                    <ChevronRight size={14} aria-hidden="true" />
                  </>
                ) : !isLastPack ? (
                  <>
                    Open pack {packIndex + 2} of {results.length}
                    <ChevronRight size={14} aria-hidden="true" />
                  </>
                ) : (
                  <>
                    See summary <Sparkles size={14} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === "sealed" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw size={12} aria-hidden="true" />
            Free and unlimited — no virtual currency, no ads, no accounts.
          </span>
          <span>Simulated pulls have no real-world value.</span>
        </div>
      )}
    </section>
  );
}
