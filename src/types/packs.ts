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
  image?: string;
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
  image?: string;
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

/** A stored simulated card with duplicate count. */
export interface SimCard {
  card: PulledCard;
  quantity: number;
  firstPulledAt: number;
}

export interface SimState {
  version: 1;
  cards: Record<string, SimCard>;
  packsOpened: number;
  /** Newest first, capped. */
  history: PackResult[];
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
  slotSummary: { slot: string; count: number; detail: string }[];
  source: PackRuleSource;
  checkedAt: string;
  notes?: string;
  /** True when modelled numbers were derived from a thin pool. */
  thin: boolean;
}
