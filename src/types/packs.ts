/**
 * Pack Opening Simulator — domain model.
 *
 * The simulator is deliberately separated from the priced card database:
 * pack pulls are *virtual*, stored under their own key and never mixed into
 * the collection vault. Types here describe the pack catalogue, the
 * era-specific generation rules, and the records we persist.
 */

/** Canonical rarity buckets. Upstream rarity strings are mapped onto these. */
export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "holoRare"
  | "doubleRare"
  | "ultraRare"
  | "illustrationRare"
  | "specialIllustrationRare"
  | "hyperRare"
  | "aceSpec"
  | "shinyRare"
  | "shinyUltraRare"
  | "radiant"
  | "amazingRare"
  | "prime"
  | "legend"
  | "lvX"
  | "secretRare"
  | "other";

/** Physical finish of a pulled card. Never inferred from price data. */
export type PullTreatment = "normal" | "reverse" | "holo";

export type SlotKind =
  | "common"
  | "uncommon"
  | "rare"
  | "reverse"
  | "holo"
  | "hit"
  | "energy"
  | "wildcard";

/** A slot in a pack. Weights are relative, per era, and clearly modelled. */
export interface PackSlotRule {
  id: string;
  label: string;
  kind: SlotKind;
  count: number;
  /** Tier weights used when the slot draws from a multi-tier pool. */
  weights?: Partial<Record<RarityTier, number>>;
  /** Forced finish for every card in this slot. */
  treatment?: PullTreatment;
  /** Used when the preferred pool for this slot is empty. */
  fallback?: SlotKind;
}

export type RuleConfidence = "documented" | "estimated";

export interface PackRuleSource {
  /** Short description, e.g. "Pokémon support: Scarlet & Violet booster contents". */
  label: string;
  url?: string;
  /** Exactly what is documented vs what PokeGuru models. */
  note: string;
}

/**
 * How a configuration's tier weights were obtained. The UI shows this next to
 * the odds so a modelled number is never mistaken for a published one.
 */
export interface TierWeightBasis {
  kind: "documented" | "measured" | "estimated";
  label: string;
  detail: string;
  url?: string;
  /** e.g. "8,000+ packs". Only present when the source states it. */
  sampleSize?: string;
  checkedAt?: string;
}

export interface PackConfig {
  id: string;
  label: string;
  /** Human era label shown in the UI. */
  era: string;
  /** TCGdex series ids covered by this configuration. */
  seriesIds: string[];
  /** Specific sets that use this configuration instead of their series one. */
  setIds?: string[];
  cardsPerPack: number;
  slots: PackSlotRule[];
  /** Packs per booster box, only where the standard product is documented. */
  boxPacks?: number;
  confidence: RuleConfidence;
  source: PackRuleSource;
  /** Where the slot tier weights come from, when the rule uses them. */
  weightsBasis?: TierWeightBasis;
  /** ISO date the rule was last reviewed. */
  checkedAt: string;
  notes?: string;
}

/** A card as it exists in a generated pool (brief-level data only). */
export interface PoolCard {
  id: string;
  name: string;
  localId: string;
  setId: string;
  setName: string;
  rarity: string;
  tier: RarityTier;
  /** Full artwork URL (legacy field, kept for saved pools). */
  image?: string;
  /** TCGdex asset base — preferred by the artwork resolver. */
  imageBase?: string;
}

export type PoolsByTier = Partial<Record<RarityTier, PoolCard[]>>;

export interface PackPool {
  setId: string;
  setName: string;
  seriesId: string;
  releaseDate?: string;
  configId: string;
  tiers: PoolsByTier;
  /** Number of cards the API returned that we could not place in a tier. */
  unmapped: number;
  /** Total briefs examined while building the pool. */
  examined: number;
  /** Set ids that contributed cards (includes Trainer Gallery style subsets). */
  sourceSets: string[];
  builtAt: number;
}

export interface PulledCard {
  id: string;
  name: string;
  localId: string;
  setId: string;
  setName: string;
  rarity: string;
  tier: RarityTier;
  treatment: PullTreatment;
  /** Full artwork URL (legacy) or TCGdex asset base. */
  image?: string;
  imageBase?: string;
  /** Slot id that produced this card. */
  slot: string;
}

export interface PackResult {
  id: string;
  setId: string;
  setName: string;
  seriesId: string;
  configId: string;
  openedAt: number;
  /** Seed that reproduces this pack exactly (pool permitting). */
  seed: string;
  cards: PulledCard[];
  bestTier: RarityTier | null;
}

/* ------------------------------------------------------------------ */
/* Market values for pulls                                             */
/* ------------------------------------------------------------------ */

/**
 * The finish a card was pulled in. Recorded by the pack engine and never
 * inferred from price data.
 */
