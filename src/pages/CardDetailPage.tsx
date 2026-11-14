import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Heart,
  Info,
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
  getCardValueGbp,
  getHeadlineEur,
  pickCardmarketQuote,
  pickTcgplayerQuote,
} from "../services/pricing";
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

function PriceRow({ label, gbp, eur }: { label: string; gbp: string | null; eur: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-1.5 last:border-0">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-bold tabular-nums text-[var(--text)]">
        {gbp ?? <NoData />}
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

  const quote = card ? pickCardmarketQuote(card.pricing) : null;
  const tcgQuote = card ? pickTcgplayerQuote(card.pricing) : null;
  const gbp = card ? getCardValueGbp(card, rate) : null;
  const headlineEur = quote ? getHeadlineEur(quote) : null;
  const converted = (eur: number | undefined) =>
    eur != null && rate ? formatGbp(eur * rate.rate) : null;
  const toEur = (value: number | undefined) => formatEur(value ?? null);

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
      ...(gbp != null && quote
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
  }, [card, gbp, quote]);

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
          <p className="text-[11px] font-black uppercase tracking-widest text-[var(--accent)]">
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
            className="mt-6 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#10b981]/10 to-transparent p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="price-heading" className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">
                  Cardmarket reference · GBP
                </h2>
                <p className="mt-1 text-3xl font-black tabular-nums text-[var(--text)]">
                  {formatGbp(gbp) ?? <NoData />}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {quote ? `${quote.label} · trend price` : "Cardmarket does not publish a price for this card"}
                  {headlineEur != null && rate ? ` · €${headlineEur.toFixed(2)} source` : ""}
                </p>
              </div>
              {quote && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/60 px-3 py-2 text-right text-[11px] text-[var(--muted)]">
                  <p>
                    Marketplace updated
                    <br />
                    <strong className="text-[var(--text)]">{formatUpdatedAtLong(quote.updatedAt) ?? "No Data Available"}</strong>
                  </p>
                  <p className="mt-1.5">
                    FX rate date
                    <br />
                    <strong className="text-[var(--text)]">{rate ? formatUpdatedAtLong(rate.date) ?? rate.date : "No Data Available"}</strong>
                  </p>
                </div>
              )}
            </div>

            {quote ? (
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <PriceRow label="Lowest listing" gbp={converted(quote.low)} eur={toEur(quote.low)} />
                <PriceRow label="Trend price" gbp={converted(quote.trend)} eur={toEur(quote.trend)} />
                <PriceRow label="Average (30 day)" gbp={converted(quote.average30)} eur={toEur(quote.average30)} />
                <PriceRow label="Average selling" gbp={converted(quote.average)} eur={toEur(quote.average)} />
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
                <ShieldAlert size={15} aria-hidden="true" />
                No Cardmarket price data is available for this card, so no value is estimated.
              </p>
            )}

            {!rate && (
              <p className="mt-3 text-xs text-[var(--accent-2)]">
                The EUR→GBP exchange rate is unavailable, so GBP values are hidden rather than estimated.
              </p>
            )}

            {tcgQuote && (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                  TCGplayer reference · USD
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--text)]">
                  {formatUsd(tcgQuote.market ?? tcgQuote.mid ?? tcgQuote.low) ?? <NoData />}
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  {tcgQuote.label} · updated {formatUpdatedAt(tcgQuote.updatedAt) ?? "No Data Available"} · shown in USD, not
                  converted.
                </p>
              </div>
            )}

            <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--muted)]">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              These are marketplace reference prices published by Cardmarket (asking/trend/average), converted with a
              dated daily exchange rate. They are not completed sales, live quotes, or financial advice.
            </p>
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
                    {attack.damage && <span className="text-lg font-bold text-[var(--accent)]">{attack.damage}</span>}
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
