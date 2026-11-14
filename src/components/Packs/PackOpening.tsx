import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FastForward, RotateCcw, Sparkles, Volume2, VolumeX, Wind, Zap } from "lucide-react";
import type { PackConfig, PackPool, PackResult, WrapperStyle } from "../../types/packs";
import { TIER_LABELS, tierRank } from "../../data/packRules";
import { cryptoRng, generatePack, generatePacks, seededRng } from "../../services/packEngine";
import { closeAudio, playCue, setSoundEnabled } from "../../services/packSound";
import PackArt from "./PackArt";
import PackCard from "./PackCard";
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

const CHASE_TIERS = new Set(["doubleRare", "ultraRare", "illustrationRare", "specialIllustrationRare", "hyperRare", "secretRare", "aceSpec", "shinyUltraRare"]);

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
  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  useEffect(() => {
    // Reset whenever the requested product changes.
    completedRef.current = false;
    setPhase("sealed");
    setResults([]);
    setRevealedCount(0);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [pool.setId, config.id, quantity, seed]);

  useEffect(() => () => closeAudio(), []);

  const current = results[0] ?? null;
  const sealedLabel = quantity > 1 ? `Open ${quantity} packs` : "Open pack";

  const generate = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    if (quantity > 1) {
      const generated = generatePacks(
        { pool, config, setId: meta.setId, setName: meta.setName, seriesId: meta.seriesId },
        quantity
      );
      setResults(generated);
      onComplete(generated);
      return;
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
  }, [quantity, pool, config, meta, seed, onComplete]);

  const begin = useCallback(() => {
    if (phase !== "sealed") return;
    playCue("tear");
    setPhase("tearing");
    const delay = reduceMotion ? 0 : 720;
    timerRef.current = window.setTimeout(() => {
      generate();
      if (quantity > 1) {
        setPhase("summary");
        playCue("complete");
        return;
      }
      setPhase("revealing");
      setRevealedCount(reduceMotion ? 99 : 0);
    }, delay);
  }, [phase, reduceMotion, generate, quantity]);

  const revealNext = useCallback(() => {
    if (phase !== "revealing" || !current) return;
    setRevealedCount((count) => {
      const next = Math.min(current.cards.length, count + 1);
      const card = current.cards[next - 1];
      if (card) playCue(CHASE_TIERS.has(card.tier) ? "rare" : "flip");
      if (next === current.cards.length) {
        playCue("complete");
      }
      return next;
    });
  }, [phase, current]);

  const revealAll = useCallback(() => {
    if (!current) return;
    setRevealedCount(current.cards.length);
    if (current.cards.some((card) => CHASE_TIERS.has(card.tier))) playCue("rare");
    playCue("complete");
  }, [current]);

  useEffect(() => {
    if (phase !== "revealing" || !current) return;
    if (revealedCount >= current.cards.length) {
      const timer = window.setTimeout(() => setPhase("summary"), reduceMotion ? 0 : 550);
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
    return current.cards.slice(0, revealedCount).reduce<PackResult["cards"][number] | null>((best, card) => {
      if (!best) return card;
      return tierRank(card.tier) > tierRank(best.tier) ? card : best;
    }, null);
  }, [current, revealedCount]);

  if (phase === "summary" && results.length) {
    return <PullSummary results={results} onOpenAnother={onOpenAgain} onBack={onExit} />;
  }

  return (
    <section aria-labelledby="opening-heading" className="space-y-4">
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

      <div className="surface relative overflow-hidden p-4 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(240,68,82,0.16),transparent_65%)]"
        />

        {phase === "sealed" && (
          <div className="relative flex flex-col items-center gap-5">
            <button
              type="button"
              onClick={begin}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              className="group relative w-[190px] cursor-pointer rounded-[16px] transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-[220px]"
              aria-label={`Open this ${meta.setName} pack`}
            >
              <div className={cn("relative", !reduceMotion && "animate-pulse-soft")}>
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
                {quantity > 1 ? `Ready to open ${quantity} ${meta.setName} packs` : `Tap, click or swipe to tear open your ${meta.setName} pack`}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {config.cardsPerPack} cards · {config.era} · {config.confidence === "documented" ? "documented structure" : "estimated structure"}
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
        )}

        {phase === "tearing" && (
          <div className="relative flex min-h-[340px] flex-col items-center justify-center gap-4">
            <div
              className={cn("relative w-[190px] sm:w-[220px]", !reduceMotion && "animate-[pack-tear_0.7s_ease-in-out]")}
              style={{ transform: reduceMotion ? undefined : "rotate(2deg)" }}
            >
              <PackArt setName={meta.setName} seriesId={meta.seriesId} seriesName={meta.seriesName} logo={meta.logo} style={wrapperStyle} size="hero" opened />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r from-transparent via-white to-transparent blur-[1px]"
              />
            </div>
            <p className="text-sm font-semibold text-[var(--muted)]" role="status" aria-live="polite">
              Tearing the wrapper…
            </p>
          </div>
        )}

        {phase === "revealing" && current && (
          <div className="relative">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                Card {Math.min(revealedCount + 1, current.cards.length)} of {current.cards.length}
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost px-2.5 py-1.5 text-[11px]" onClick={revealAll}>
                  <FastForward size={13} aria-hidden="true" /> Reveal all
                </button>
              </div>
            </div>

            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="list" aria-label="Pack contents">
              {current.cards.map((card, index) => {
                const revealed = index < revealedCount;
                const isNext = index === revealedCount;
                return (
                  <div key={`${card.id}-${index}`} role="listitem" className="w-[118px] shrink-0 snap-start sm:w-[132px]">
                    <div className={cn("transition-transform duration-300", isNext && "translate-y-0", !revealed && !isNext && "opacity-70")}>
                      <PackCard
                        pull={card}
                        revealed={revealed}
                        onReveal={isNext ? revealNext : undefined}
                        motion={!reduceMotion}
                        priority={index < 3}
                        compact={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
              <div className="min-w-0">
                {revealedCount === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    Tap the face-down card to reveal it. The rarest card is always last.
                  </p>
                ) : revealedCount < current.cards.length ? (
                  <p className="truncate text-sm">
                    <span className="font-semibold">{bestSoFar?.name}</span>
                    <span className="text-[var(--muted)]"> · {bestSoFar ? TIER_LABELS[bestSoFar.tier] : ""} — best so far</span>
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Pack complete. Opening the summary…</p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={revealedCount < current.cards.length ? revealNext : () => setPhase("summary")}
              >
                {revealedCount < current.cards.length ? (
                  <>
                    Reveal {revealedCount === current.cards.length - 1 ? "final card" : "next card"}
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