export type PullFinish = "normal" | "reverse" | "holo";

/** Why a pull does or does not carry a value. */
export type PullValueStatus = "priced" | "unavailable";

/**
 * One card's value at the moment it was opened. This is a *snapshot*: the
 * amounts, source, marketplace date and FX rate are frozen so a historical
 * opening never changes when the market moves.
 */
export interface PullValuation {
  /** `${cardId}|${finish}` — unique within a pack session. */
  key: string;
  cardId: string;
  name: string;
  localId: string;
  setId: string;
  setName: string;
  finish: PullFinish;
  tier: RarityTier;
  status: PullValueStatus;
  /** Cardmarket value in EUR, exactly as published. */
  eur: number | null;
  /** EUR converted at `fxRate` and rounded to 2dp, or null when no rate. */
  gbp: number | null;
  basis: "trend" | "avg" | "low" | "avg30" | null;
  /** Which marketplace band the value came from. */
  variant: "normal" | "holo" | null;
  /** Human description of the printing the value belongs to. */
  printing: string;
  source: "cardmarket" | null;
  /** Marketplace update timestamp, ISO. */
  priceUpdatedAt?: string;
  /** FX rate date (YYYY-MM-DD) and the rate itself. */
  fxDate?: string;
  fxRate?: number;
  /** When PokeGuru resolved this value. */
  retrievedAt: number;
  /** Plain-English explanation when `status` is unavailable. */
  reason?: string;
  /** Machine-readable caveats (e.g. `finish-assumed`). */
  flags: string[];
}

/** Aggregated value of a set of pulls. Never mixes known and unknown values. */
export interface PackValueTotals {
  cards: number;
  priced: number;
  unavailable: number;
  /** Cards whose value has not resolved yet (live openings only). */
  pending: number;
  /** Sum of the *rounded* GBP values of priced cards. */
  totalGbp: number;
  /** Sum of the EUR values of priced cards. */
  totalEur: number;
  /** Average known GBP value per priced card, or null when nothing is priced. */
  averageGbp: number | null;
  highest: { cardId: string; name: string; gbp: number } | null;
  lowest: { cardId: string; name: string; gbp: number } | null;
}

/** A pack as it was opened, with the values frozen at that moment. */
export interface OpeningPackRecord {
  packId: string;
  openedAt: number;
  seed: string;
  bestTier: RarityTier | null;
  pulls: PullValuation[];
  totals: PackValueTotals;
}

/**
 * One opening session (one "Open 5 packs" action). `valuesRecorded` is false
 * for sessions saved before value tracking existed, or when every price
 * lookup failed — those show "not recorded" instead of a fabricated total.
 */
export interface OpeningSession {
  id: string;
  setId: string;
  setName: string;
  seriesId: string;
  startedAt: number;
  completedAt: number;
  packs: OpeningPackRecord[];
  totals: PackValueTotals;
  valuesRecorded: boolean;
  /** True for entries migrated from the pre-1.11 pull history. */
  legacy?: boolean;
}

/** A stored simulated card with duplicate count. */
export interface SimCard {
  card: PulledCard;
  quantity: number;
  firstPulledAt: number;
}

export interface SimState {
  /** 2 added `openings` (value snapshots). 1 is migrated on read. */
  version: 2;
  cards: Record<string, SimCard>;
  packsOpened: number;
  /** Newest first, capped. Card-level history without values. */
  history: PackResult[];
  /** Newest first, capped. Opening sessions with frozen value snapshots. */
  openings: OpeningSession[];
  settings: SimSettings;
}

export interface SimSettings {
  sound: boolean;
  reduceMotion: boolean;
  wrapperStyle: WrapperStyle;
}

export type WrapperStyle = "crimson" | "prism" | "vintage";

export interface PackSetSummary {
  setId: string;
  setName: string;
  seriesId: string;
  seriesName: string;
  releaseDate?: string;
  cardCount?: number;
  logo?: string;
  symbol?: string;
  configId: string;
  era: string;
  confidence: RuleConfidence;
  boxPacks?: number;
  /** False when the set has too little data for an honest simulation. */
  supported: boolean;
  unsupportedReason?: string;
}

export interface OddsRow {
  tier: RarityTier;
  label: string;
  /** Chance that a single pack contains at least one card of this tier. */
  perPack: number;
  /** Cards of this tier in the pool. */
  poolSize: number;
}

export interface PackOdds {
  configId: string;
  confidence: RuleConfidence;
  rows: OddsRow[];
  slotSummary: { slot: string; label: string; count: number; tiers: string[]; detail: string }[];
  source: PackRuleSource;
  weightsBasis?: TierWeightBasis;
  checkedAt: string;
  notes?: string;
  /** True when modelled numbers were derived from a thin pool. */
  thin: boolean;
}
