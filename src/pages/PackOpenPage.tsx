import { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Layers,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { usePackPool } from "../hooks/usePacks";
import { computePackOdds } from "../services/packEngine";
import { recordPacks, useSim } from "../services/simStore";
import { seriesIdFromName, TIER_LABELS } from "../data/packRules";
import PackArt from "../components/Packs/PackArt";
import PackOpening from "../components/Packs/PackOpening";
import OddsPanel from "../components/Packs/OddsPanel";
import ErrorMessage from "../components/UI/ErrorMessage";
import { cn } from "../utils/cn";

const MAX_PACKS = 36;

function clampCount(raw: string | null): number {
  const value = Number(raw ?? "1");
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(MAX_PACKS, Math.floor(value));
}

function formatDate(iso?: string): string {
  if (!iso) return "Release date not published";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Release date not published";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function PackOpenPage() {
  const { setId } = useParams<{ setId: string }>();
  const [searchParams] = useSearchParams();
  const { set, config, pool, loading, error, progress, retry } = usePackPool(setId);
  const { state, setSettings } = useSim();

  const [quantity, setQuantity] = useState(() => clampCount(searchParams.get("count")));
  const [customCount, setCustomCount] = useState(String(clampCount(searchParams.get("count"))));
  const [session, setSession] = useState(0);
  const [started, setStarted] = useState(false);
  const recordedRef = useRef(0);
  const seed = searchParams.get("seed") ?? undefined;

  usePageMeta({
    title: set ? `${set.name} pack` : "Pack simulator",
    description: set
      ? `Open a simulated ${set.name} booster pack generated from the real card pool of this expansion.`
      : "Simulated Pokémon TCG booster packs.",
    path: setId ? `/packs/${setId}` : "/packs",
  });

  const odds = useMemo(() => (pool && config ? computePackOdds(pool, config) : null), [pool, config]);

  const begin = (count: number) => {
    const next = Math.max(1, Math.min(MAX_PACKS, Math.floor(count)));
    setQuantity(next);
    setCustomCount(String(next));
    setSession((value) => value + 1);
    setStarted(true);
  };

  const handleComplete = (results: Parameters<typeof recordPacks>[0]) => {
    if (recordedRef.current === session) return;
    recordedRef.current = session;
    recordPacks(results);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <div className="surface p-8 text-center">
          <RefreshCw size={26} className="mx-auto animate-spin text-[var(--accent)]" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold">Preparing {set ? `${set.name} packs` : "your pack"}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Building the card pool from the real expansion data — every rarity has to be fetched before a pack can be generated honestly.
          </p>
          {progress && (
            <>
              <div className="mx-auto mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[var(--bg-inset)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] tabular-nums text-[var(--muted-dim)]">
                {progress.done} / {progress.total} pool queries
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error || !set || !config || !pool) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Link to="/packs" className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline">
          <ArrowLeft size={12} aria-hidden="true" /> All packs
        </Link>
        <ErrorMessage message={error ?? "This pack is not available."} onRetry={retry} hint="No cards are generated when the data is missing." />
      </div>
    );
  }

  const meta = {
    setId: set.id,
    setName: set.name,
    seriesId: seriesIdFromName(set.series) ?? config.seriesIds[0] ?? "",
    seriesName: set.series,
    logo: set.images?.logo,
    releaseDate: set.releaseDate,
    cardCount: set.cardCount?.official ?? set.cardCount?.total,
  };

  if (started) {
    return (
      <div className="mx-auto max-w-4xl">
        <PackOpening
          key={`${session}-${quantity}`}
          pool={pool}
          config={config}
          meta={meta}
          quantity={quantity}
          seed={seed}
          wrapperStyle={state.settings.wrapperStyle}
          sound={state.settings.sound}
          reduceMotion={state.settings.reduceMotion}
          onToggleSound={() => setSettings({ sound: !state.settings.sound })}
          onToggleMotion={() => setSettings({ reduceMotion: !state.settings.reduceMotion })}
          onComplete={handleComplete}
          onExit={() => setStarted(false)}
          onOpenAgain={(count) => begin(count)}
        />
      </div>
    );
  }

  const boxPacks = config.boxPacks;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/packs" className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--link)] no-underline">
        <ArrowLeft size={12} aria-hidden="true" /> All packs
      </Link>

      {seed && (
        <div className="mb-4 rounded-xl border border-[var(--link)]/30 bg-[var(--link)]/10 p-3 text-xs text-[var(--link)]">
          Replaying seed <code className="font-mono">{seed}</code>. The same seed reproduces the same pulls while this set&apos;s card pool is
          unchanged.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
        <div>
          <div className="mx-auto w-full max-w-[220px]">
            <PackArt
              setName={set.name}
              seriesId={meta.seriesId}
              seriesName={set.series}
              logo={set.images?.logo}
              style={state.settings.wrapperStyle}
              size="hero"
              year={set.releaseDate ? new Date(set.releaseDate).getUTCFullYear().toString() : undefined}
            />
          </div>
          <div className="mt-2">
            <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">Wrapper design</p>
            <div className="mt-1.5 flex justify-center gap-1.5" role="group" aria-label="Wrapper design">
              {(
                [
                  { id: "crimson", label: "Crimson" },
                  { id: "prism", label: "Prism" },
                  { id: "vintage", label: "Vintage" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSettings({ wrapperStyle: option.id })}
                  aria-pressed={state.settings.wrapperStyle === option.id}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors",
                    state.settings.wrapperStyle === option.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-text)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-[var(--muted-dim)]">
            PokeGuru wrapper illustration.
            <br />
            Not an official product image.
          </p>
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-text)]">
            <Sparkles size={12} aria-hidden="true" /> {config.era}
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight">{set.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <Layers size={12} aria-hidden="true" /> {set.series}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} aria-hidden="true" /> {formatDate(set.releaseDate)}
            </span>
            {meta.cardCount ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{meta.cardCount} cards in set</span>
              </>
            ) : null}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <span
              className={cn(
                "chip",
                config.confidence === "documented"
                  ? "border-[var(--success)]/40 bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[var(--accent-2)]/40 bg-[var(--warning-soft)] text-[var(--accent-2)]"
              )}
            >
              {config.confidence === "documented" ? <ShieldCheck size={11} aria-hidden="true" /> : <TriangleAlert size={11} aria-hidden="true" />}
              {config.confidence === "documented" ? "Documented pack structure" : "Estimated pack structure"}
            </span>
            <span className="chip">{config.cardsPerPack} cards</span>
            <span className="chip">{config.label}</span>
            {boxPacks ? <span className="chip">Box: {boxPacks} packs</span> : null}
          </div>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/50 p-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">What&apos;s inside</h2>
            <ul className="mt-2 grid gap-1 text-xs text-[var(--text-soft)] sm:grid-cols-2">
              {(odds?.slotSummary ?? []).map((slot) => (
                <li key={slot.slot} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-[var(--bg-card)] px-1 text-[10px] font-black tabular-nums">
                    {slot.count}
                  </span>
                  <span className="min-w-0">
                    {slot.label}
                    {slot.tiers.length > 0 && (
                      <span className="block text-[10px] leading-tight text-[var(--muted)]">{slot.tiers.join(" · ")}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              {config.source.note}
            </p>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-dim)]">How many packs?</p>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuantity(count)}
                  className={cn(
                    "btn px-3.5 py-2 text-sm",
                    quantity === count ? "btn-primary" : "btn-secondary"
                  )}
                  aria-pressed={quantity === count}
                >
                  {count === 1 ? "1 pack" : `${count} packs`}
                </button>
              ))}
              {boxPacks ? (
                <button
                  type="button"
                  onClick={() => setQuantity(boxPacks)}
                  className={cn("btn px-3.5 py-2 text-sm", quantity === boxPacks ? "btn-primary" : "btn-secondary")}
                  aria-pressed={quantity === boxPacks}
                >
                  <PackageOpen size={14} aria-hidden="true" /> Full box ({boxPacks})
                </button>
              ) : null}
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span className="sr-only">Custom pack quantity</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_PACKS}
                  value={customCount}
                  onChange={(event) => {
                    setCustomCount(event.target.value);
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed) && parsed >= 1) setQuantity(Math.min(MAX_PACKS, Math.floor(parsed)));
                  }}
                  className="field w-20 px-2 py-1.5 text-xs"
                  aria-label="Custom pack quantity"
                />
                packs
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary px-6" onClick={() => begin(quantity)}>
                {quantity > 1 ? `Open ${quantity} packs` : "Open pack"}
              </button>
              <Link to="/packs/collection" className="btn btn-ghost no-underline hover:no-underline">
                <Wallet size={14} aria-hidden="true" />
                Simulated collection
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Unlimited and free. No currency, no ads, no account, no purchase.
            </p>
          </div>
        </div>
      </div>

      {odds && (
        <div className="mt-8">
          <OddsPanel odds={odds} />
        </div>
      )}

      <div className="mt-6 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 p-4 text-[11px] leading-relaxed text-[var(--muted)]">
        <p>
          <strong className="text-[var(--text-soft)]">Pool coverage:</strong> {pool.examined.toLocaleString()} cards examined,{" "}
          {Object.values(pool.tiers).reduce((sum, cards) => sum + (cards?.length ?? 0), 0).toLocaleString()} placed in a rarity pool
          {pool.unmapped > 0 ? `, ${pool.unmapped.toLocaleString()} left out because the database does not publish a usable rarity for them` : ""}.
          Cards are only ever drawn from {set.name}
          {pool.sourceSets.length > 1 ? ` and its ${pool.sourceSets.length - 1} companion subset${pool.sourceSets.length > 2 ? "s" : ""}` : ""}.
        </p>
        {pool.unmapped > 0 && (
          <p className="text-[var(--muted-dim)]">
            Unmapped cards are excluded rather than guessed, so a pack can never contain a card whose rarity we do not know.
          </p>
        )}
        <p className="text-[var(--muted-dim)]">
          Rarity tiers used here: {Object.keys(pool.tiers).filter((tier) => (pool.tiers as Record<string, unknown[]>)[tier]?.length).map((tier) => TIER_LABELS[tier as keyof typeof TIER_LABELS]).join(" · ")}
        </p>
      </div>
    </div>
  );
}
