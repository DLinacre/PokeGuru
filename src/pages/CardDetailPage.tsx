import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Heart,
  RefreshCw,
  Share2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useCard, useCardSearch, useExchangeRate } from "../hooks/useApi";
import { usePageMeta, siteOrigin } from "../hooks/usePageMeta";
import { useCollection } from "../hooks/useCollection";
import {
  formatEur,
  formatGbp,
  formatUpdatedAt,
  formatUpdatedAtLong,
  formatUsd,
  getCardPrice,
} from "../services/pricing";
import PriceConfidenceBadge from "../components/UI/PriceBadge";
import CardGrid from "../components/Cards/CardGrid";
import JsonLd from "../components/UI/JsonLd";
import ErrorMessage from "../components/UI/ErrorMessage";
import PageSkeleton from "../components/UI/PageSkeleton";
import { CachedBadge } from "../components/UI/DataBadges";
import { NoData } from "../components/UI/EmptyState";
import { rarityLabel } from "../utils/search";
import { getWikiMeta } from "../utils/setMeta";
import type { TcgCard } from "../types/pokemon";

function TypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
      {label}
    </span>
  );
}

const BASIS_LABELS: Record<NonNullable<ReturnType<typeof getCardPrice>>["basis"] & string, string> = {
  trend: "Cardmarket trend price",
  avg: "Cardmarket average asking price",
  low: "Lowest active listing",
  avg30: "Cardmarket 30-day average",
};

