import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FastForward, RotateCcw, Sparkles, Volume2, VolumeX, Wind, Zap } from "lucide-react";
import type { PackConfig, PackPool, PackResult, PulledCard, WrapperStyle } from "../../types/packs";
import { TIER_LABELS, tierRank } from "../../data/packRules";
import { cryptoRng, generatePack, generatePacks, seededRng } from "../../services/packEngine";
import { closeAudio, playCue, setSoundEnabled } from "../../services/packSound";
import PackArt from "./PackArt";
import PackCard from "./PackCard";
import PullSummary from "./PullSummary";
import { Confetti, RareFlare, RevealProgress, StageBackdrop, TearEmbers } from "./PackStageEffects";
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

const CHASE_TIERS = new Set([
  "doubleRare",
  "ultraRare",
  "illustrationRare",
  "specialIllustrationRare",
  "hyperRare",
  "secretRare",
  "aceSpec",
  "shinyUltraRare",
]);

/** How long the wrapper takes to tear open before the cards appear. */
const TEAR_MS = 1200;
/** Suspense before a card turns over: chase pulls take a beat longer. */
const HOLD_STANDARD_MS = 170;
const HOLD_CHASE_MS = 480;
/** How long the finished pack is celebrated before the summary. */
const FINALE_MS = 1500;

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
  const [revealedCount, setRevealedCount] = useState(0);
  const [pending, setPending] = useState(false);
  const timerRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const motion = !reduceMotion;

  const clearTimers = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (holdRef.current) window.clearTimeout(holdRef.current);
    timerRef.current = null;
    holdRef.current = null;
  }, []);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  useEffect(() => {
    // Reset whenever the requested product changes.
    completedRef.current = false;
    setPhase("sealed");
    setResults([]);
    setRevealedCount(0);
    setPending(false);
    clearTimers();
    return clearTimers;
  }, [pool.setId, config.id, quantity, seed, clearTimers]);

  useEffect(() => () => closeAudio(), []);

  const current = results[0] ?? null;
  const cardCount = current?.cards.length ?? 0;
  const sealedLabel = quantity > 1 ? `Open ${quantity} packs` : "Open pack";

  const generate = useCallback(() => {
    if (completedRef.current) return null;
    completedRef.current = true;

    if (quantity > 1) {
      const generated = generatePacks(
        { pool, config, setId: meta.setId, setName: meta.setName, seriesId: meta.seriesId },
        quantity
      );
      setResults(generated);
      onComplete(generated);
      return generated;
    }

    const rng = seed ? seededRng(`${seed}:${meta.setId}:${config.id}`) : cryptoRng();
    const pack = generatePack({
      pool,
      config,
      setId: meta.setId,
      setName: meta.setName,
      seriesId: meta.seriesId,
      seed: seed ?? undefined,
      rng,
    });
    setResults([pack]);
    onComplete([pack]);
    return [pack];
  }, [quantity, pool, config, meta, seed, onComplete]);

  /** Leave the wrapper behind and set up the reveal. */
  const burstOpen = useCallback(() => {
    clearTimers();
    const generated = generate();
    if (quantity > 1) {
      setPhase("summary");
      playCue("complete");
      return;
    }
    playCue("reveal");
    setPhase("revealing");
    setRevealedCount(reduceMotion ? 99 : 0);
    // reduce-motion users get the summary immediately — no waiting, no theatre.
    if (reduceMotion && generated?.[0]) setPhase("summary");
  }, [clearTimers, generate, quantity, reduceMotion]);

  const begin = useCallback(() => {
    if (phase !== "sealed") return;
    playCue("tear");
    setPhase("tearing");
    timerRef.current = window.setTimeout(burstOpen, reduceMotion ? 0 : TEAR_MS);
  }, [phase, reduceMotion, burstOpen]);

  const skipTear = useCallback(() => {
    if (phase !== "tearing") return;
    burstOpen();
  }, [phase, burstOpen]);

  const commitReveal = useCallback(
    (index: number) => {
      const card = current?.cards[index];
      setRevealedCount(index + 1);
      setPending(false);
      if (!card) return;
      playCue(CHASE_TIERS.has(card.tier) ? "rare" : "flip");
      if (index + 1 === (current?.cards.length ?? 0)) playCue("complete");
    },
    [current]
  );

  const revealNext = useCallback(() => {
    if (phase !== "revealing" || !current || pending) return;
    const index = revealedCount;
    const card = current.cards[index];
    if (!card) return;

    if (!motion) {
      commitReveal(index);
      return;
    }

    const chase = CHASE_TIERS.has(card.tier);
    playCue("flip");
    setPending(true);
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => commitReveal(index), chase ? HOLD_CHASE_MS : HOLD_STANDARD_MS);
  }, [phase, current, pending, revealedCount, motion, commitReveal]);

  const revealAll = useCallback(() => {
    if (!current) return;
    clearTimers();
    setPending(false);
    setRevealedCount(current.cards.length);
    if (current.cards.some((card) => CHASE_TIERS.has(card.tier))) playCue("rare");
    playCue("complete");
  }, [current, clearTimers]);

  useEffect(() => {
    if (phase !== "revealing" || !current) return;
    if (revealedCount >= current.cards.length) {
      const delay = reduceMotion ? 0 : revealedCount > 0 ? FINALE_MS : 0;
      const timer = window.setTimeout(() => setPhase("summary"), delay);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, revealedCount, current, reduceMotion]);

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > 36) begin();
  };

  const bestSoFar = useMemo(() => {
    if (!current) return null;
    return current.cards.slice(0, revealedCount).reduce<PulledCard | null>((best, card) => {
      if (!best) return card;
      return tierRank(card.tier) > tierRank(best.tier) ? card : best;
    }, null);
  }, [current, revealedCount]);

  const stageIndex = revealedCount === 0 ? 0 : Math.min(revealedCount, Math.max(cardCount, 1)) - 1;
  const stageCard = current?.cards[stageIndex] ?? null;
  const stageRevealed = revealedCount > stageIndex;
  const justRevealed = revealedCount > 0 ? current?.cards[revealedCount - 1] ?? null : null;
  const justRevealedIsChase = justRevealed ? CHASE_TIERS.has(justRevealed.tier) : false;
  const finished = cardCount > 0 && revealedCount >= cardCount;
  const remaining = Math.max(0, cardCount - revealedCount);

  if (phase === "summary" && results.length) {
    return <PullSummary results={results} onOpenAnother={onOpenAgain} onBack={onExit} />;
  }

  return (
    <section aria-labelledby="opening-heading" className="space-y-4" data-phase={phase}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">Pack simulator</p>
          <h2 id="opening-heading" className="mt-0.5 text-xl font-bold tracking-tight">
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
            {sound ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
            <span className="hidden sm:inline">{sound ? "Sound on" : "Muted"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleMotion}
            className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
            aria-pressed={reduceMotion}
            title={reduceMotion ? "Enable animations" : "Reduce animation"}
          >
            <Wind size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{reduceMotion ? "Motion reduced" : "Full motion"}</span>
          </button>
        </div>
      </div>

      <div className="surface relative overflow-hidden p-3 sm:p-5">
        {phase === "sealed" && (
          <div className="relative isolate overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,#12151d,#0a0c11)] px-4 py-8 sm:py-10">
            <StageBackdrop motion={motion} seed={`${meta.setId}-sealed`} />

            <div className="relative flex flex-col items-center gap-6">
              <div className="relative">
                {/* Warm halo behind the pack */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(240,68,82,0.42),rgba(240,68,82,0)_70%)] blur-2xl",
                    motion && "animate-pack-halo"
                  )}
                />
                <button
                  type="button"
                  onClick={begin}
                  onPointerDown={onPointerDown}
                  onPointerUp={onPointerUp}
                  className="group relative w-[190px] cursor-pointer rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-[220px]"
                  aria-label={`Open this ${meta.setName} pack`}
                >
                  <div
                    className={cn(
                      "relative transition-transform duration-300 group-hover:-translate-y-1.5",
                      motion && "animate-pack-float"
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
                    {/* Shine sweeping over the foil */}
                    {motion && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"
                      >
                        <span
                          className="absolute -inset-y-6 left-0 w-1/3 bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.34),transparent)] blur-[2px]"
                          style={{ animation: "shimmer 3.6s ease-in-out 0.8s infinite" }}
                        />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-6 mx-auto flex w-max items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/90 backdrop-blur">
                      <Zap size={10} aria-hidden="true" /> Tap to open
                    </span>
                  </div>
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold">
                  {quantity > 1
                    ? `Ready to open ${quantity} ${meta.setName} packs`
                    : `Tap, click or swipe to tear open your ${meta.setName} pack`}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {config.cardsPerPack} cards · {config.era} ·{" "}
                  {config.confidence === "documented" ? "documented structure" : "estimated structure"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--muted-dim)]">
                  The rare card always sits at the back — stay to the end.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={begin}>
                    {sealedLabel}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={onExit}>
                    Choose another pack
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "tearing" && (
          <div className="relative isolate flex min-h-[380px] flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,#101319,#07080c)] px-4 py-10">
            <StageBackdrop motion={motion} seed={`${meta.setId}-tear`} />
            <TearEmbers motion={motion} />

            <div className="relative">
              <div
                className={cn(
                  "relative w-[190px] sm:w-[220px]",
                  motion && "animate-[pack-tear_1.1s_ease-in-out_both]"
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
                {/* The rip: a bright seam that opens across the wrapper */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-[-6%] top-1/2 h-[3px] origin-center -translate-y-1/2 bg-[linear-gradient(90deg,transparent,#fff,#ffd166,#fff,transparent)] shadow-[0_0_18px_6px_rgba(255,214,102,0.55)]",
                    motion && "animate-tear-seam"
                  )}
                  style={{ transform: "translateY(-50%)" }}
                />
                {motion && (
                  <span
                    aria-hidden="true"
                    className="animate-tear-flash pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fff_0%,rgba(255,224,150,0.7)_35%,rgba(255,224,150,0)_70%)]"
                  />
                )}
              </div>
            </div>

            <div className="relative text-center">
              <p className="text-sm font-semibold text-[var(--text)]" role="status" aria-live="polite">
                Tearing the wrapper…
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {config.cardsPerPack} cards inside · {config.era}
              </p>
              <button type="button" className="btn btn-ghost mt-3 text-[11px]" onClick={skipTear}>
                Skip the theatre <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {phase === "revealing" && current && stageCard && (
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                Card {Math.min(revealedCount + 1, cardCount)} of {cardCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost px-2.5 py-1.5 text-[11px]"
                  onClick={revealAll}
                  disabled={revealedCount >= cardCount}
                >
                  <FastForward size={14} aria-hidden="true" /> Reveal all
                </button>
                <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => setPhase("summary")}>
                  Skip to summary
                </button>
              </div>
            </div>

            <RevealProgress
              className="mb-4"
              revealed={revealedCount}
              tiers={current.cards.map((card) => ({ tier: card.tier, chase: CHASE_TIERS.has(card.tier) }))}
            />

            {/* ---------------- The stage ---------------- */}
            <div
              className={cn(
                "relative isolate flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,#101319,#07080c)] px-4 py-7 sm:min-h-[420px]",
                !pending && justRevealedIsChase && motion && "animate-stage-shake"
              )}
            >
              <StageBackdrop motion={motion} seed={`${meta.setId}-stage-${stageIndex}`} />

              {motion && justRevealedIsChase && <RareFlare key={`flare-${revealedCount}`} />}
              {motion && (justRevealedIsChase || finished) && (
                <Confetti
                  key={`confetti-${revealedCount}`}
                  seed={`${current.setId}-${revealedCount}-${justRevealed?.id ?? "end"}`}
                  count={finished ? 40 : 26}
                  intense
                />
              )}

              {/* Fanned stack of cards still to come, behind the stage card. */}
              {!finished && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
                  <div className="relative mx-auto h-0 w-[188px] sm:w-[220px]">
                    {[3, 2, 1].map((offset) => (
                      <div
                        key={offset}
                        className="absolute left-1/2 top-1/2 h-[150px] w-[108px] -translate-x-1/2 -translate-y-1/2 rounded-[10px] border border-white/10 bg-[linear-gradient(160deg,rgba(240,68,82,0.16),rgba(12,14,20,0.9))] sm:h-[176px] sm:w-[126px]"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${(offset - 2) * 9}deg) translateY(${offset * 4}px)`,
                          opacity: 1 - offset * 0.22,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="relative w-[196px] sm:w-[244px]">
                  {/* Aura under the card: gold for chase pulls, cool otherwise. */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute -inset-6 rounded-[28px] blur-2xl",
                      stageRevealed && CHASE_TIERS.has(stageCard.tier)
                        ? "bg-[radial-gradient(circle,rgba(245,165,36,0.55),rgba(245,165,36,0)_70%)]"
                        : "bg-[radial-gradient(circle,rgba(124,196,255,0.28),rgba(124,196,255,0)_70%)]"
                    )}
                  />
                  <div className={cn("relative", pending && motion && "animate-pulse-soft")}>
                    <PackCard
                      pull={stageCard}
                      revealed={stageRevealed}
                      onReveal={stageRevealed || pending ? undefined : revealNext}
                      motion={motion}
                      priority
                    />
                  </div>
                </div>
              </div>

              <p className="sr-only" role="status" aria-live="polite">
                {pending
                  ? `Turning over card ${revealedCount + 1} of ${cardCount}`
                  : justRevealed
                    ? `Card ${revealedCount} of ${cardCount}: ${justRevealed.name}, ${TIER_LABELS[justRevealed.tier]}`
                    : `${cardCount} cards to reveal`}
              </p>

              {finished ? (
                <div className="relative mt-4 flex flex-col items-center gap-1 text-center">
                  <p className="flex items-center gap-1.5 text-sm font-black uppercase tracking-[0.16em] text-[var(--accent-2)]">
                    <Sparkles size={14} aria-hidden="true" /> Pack complete
                  </p>
                  <p className="text-xs text-[var(--muted)]">Opening the summary…</p>
                </div>
              ) : (
                <p className="relative mt-4 text-center text-[11px] text-[var(--muted-dim)]">
                  {stageRevealed ? `${remaining} card${remaining === 1 ? "" : "s"} still sealed` : "Tap the card to turn it over"}
                </p>
              )}
            </div>

            {/* ---------------- Revealed so far ---------------- */}
            {revealedCount > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Revealed</p>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="list" aria-label="Revealed cards">
                  {current.cards.slice(0, revealedCount).map((card, index) => (
                    <div key={`${card.id}-${index}`} role="listitem" className="w-[74px] shrink-0 snap-start sm:w-[84px]">
                      <PackCard pull={card} revealed motion={motion} compact priority={index < 3} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
              <div className="min-w-0">
                {revealedCount === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    Tap the face-down card to reveal it. The rarest card is always last.
                  </p>
                ) : revealedCount < cardCount ? (
                  <p className="truncate text-sm">
                    <span className="font-semibold">{bestSoFar?.name}</span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {bestSoFar ? TIER_LABELS[bestSoFar.tier] : ""} — best so far
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Pack complete. Opening the summary…</p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={revealedCount < cardCount ? revealNext : () => setPhase("summary")}
              >
                {revealedCount < cardCount ? (
                  <>
                    {pending ? "Turning…" : `Reveal ${revealedCount === cardCount - 1 ? "final card" : "next card"}`}
                    <ChevronRight size={15} aria-hidden="true" />
                  </>
                ) : (
                  <>
                    See summary <Sparkles size={15} aria-hidden="true" />
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
