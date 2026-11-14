/**
 * PokeGuru domain model
 *
 * These types are the app-facing (normalised) shapes produced by the
 * TCGdex adapter in `src/services/tcgdex.ts`. Nothing in the UI talks to a
 * vendor payload directly, which keeps the UI stable if the upstream API
 * changes again.
 */

export type CardCategory = "Pokemon" | "Trainer" | "Energy";

export interface CardImages {
  /** ~245px wide thumbnail (245x337) */
  small?: string;
  /** ~600px wide full card (600x825) */
  large?: string;
}

export interface SetImages {
  logo?: string;
  symbol?: string;
}

export interface Attack {
  name: string;
  cost?: string[];
  damage?: string;
  effect?: string;
}

export interface Ability {
  name: string;
  effect?: string;
  type?: string;
}

export interface TypeValue {
  type: string;
  value?: string;
}

export interface SetRef {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
}

export interface CardVariants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  wPromo?: boolean;
}

export interface CardLegalities {
  standard?: boolean;
  expanded?: boolean;
  unlimited?: boolean;
}

/** Cardmarket price band (EUR). `avg` is the average *asking/selling*
 * reference price Cardmarket publishes — it is not a live quote. */
export interface CardmarketBand {
  low?: number;
  trend?: number;
  avg?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
}

export interface CardmarketPricing {
  updatedAt?: string;
  currency: "EUR";
  normal?: CardmarketBand;
  holo?: CardmarketBand;
}

/** TCGplayer price band (USD). */
export interface TcgplayerBand {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
}

export interface TcgplayerPricing {
  updatedAt?: string;
  currency: "USD";
  variants: Record<string, TcgplayerBand>;
}

export interface CardPricing {
  cardmarket?: CardmarketPricing;
  tcgplayer?: TcgplayerPricing;
}

export interface TcgCard {
  id: string;
  name: string;
  /** Card number inside the set, e.g. "136" */
  localId: string;
  category: CardCategory | string;
  rarity?: string;
  illustrator?: string;
  /** Raw asset base URL (no extension) as returned by TCGdex. */
  imageBase?: string;
  images: CardImages;
  set: SetRef;
  variants?: CardVariants;
  hp?: number;
  types?: string[];
  stage?: string;
  evolveFrom?: string;
  description?: string;
  suffix?: string;
  level?: string;
  attacks?: Attack[];
  abilities?: Ability[];
  weaknesses?: TypeValue[];
  resistances?: TypeValue[];
  /** Number of colourless energy required to retreated. */
  retreat?: number;
  rules?: string[];
  legal?: CardLegalities;
  regulationMark?: string;
  /** ISO timestamp of the non-price card data. */
  updatedAt?: string;
  pricing?: CardPricing;
  /** False while we only have the search "brief" for this card. */
  isDetailed: boolean;
}

export interface TcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate?: string;
  cardCount: { official?: number; total?: number };
  legal?: CardLegalities;
  images: SetImages;
  cards?: TcgCard[];
}

export type SearchSort = "name" | "newest" | "oldest" | "value_high" | "value_low";

export interface SearchFilters {
  query: string;
  category: string;
  rarity: string;
  setId: string;
  illustrator?: string;
  sort: SearchSort;
  page: number;
  pageSize: number;
}

export interface CardSearchResult {
  cards: TcgCard[];
  page: number;
  pageSize: number;
  /** True when the API returned a full page (there may be more results). */
  hasMore: boolean;
  /** Only present when the upstream API exposes a total count. */
  totalCount?: number;
}

/** Where a value came from — used to label cached/offline data honestly. */
export type DataSource = "network" | "cache";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  /** When the underlying HTTP response was first stored (ms epoch). */
  cachedAt?: number;
  /** True when served from cache after its freshness window expired. */
  stale?: boolean;
}