function PriceRow({
  label,
  hint,
  gbp,
  eur,
}: {
  label: string;
  hint?: string;
  gbp: string | null;
  eur: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-2 last:border-0">
      <span className="text-xs text-[var(--muted)]" title={hint}>
        {label}
      </span>
      <span className="text-right text-sm font-bold tabular-nums text-[var(--text)]">
        {gbp ?? <span className="text-xs font-medium italic text-[var(--muted)]">Not published</span>}
        {gbp && eur && <span className="ml-2 text-[10px] font-medium text-[var(--muted)]">{eur}</span>}
      </span>
    </div>
  );
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: card, loading, error, source, cachedAt, retry } = useCard(id);
  const { rate } = useExchangeRate();
  const { addToCollection, removeFromCollection, isInCollection } = useCollection();
  const [copied, setCopied] = useState(false);

  usePageMeta({
    title: card ? `${card.name} · ${card.set.name || "Pokémon card"}` : "Card details",
    description: card
      ? `${card.name} from ${card.set.name || "the Pokémon TCG"}${card.rarity ? ` (${rarityLabel(card.rarity)})` : ""} — Cardmarket reference price in GBP and full card details.`
      : "Pokémon TCG card details, attacks and Cardmarket reference prices.",
    path: id ? `/card/${id}` : "/search",
    type: "article",
    image: card?.images.large,
  });

  const related = useCardSearch({
    query: card?.name ?? "",
    category: "",
    rarity: "",
    setId: "",
    sort: "newest",
    page: 1,
    pageSize: 7,
  });

  const price = card ? getCardPrice(card, rate) : null;
  const gbp = price?.headlineGbp ?? null;
  const basisLabel = price?.basis ? BASIS_LABELS[price.basis] : null;

  const collected = card ? isInCollection(card.id) : false;
  const wikiMeta = card ? getWikiMeta(card.set.name) : undefined;

  const relatedCards = useMemo(
    () => related.cards.filter((item: TcgCard) => item.id !== card?.id).slice(0, 6),
    [related.cards, card?.id]
  );

  const productLd = useMemo(() => {
    if (!card) return null;
    const origin = siteOrigin();
    const url = `${origin}/card/${card.id}`;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${card.name}${card.set.name ? ` — ${card.set.name}` : ""}`,
      image: card.images.large || card.images.small,
      category: "Trading Card Game > Pokémon TCG",
      brand: { "@type": "Brand", name: "Pokémon TCG" },
      url,
      ...(card.rarity || card.illustrator
        ? {
            additionalProperty: [
              ...(card.rarity ? [{ "@type": "PropertyValue", name: "Rarity", value: rarityLabel(card.rarity) }] : []),
              ...(card.illustrator ? [{ "@type": "PropertyValue", name: "Illustrator", value: card.illustrator }] : []),
            ],
          }
        : {}),
      ...(gbp != null && price?.basis
        ? {
            offers: {
              "@type": "Offer",
              priceCurrency: "GBP",
              price: gbp.toFixed(2),
              url,
              description: "Cardmarket reference price converted to GBP — not a live quote.",
            },
          }
        : {}),
    };
  }, [card, gbp, price?.basis]);

  const handleShare = async () => {
    if (!card) return;
    const url = `${window.location.origin}${import.meta.env.BASE_URL}card/${card.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: card.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this card link:", url);
    }
  };

  if (loading) return <PageSkeleton title="Loading card details" cards={6} />;

  if (error || !card) {
    return (
      <ErrorMessage
        message={error ?? "This card could not be found."}
        onRetry={retry}
        hint="Check the card id or search for the card by name."
      />
    );
  }

  const cardmarketSearch = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(card.name)}`;

  return (
    <div>
      {productLd && <JsonLd id="product" data={productLd} />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/search"))}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <CachedBadge source={source} cachedAt={cachedAt} />
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--text)] active:scale-95"
          >
            {copied ? <Check size={16} className="text-[#10b981]" aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
            {copied ? "Link copied" : "Share"}
          </button>
          <button
            type="button"
            onClick={() => (collected ? removeFromCollection(card.id) : addToCollection(card))}
            aria-pressed={collected}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all active:scale-95 ${
              collected
                ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            }`}
          >
            <Heart size={16} fill={collected ? "currentColor" : "none"} aria-hidden="true" />
            {collected ? "In vault" : "Add to vault"}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(220px,340px)_1fr]">
        <div>
          <div className="sticky top-24">
            {card.images.large || card.images.small ? (
              <img
                src={card.images.large || card.images.small}
                alt={`${card.name}${card.set.name ? ` from ${card.set.name}` : ""} card`}
                width={600}
                height={825}
                fetchPriority="high"
                decoding="async"
                className="w-full rounded-2xl shadow-[var(--shadow)]"
              />
            ) : (
              <div className="flex aspect-[245/337] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
                Image unavailable
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
              <a
                href={cardmarketSearch}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Search on Cardmarket
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-[var(--accent-text)]">
            {card.set.name || "Set not listed"} {card.localId ? `· #${card.localId}` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{card.name}</h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <TypeBadge label={card.category === "Pokemon" ? "Pokémon" : card.category} />
            {card.stage && <TypeBadge label={card.stage} />}
            {card.types?.map((type) => <TypeBadge key={type} label={type} />)}
            {card.hp != null && <TypeBadge label={`${card.hp} HP`} />}
            {card.rarity && <TypeBadge label={rarityLabel(card.rarity)} />}
            {card.regulationMark && <TypeBadge label={`Regulation ${card.regulationMark}`} />}
          </div>

          {/* Market value */}
          <section
            aria-labelledby="price-heading"
            className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]"
          >
            <div className="border-b border-[var(--border)] bg-gradient-to-r from-[#2fbf71]/10 via-transparent to-transparent p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="price-heading" className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6fe3a5]">
                      Cardmarket reference · GBP
                    </h2>
                    {price && (
                      <PriceConfidenceBadge
                        confidence={price.confidence}
                        label={price.confidenceLabel}
                        reason={price.confidenceReason}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-[var(--text)]">
                    {formatGbp(price?.headlineGbp) ?? <NoData />}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                    {basisLabel ? `${basisLabel} · ${price?.printing}` : price ? "No Cardmarket value for this printing" : "Waiting for card data"}
                    {price?.headlineEur != null && rate ? ` · ${formatEur(price.headlineEur)} source` : ""}
                  </p>
                </div>

                {price && (
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 px-4 py-3 text-[11px] sm:grid-cols-1">
                    <div>
                      <dt className="text-[var(--muted)]">Marketplace updated</dt>
                      <dd className="font-semibold text-[var(--text)]">
                        {formatUpdatedAtLong(price.updatedAt) ?? "Not published"}
                        {price.ageDays != null && (
                          <span className="ml-1 font-normal text-[var(--muted)]">({price.ageDays === 0 ? "today" : `${price.ageDays}d ago`})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">FX rate date</dt>
                      <dd className="font-semibold text-[var(--text)]">
                        {rate ? formatUpdatedAtLong(rate.date) ?? rate.date : "Not available"}
                      </dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-[var(--muted)]">Matched to</dt>
                      <dd className="font-semibold text-[var(--text)]">
                        {card.id} · {price.printing}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[1.35fr_1fr]">
              <div>
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                  Published Cardmarket bands
                </h3>
                {price?.bands.length ? (
                  <div>
                    {price.bands.map((band) => (
                      <PriceRow
                        key={band.key}
                        label={band.label}
                        hint={band.hint}
                        gbp={formatGbp(band.gbp)}
                        eur={formatEur(band.eur)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-2 py-3 text-sm text-[var(--muted)]">
                    <ShieldAlert size={15} aria-hidden="true" />
                    Cardmarket does not publish a price for this card, so no value is estimated.
                  </p>
                )}

                {price?.alternate && (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                      {price.alternate.label} printing (not this card&apos;s printing)
                    </p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-[var(--text)]">
                      {formatGbp(price.alternate.gbp) ?? <NoData />}
                      {price.alternate.trend != null && (
                        <span className="ml-2 text-[10px] font-medium text-[var(--muted)]">
                          trend {formatEur(price.alternate.trend)}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {price?.flags.length ? (
                  <ul className="space-y-2 rounded-xl border border-[var(--accent-2)]/30 bg-[var(--accent-2)]/5 p-3 text-[11px] leading-relaxed text-[#f7c568]">
                    {price.flags.includes("stale") && <li>This snapshot is more than 30 days old — treat it as historical.</li>}
                    {price.flags.includes("dated") && <li>This snapshot is over a week old; prices can move week to week.</li>}
                    {price.flags.includes("low-only") && <li>Only a lowest listing / long-run average exists, so this is indicative.</li>}
                    {price.flags.includes("no-update-date") && <li>Cardmarket did not publish an update date for this price.</li>}
                    {price.flags.includes("fx-missing") && (
                      <li>The EUR→GBP exchange rate is unavailable, so GBP values are hidden rather than estimated.</li>
                    )}
                  </ul>
                ) : null}

                {price?.tcgplayer && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                      TCGplayer reference · USD
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[var(--text)]">
                      {formatUsd(price.tcgplayer.market ?? price.tcgplayer.mid ?? price.tcgplayer.low) ?? <NoData />}
                    </p>
                    <p className="text-[11px] leading-relaxed text-[var(--muted)]">
                      {price.tcgplayer.label} · updated {formatUpdatedAt(price.tcgplayer.updatedAt) ?? "No Data Available"} ·
                      shown in USD, never silently converted.
                    </p>
                  </div>
                )}

                <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)]/40 p-3 text-[11px] leading-relaxed text-[var(--muted)]">
                  <summary className="cursor-pointer font-semibold text-[var(--text)]">How this price is calculated</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-4">
                    <li>We match this exact card id and printing at Cardmarket via TCGdex ({card.id}, {price?.printing ?? "unknown printing"}).</li>
                    <li>We take a single published band — trend, then average asking, then 30-day average, then lowest listing — never an average of unrelated values.</li>
                    <li>EUR is converted with the dated Frankfurter reference rate{rate ? ` (${rate.date})` : ""}; without a rate we show no GBP figure.</li>
                    <li>Figures are marketplace reference prices, not completed sales, live quotes, graded valuations or financial advice.</li>
                  </ol>
                </details>
              </div>
            </div>
          </section>

          {/* Rules text */}
          {card.abilities && card.abilities.length > 0 && (
            <section aria-labelledby="abilities" className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 id="abilities" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--accent-2)]">
                <Sparkles size={14} aria-hidden="true" /> Abilities
              </h2>
              {card.abilities.map((ability) => (
                <div key={ability.name} className="mb-3 last:mb-0">
                  <p className="font-semibold text-[var(--text)]">{ability.name}</p>
                  {ability.effect && <p className="text-sm leading-relaxed text-[var(--muted)]">{ability.effect}</p>}
                </div>
              ))}
            </section>
          )}

          {card.attacks && card.attacks.length > 0 && (
            <section aria-labelledby="attacks" className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 id="attacks" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[var(--accent-2)]">
                <RefreshCw size={14} aria-hidden="true" /> Attacks
              </h2>
              {card.attacks.map((attack) => (
                <div key={attack.name} className="border-t border-[var(--border)] py-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">{attack.name}</span>
                    {attack.damage && <span className="text-lg font-bold text-[var(--accent-text)]">{attack.damage}</span>}
                  </div>
                  {attack.cost && attack.cost.length > 0 && (
                    <p className="text-xs text-[var(--muted)]">Cost: {attack.cost.join(", ")}</p>
                  )}
                  {attack.effect && <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{attack.effect}</p>}
                </div>
              ))}
            </section>
          )}

          {card.rules && card.rules.length > 0 && (
            <section aria-labelledby="rules" className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 id="rules" className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--accent-2)]">
                Card text
              </h2>
              {card.rules.map((rule, index) => (
                <p key={index} className="mb-2 text-sm leading-relaxed text-[var(--muted)] last:mb-0">
                  {rule}
                </p>
              ))}
            </section>
          )}

          {(card.weaknesses?.length || card.resistances?.length || card.retreat != null) && (
            <section className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:grid-cols-3">
              <div>
                <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Weakness</h2>
                <p className="text-sm text-[var(--text)]">
                  {card.weaknesses?.map((weakness) => `${weakness.type}${weakness.value ? ` ${weakness.value}` : ""}`).join(", ") || <NoData />}
                </p>
              </div>
              <div>
                <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Resistance</h2>
                <p className="text-sm text-[var(--text)]">
                  {card.resistances?.map((resistance) => `${resistance.type}${resistance.value ? ` ${resistance.value}` : ""}`).join(", ") || <NoData />}
                </p>
              </div>
              <div>
                <h2 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Retreat cost</h2>
                <p className="text-sm text-[var(--text)]">{card.retreat != null ? `${card.retreat} energy` : <NoData />}</p>
              </div>
            </section>
          )}

          {/* Metadata */}
          <section aria-labelledby="meta-heading" className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 id="meta-heading" className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--accent-2)]">
              Card details
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Number</dt>
                <dd className="text-[var(--text)]">{card.localId || <NoData />}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Illustrator</dt>
                <dd className="text-[var(--text)]">{card.illustrator || <NoData />}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Rarity</dt>
                <dd className="text-[var(--text)]">{rarityLabel(card.rarity) || <NoData />}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Standard legal</dt>
                <dd className="text-[var(--text)]">
                  {card.legal?.standard == null ? <NoData /> : card.legal.standard ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Expanded legal</dt>
                <dd className="text-[var(--text)]">
                  {card.legal?.expanded == null ? <NoData /> : card.legal.expanded ? "Yes" : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Data updated</dt>
                <dd className="text-[var(--text)]">{formatUpdatedAt(card.updatedAt) ?? <NoData />}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <Link to={`/set/${card.set.id}`} className="flex items-center gap-3 no-underline hover:no-underline">
                <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg)]/60 text-[var(--muted)]">
                  {card.set.name ? card.set.name.slice(0, 2).toUpperCase() : "?"}
                </span>
                <span>
                  <span className="block font-semibold text-[var(--text)]">{card.set.name || "Set not listed"}</span>
                  {(wikiMeta?.eraName || card.set.series || card.set.releaseDate) && (
                    <span className="block text-xs text-[var(--muted)]">
                      {wikiMeta?.eraName ?? card.set.series}
                      {wikiMeta?.releaseDate || card.set.releaseDate
                        ? ` · released ${new Date((wikiMeta?.releaseDate ?? card.set.releaseDate)!).toLocaleDateString("en-GB")}`
                        : ""}
                    </span>
                  )}
                </span>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {relatedCards.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-14 border-t border-[var(--border)] pt-8">
          <h2 id="related-heading" className="mb-5 text-xl font-bold">
            More {card.name} cards
          </h2>
          <CardGrid cards={relatedCards} rate={rate} priorityCount={0} />
        </section>
      )}
    </div>
  );
}
