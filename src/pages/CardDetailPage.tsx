import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp, Heart, Box, Share2, Check } from 'lucide-react';
import { useCard, useCardSearch } from '../hooks/useApi';
import { useTitle } from '../hooks/useTitle';
import { getAllSets } from '../data/ukSets';
import { useCollection } from '../hooks/useCollection';
import { getCardValueGBP, formatGBP, formatGBPFromUSD } from '../utils/pricing';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import ErrorMessage from '../components/UI/ErrorMessage';
import CardGrid from '../components/Cards/CardGrid';
import JsonLd from '../components/UI/JsonLd';
import type { PokemonCard, TCGPlayerPrice } from '../types/pokemon';

function getBestPrice(card: PokemonCard): { label: string; price: TCGPlayerPrice } | null {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;

  // Try to find the best available price type
  const priceTypes: { key: keyof typeof prices; label: string }[] = [
    { key: 'holofoil', label: 'Holofoil' },
    { key: 'reverseHolofoil', label: 'Reverse Holo' },
    { key: 'normal', label: 'Normal' },
    { key: '1stEditionHolofoil', label: '1st Edition Holo' },
    { key: '1stEditionNormal', label: '1st Edition' },
  ];

  for (const { key, label } of priceTypes) {
    const priceData = prices[key];
    if (priceData && (priceData.market || priceData.mid)) {
      return { label, price: priceData };
    }
  }

  return null;
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const { data: card, loading, error } = useCard(id || '', retryCount);
  const { addToCollection, removeFromCollection, isInCollection } = useCollection();
  useTitle(card?.name);

  const handleShare = async () => {
    const url = `${window.location.origin}/PokeGuru/card/${card?.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Related cards (same name)
  const { data: relatedData } = useCardSearch(
    card?.name ? `name:"${card.name}" -id:${card.id}` : '',
    '',
    'newest',
    1,
    {},
    retryCount
  );

  if (loading) {
    return <LoadingSpinner message="Loading card details..." />;
  }

  if (error || !card) {
    return (
      <ErrorMessage
        message={error || 'Card not found'}
        onRetry={() => setRetryCount(c => c + 1)}
      />
    );
  }

  const priceInfo = getBestPrice(card);

  // Get PSA 10 data from wiki
  const wikiSets = getAllSets();
  const wikiSet = wikiSets.find(s => s.id === card.set.id);
  const collected = isInCollection(card.id);

  const priceGbp = card ? getCardValueGBP(card) : 0;
  const productLd = card ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${card.name}${card.set?.name ? ` — ${card.set.name}` : ''}`,
    image: card.images?.large || card.images?.small,
    category: 'Trading Card Game > Pokémon TCG',
    brand: { '@type': 'Brand', name: 'Pokémon TCG' },
    url: `https://dlinacre.github.io/PokeGuru/card/${card.id}`,
    ...(priceGbp > 0 ? {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'GBP',
        price: priceGbp.toFixed(2),
        availability: 'https://schema.org/InStock',
        url: `https://dlinacre.github.io/PokeGuru/card/${card.id}`,
      },
    } : {}),
  } : null;

  return (
    <div>
      {productLd && <JsonLd id="product" data={productLd} />}
      {/* Back Link & Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-bold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--text)] active:scale-95"
            title="Copy card link"
          >
            {copied ? <Check size={18} className="text-[#10b981]" /> : <Share2 size={18} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          <button
            onClick={() => collected ? removeFromCollection(card.id) : addToCollection(card)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
              collected
                ? 'border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
            }`}
          >
            <Heart size={18} fill={collected ? "currentColor" : "none"} />
            {collected ? 'In Collection' : 'Add to Collection'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[minmax(220px,360px)_1fr]">
        {/* Card Image */}
        <div>
          <img
            src={card.images.large || card.images.small}
            alt={`${card.name}${card.set?.name ? ` — ${card.set.name}` : ''}`}
            width={745}
            height={1040}
            decoding="async"
            className="w-full rounded-2xl shadow-[var(--shadow)] aspect-[745/1040] object-contain"
          />
        </div>

        {/* Card Info */}
        <div>
          <h1 className="mb-1 text-3xl font-bold">{card.name}</h1>
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[var(--muted)]">
            <p className="font-medium">
              {card.set.name} · #{card.number}
            </p>
            {wikiSet && (wikiSet.psa10Avg || wikiSet.psa10Max) && (
              <div className="flex items-center gap-2 rounded-md bg-[#10b981]/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#10b981] border border-[#10b981]/20 shadow-sm" title="Estimated PSA 10 Set Values">
                <TrendingUp size={12} strokeWidth={3} />
                <span>PSA 10 Wiki:</span>
                <span className="text-[var(--text)]">
                  {wikiSet.psa10Avg ? `~£${wikiSet.psa10Avg.toLocaleString()}` : '—'}
                </span>
                <span className="opacity-30">/</span>
                <span className="text-[var(--text)]">
                  {wikiSet.psa10Max ? `£${wikiSet.psa10Max.toLocaleString()}+` : '—'}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="mb-5 flex flex-wrap gap-2">
            {card.supertype && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-sm text-[var(--muted)]">
                <strong className="text-[var(--text)]">{card.supertype}</strong>
              </span>
            )}
            {card.subtypes?.map((subtype) => (
              <span key={subtype} className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-sm text-[var(--muted)]">
                {subtype}
              </span>
            ))}
            {card.types?.map((type) => (
              <span key={type} className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-sm text-[var(--muted)]">
                {type}
              </span>
            ))}
            {card.hp && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-sm text-[var(--muted)]">
                <strong className="text-[var(--text)]">{card.hp}</strong> HP
              </span>
            )}
            {card.rarity && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-sm text-[var(--muted)]">
                {card.rarity}
              </span>
            )}
          </div>

          {/* Abilities */}
          {card.abilities && card.abilities.length > 0 && (
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h3 className="mb-3 text-base font-semibold text-[var(--accent-2)]">Abilities</h3>
              {card.abilities.map((ability, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="font-semibold text-[var(--text)]">{ability.name}</p>
                  <p className="text-sm text-[var(--muted)]">{ability.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Attacks */}
          {card.attacks && card.attacks.length > 0 && (
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h3 className="mb-3 text-base font-semibold text-[var(--accent-2)]">Attacks</h3>
              {card.attacks.map((attack, i) => (
                <div key={i} className="border-t border-[var(--border)] py-3 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text)]">{attack.name}</span>
                    {attack.damage && (
                      <span className="text-lg font-bold text-[var(--accent)]">{attack.damage}</span>
                    )}
                  </div>
                  {attack.cost && attack.cost.length > 0 && (
                    <p className="text-xs text-[var(--muted)]">
                      Cost: {attack.cost.join(', ')}
                    </p>
                  )}
                  {attack.text && (
                    <p className="mt-1 text-sm text-[var(--muted)]">{attack.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Weaknesses, Resistances, Retreat */}
          {(card.weaknesses || card.resistances || card.retreatCost) && (
            <div className="mb-4 grid gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:grid-cols-3">
              {card.weaknesses && card.weaknesses.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">Weakness</h4>
                  <p className="text-sm text-[var(--text)]">
                    {card.weaknesses.map((w) => `${w.type} ${w.value}`).join(', ')}
                  </p>
                </div>
              )}
              {card.resistances && card.resistances.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">Resistance</h4>
                  <p className="text-sm text-[var(--text)]">
                    {card.resistances.map((r) => `${r.type} ${r.value}`).join(', ')}
                  </p>
                </div>
              )}
              {card.retreatCost && (
                <div>
                  <h4 className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">Retreat Cost</h4>
                  <p className="text-sm text-[var(--text)]">
                    {card.retreatCost.length} ({card.retreatCost.join(', ')})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rules */}
          {card.rules && card.rules.length > 0 && (
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h3 className="mb-2 text-base font-semibold text-[var(--accent-2)]">Rules</h3>
              {card.rules.map((rule, i) => (
                <p key={i} className="mb-2 text-sm text-[var(--muted)] last:mb-0">{rule}</p>
              ))}
            </div>
          )}

          {/* Market Value */}
          <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-gradient-to-br from-[#10b981]/10 to-transparent p-4">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-[#10b981]">Estimated Value (GBP)</h3>
            <p className="text-3xl font-black text-[var(--text)]">{formatGBP(getCardValueGBP(card))}</p>
            <p className="mt-1 text-[10px] font-medium text-[var(--muted)] uppercase tracking-tighter">Avg. Ungraded / Near Mint</p>
          </div>

          {/* Detailed Prices */}
          {priceInfo && (
            <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <h3 className="mb-3 text-sm font-bold text-[var(--muted)] uppercase tracking-widest">Price Breakdown (GBP)</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Low</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {formatGBPFromUSD(priceInfo.price.low)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Mid</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {formatGBPFromUSD(priceInfo.price.mid)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">High</p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {formatGBPFromUSD(priceInfo.price.high)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Market</p>
                  <p className="text-lg font-semibold text-[var(--accent)]">
                    {formatGBPFromUSD(priceInfo.price.market)}
                  </p>
                </div>
              </div>
              {card.tcgplayer?.url && (
                <a
                  href={card.tcgplayer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--link)] hover:underline"
                >
                  View on TCGplayer
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}

          {/* Set Info */}
          <div className="mb-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--accent-2)]">Set Information</h3>
            <Link
              to={`/set/${card.set.id}`}
              className="flex items-center gap-3 hover:no-underline"
            >
              {card.set.images?.logo && (
                <img
                  src={card.set.images.logo}
                  alt={card.set.name}
                  className="h-10 w-14 object-contain"
                />
              )}
              <div>
                <p className="font-semibold text-[var(--text)]">{card.set.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {card.set.series} • Released {new Date(card.set.releaseDate).toLocaleDateString()}
                </p>
              </div>
            </Link>
          </div>

          {/* Artist */}
          {card.artist && (
            <p className="text-sm text-[var(--muted)]">
              Illustrated by <span className="text-[var(--text)] font-semibold">{card.artist}</span>
            </p>
          )}
        </div>
      </div>

      {/* Related Cards */}
      {relatedData && relatedData.data.length > 0 && (
        <section className="mt-16 border-t border-[var(--border)] pt-12">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2 text-purple-400">
              <Box size={24} />
            </div>
            <h2 className="text-2xl font-bold">More {card.name} Cards</h2>
          </div>
          <CardGrid cards={relatedData.data.slice(0, 6)} />
        </section>
      )}
    </div>
  );
}
