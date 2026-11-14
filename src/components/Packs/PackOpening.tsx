import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FastForward,
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
import { TIER_LABELS, tierRank } from "../../data/packRules";
import {
  cryptoRng,
  generatePack,
  generatePacks,
  seededRng,
} from "../../services/packEngine";
import { closeAudio, playCue, setSoundEnabled } from "../../services/packSound";
import PackArt from "./PackArt";
import PackCard, { isChase } from "./PackCard";
import PullSummary from "./PullSummary";
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
}: PackOpeningProps) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [results, setResults] = useState<PackResult[]>([]);
  const [packIndex, setPackIndex] = useState(0);
  /** Revealed card count per pack, so stepping between packs keeps its state. */
  const [revealed, setRevealed] = useState<number[]>([]);
  const [spotlight, setSpotlight] = useState<{
    name: string;
    tier: RarityTier;
  } | null>(null);

  const timerRef = useRef<number | null>(null);
  const spotlightRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  const clearTimers = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (spotlightRef.current) window.clearTimeout(spotlightRef.current);
    timerRef.current = null;
    spotlightRef.current = null;
  };

  useEffect(() => {
    // Reset whenever the requested product changes.
    completedRef.current = false;
    setPhase("sealed");
    setResults([]);
    setPackIndex(0);
    setRevealed([]);
    setSpotlight(null);
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

  const flashSpotlight = useCallback((name: string, tier: RarityTier) => {
    setSpotlight({ name, tier });
    if (spotlightRef.current) window.clearTimeout(spotlightRef.current);
    spotlightRef.current = window.setTimeout(() => setSpotlight(null), 2600);
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

    playCue(isChase(card) ? "rare" : "flip");
    if (isChase(card)) flashSpotlight(card.name, card.tier);
    if (at + 1 === current.cards.length) playCue("complete");

    setRevealed((prev) => {
      const next = [...prev];
      next[packIndex] = at + 1;
      return next;
    });
  }, [current, revealed, packIndex, flashSpotlight]);

  const revealPack = useCallback(() => {
    if (!current) return;
    setRevealed((prev) => {
      const next = [...prev];
      next[packIndex] = current.cards.length;
      return next;
    });
    const chase = current.cards.find(isChase);
    if (chase) {
      playCue("rare");
      flashSpotlight(chase.name, chase.tier);
    } else {
      playCue("flip");
    }
    playCue("complete");
  }, [current, packIndex, flashSpotlight]);

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

  /** One action for the whole flow: flip the next card, or move to the next pack. */
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
    setPhase("summary");
  }, [current, packComplete, isLastPack, revealNext, openPack, packIndex]);

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
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "ArrowRight" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
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

  const bestSoFar = useMemo(() => {
    if (!current || revealedCount === 0) return null;
    return current.cards
      .slice(0, revealedCount)
      .reduce<PackResult["cards"][number]>(
        (best, card) =>
          tierRank(card.tier) > tierRank(best.tier) ? card : best,
        current.cards[0],
      );
  }, [current, revealedCount]);

  const lastRevealed =
    revealedCount > 0 ? (current?.cards[revealedCount - 1] ?? null) : null;
  // Duplicate pulls share an id, so compare tiers rather than identities.
  const lastIsBest =
    bestSoFar !== null &&
    lastRevealed !== null &&
    tierRank(lastRevealed.tier) >= tierRank(bestSoFar.tier);

  if (phase === "summary" && results.length) {
    return (
      <PullSummary
        results={results}
        onOpenAnother={onOpenAgain}
        onBack={onExit}
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
            onClick={onToggleMotion}
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
            {spotlight && (
              <div
                role="status"
                aria-live="polite"
                className="animate-fade-in mb-1.5 flex items-center justify-center gap-2 rounded-lg border border-[var(--accent-2)]/45 bg-[var(--warning-soft)] px-3 py-1 text-center text-[11px] font-bold text-[var(--accent-2)]"
              >
                <Sparkles size={13} aria-hidden="true" />
                {TIER_LABELS[spotlight.tier]} · {spotlight.name}
              </div>
            )}

            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  {results.length > 1 && (
                    <span className="text-[var(--accent-text)]">
                      Pack {packIndex + 1} of {results.length} ·{" "}
                    </span>
                  )}
                  Card{" "}
                  {Math.min(
                    revealedCount + (packComplete ? 0 : 1),
                    cards.length,
                  )}{" "}
                  of {cards.length}
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
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
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
                    className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
                    onClick={() => setPhase("summary")}
                    title="Skip the rest of the opening and jump to the summary"
                  >
                    Skip to summary
                  </button>
                )}
              </div>
            </div>

            <div
              role="list"
              aria-label={`Pack ${packIndex + 1} contents`}
              className={PACK_GRID}
            >
              {cards.map((card, index) => {
                const isRevealed = index < revealedCount;
                const isNext = index === revealedCount;
                return (
                  <div
                    key={`${card.id}-${index}`}
                    role="listitem"
                    ref={(node) => {
                      cardRefs.current[index] = node;
                    }}
                    className={cn(
                      "relative min-w-0 transition-[transform,opacity] duration-300",
                      isNext && "z-10 -translate-y-0.5",
                      !isRevealed && !isNext && "opacity-80",
                    )}
                  >
                    <PackCard
                      pull={card}
                      revealed={isRevealed}
                      onReveal={isNext ? revealNext : undefined}
                      motion={!reduceMotion}
                      priority={index < 6}
                      compact
                    />
                    {isNext && !isRevealed && !reduceMotion && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-0.5 animate-pulse-soft rounded-[12px] ring-2 ring-[var(--accent)]"
                      />
                    )}
                    <p
                      className={cn(
                        "mt-0.5 h-3 truncate text-center text-[9px] leading-3",
                        isRevealed
                          ? "font-semibold text-[var(--text-soft)]"
                          : "text-[var(--muted-dim)]",
                      )}
                      title={isRevealed ? card.name : undefined}
                    >
                      {isRevealed ? card.name : isNext ? "Tap to reveal" : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            {results.length > 1 && (
              <div
                className="mt-3 flex flex-wrap items-center gap-1"
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
                {revealedCount === 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Tap the highlighted card, or press{" "}
                    <kbd className="rounded border border-[var(--border)] px-1">
                      →
                    </kbd>
                    . The rarest card is always last.
                  </p>
                ) : (
                  <p className="truncate text-xs">
                    <span className="font-semibold">{lastRevealed?.name}</span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {lastRevealed ? TIER_LABELS[lastRevealed.tier] : ""}
                      {lastIsBest
                        ? " · best so far"
                        : bestSoFar
                          ? ` · best so far: ${bestSoFar.name}`
                          : ""}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-compact shrink-0 text-xs"
                onClick={advance}
              >
                {!packComplete ? (
                  <>
                    {revealedCount === cards.length - 1
                      ? "Reveal final card"
                      : "Reveal next"}
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
            Free and unlimited — no currency, no ads, no accounts.
          </span>
          <span>Simulated pulls have no real-world value.</span>
        </div>
      )}
    </section>
  );
}
