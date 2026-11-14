/**
 * Era-specific pack rules.
 *
 * What is documented vs modelled
 * ------------------------------
 * Pokémon publishes the *contents* of modern Scarlet & Violet boosters (see
 * the source on the `sv` rule) but it does not publish per-rarity pull odds
 * for individual expansions. Community trackers publish sampled odds for
 * some sets, but those samples are not stable enough to ship as fact, so
 * every rule below is marked either:
 *
 *   documented — pack size / slot structure from the product guidance
 *   estimated  — pack size is documented, but the slot split and the
 *                tier weights are PokeGuru's model
 *
 * The grade is shown in the UI and in the "Odds & methodology" panel. We do
 * not label modelled numbers as official, and the model never guarantees a
 * specific card.
 */

import type {
  PackConfig,
  PackSlotRule,
  RarityTier,
  RuleConfidence,
  TierWeightBasis,
} from "../types/packs";

/** Human labels for the rarity buckets. */
export const TIER_LABELS: Record<RarityTier, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  holoRare: "Holo rare",
  doubleRare: "Double rare",
  ultraRare: "Ultra rare",
  illustrationRare: "Illustration rare",
  specialIllustrationRare: "Special illustration rare",
  hyperRare: "Hyper rare",
  aceSpec: "ACE SPEC",
  shinyRare: "Shiny rare",
  shinyUltraRare: "Shiny ultra rare",
  radiant: "Radiant",
  amazingRare: "Amazing rare",
  prime: "Prime",
  legend: "LEGEND",
  lvX: "LV.X",
  secretRare: "Secret rare",
  other: "Other",
};

/**
 * Order used for "best pull" and reveal ordering. Higher is better, so the
 * final reveal of a pack is the rarest card.
 */
export const TIER_ORDER: RarityTier[] = [
  "common",
  "uncommon",
  "rare",
  "holoRare",
  "prime",
  "legend",
  "lvX",
  "doubleRare",
  "ultraRare",
  "aceSpec",
  "radiant",
  "amazingRare",
  "shinyRare",
  "illustrationRare",
  "shinyUltraRare",
  "specialIllustrationRare",
  "hyperRare",
  "secretRare",
  "other",
];

export function tierRank(tier: RarityTier): number {
  const index = TIER_ORDER.indexOf(tier);
  return index === -1 ? 0 : index;
}

/**
 * Map a TCGdex rarity string to a canonical tier.
 *
 * TCGdex is inconsistent about capitalisation ("Double rare" vs
 * "Double Rare"), so matching is case-insensitive.
 */
export function tierFromRarity(rarity: string | undefined | null): RarityTier {
  const value = (rarity ?? "").trim().toLowerCase();
  if (!value) return "other";

  switch (value) {
    case "common":
      return "common";
    case "uncommon":
      return "uncommon";
    case "rare":
      return "rare";
    case "holo rare":
    case "rare holo":
      return "holoRare";
    case "double rare":
      return "doubleRare";
    case "mega attack rare":
      return "doubleRare";
    case "ultra rare":
    case "full art trainer":
    case "rare holo ex":
    case "rare holo gx":
    case "rare holo v":
    case "rare holo vmax":
    case "rare holo vstar":
    case "holo rare v":
    case "holo rare vmax":
    case "holo rare vstar":
      return "ultraRare";
    case "illustration rare":
      return "illustrationRare";
    case "special illustration rare":
      return "specialIllustrationRare";
    case "hyper rare":
    case "mega hyper rare":
    case "pikachu rare":
    case "crown":
      return "hyperRare";
    case "ace spec rare":
      return "aceSpec";
    case "shiny rare":
    case "shiny rare v":
    case "one shiny":
    case "two shiny":
    case "one star":
    case "two star":
      return "shinyRare";
    case "shiny ultra rare":
    case "shiny rare vmax":
    case "three star":
      return "shinyUltraRare";
    case "radiant rare":
      return "radiant";
    case "amazing rare":
      return "amazingRare";
    case "rare prime":
      return "prime";
    case "legend":
      return "legend";
    case "rare holo lv.x":
      return "lvX";
    case "secret rare":
    case "black white rare":
      return "secretRare";
    default:
      return "other";
  }
}

/** Series that are sold as booster packs. Pocket/promo/deck products are out. */
const BOOSTER_SERIES = new Set([
  "base",
  "gym",
  "neo",
  "lc",
  "ecard",
  "ex",
  "dp",
  "pl",
  "hgss",
  "col",
  "bw",
  "xy",
  "sm",
  "swsh",
  "sv",
  "me",
]);

export function isBoosterSeries(seriesId: string | undefined): boolean {
  return Boolean(seriesId && BOOSTER_SERIES.has(seriesId));
}

/**
 * Set names that are not sold as booster packs (promos, energy decks, kits,
 * jumbo cards, boxed reprints). They are excluded from the simulator rather
 * than folded into a neighbouring set.
 */
const NON_BOOSTER_SET = /promo|energy|jumbo|mcdonald|trainer kit|deck|miscellaneous|sample|play!|league|championship|battle academy|world championship|classic collection|shiny vault|trainer gallery|galarian gallery|radiant collection|celebrations/i;

export function isBoosterSet(name: string): boolean {
  return !NON_BOOSTER_SET.test(name);
}

const CHECKED_AT = "2026-11-14";

const SV_SOURCE = {
  label: "Pokémon support: Scarlet & Violet booster pack contents",
  url: "https://support.pokemon.com/hc/en-us/articles/15417984157332",
  note:
    "Pokémon states that Scarlet & Violet boosters contain 10 game cards (4 common, 3 uncommon and 3 foil, with at least one rare or higher), an Energy card and a code card. PokeGuru models the 10 game cards only: 4 common, 3 uncommon, 1 guaranteed rare-or-better foil and 2 reverse foils (the second one is the slot players call the wildcard). Energy and code cards are not simulated.",
};

const MODERN_PACK_SOURCE = {
  label: "Community-documented booster size; PokeGuru slot model",
  note:
    "The pack size matches the product's documented card count. The common/uncommon/rare split and the rarity weights are modelled by PokeGuru, not published by The Pokémon Company.",
};

/** Reusable slot builders keep the rules readable. */
function common(count: number): PackSlotRule {
  return { id: "common", label: "Common", kind: "common", count };
}

function uncommon(count: number): PackSlotRule {
  return { id: "uncommon", label: "Uncommon", kind: "uncommon", count };
}

function reverse(count = 1, id = "reverse", label = "Reverse holo"): PackSlotRule {
  return {
    id,
    label,
    kind: "reverse",
    count,
    treatment: "reverse",
    fallback: "common",
  };
}

function rare(weights: Partial<Record<RarityTier, number>>, label = "Rare"): PackSlotRule {
  return { id: "rare", label, kind: "rare", count: 1, weights, treatment: "normal" };
}

/**
 * Scarlet & Violet tier weights, expressed as relative shares of the single
 * "rare or better" foil slot.
 *
 * The shares are the measured per-pack rates published by the TCGplayer
 * Authentication Center (8,000+ packs for Scarlet & Violet base, per-set
 * articles through the era): Double rare 13.8%, Ultra rare 6.6%,
 * Illustration rare 7.7%, Special illustration rare 3.1%, Hyper rare 1.9%,
 * with the remainder the regular rare. ACE SPEC (a late-era addition) and the
 * shiny tiers (special sets only) keep estimated shares because the published
 * studies did not break them out per set.
 */
const SV_HIT_WEIGHTS: Partial<Record<RarityTier, number>> = {
  rare: 68,
  doubleRare: 13.8,
  illustrationRare: 7.7,
  ultraRare: 6.6,
  specialIllustrationRare: 3.1,
  hyperRare: 1.9,
  aceSpec: 6,
  shinyRare: 8,
  shinyUltraRare: 2.5,
  secretRare: 1.9,
};

const MEASURED_SV_BASIS: TierWeightBasis = {
  kind: "measured",
  label: "TCGplayer Authentication Center — measured booster openings",
  detail:
    "Tier shares come from TCGplayer's published opening studies (8,000+ Scarlet & Violet packs for the base set, plus the per-set articles for later expansions): Double rare 13.8%, Ultra rare 6.6%, Illustration rare 7.7%, Special illustration rare 3.1%, Hyper rare 1.9%. ACE SPEC and shiny-tier shares are PokeGuru estimates because the studies do not break them out per set.",
  url: "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Scarlet-Violet%E2%80%94151-Pull-Rates/b237df74-fbb0-40d0-9e13-d69ee6e804d9/",
  sampleSize: "8,000+ packs",
  checkedAt: "2026-11-14",
};

const ESTIMATED_BASIS: TierWeightBasis = {
  kind: "estimated",
  label: "PokeGuru estimate",
  detail:
    "No measured opening study is bundled for this era, so the tier shares are modelled: the slot's own rarity mix sets the order, and every step up the rarity ladder is deliberately rarer than the one below. The pack structure on the same page is separate from these weights.",
  checkedAt: "2026-11-14",
};

const SWSH_HIT_WEIGHTS: Partial<Record<RarityTier, number>> = {
  rare: 100,
  holoRare: 42,
  ultraRare: 18,
  amazingRare: 4,
  radiant: 4,
  shinyRare: 5,
  shinyUltraRare: 2,
  secretRare: 2,
};

const SM_HIT_WEIGHTS: Partial<Record<RarityTier, number>> = {
  rare: 100,
  holoRare: 42,
  ultraRare: 18,
  secretRare: 2,
};

/**
 * The ruleset. Order matters only for readability — resolution is by exact
 * set id, then series id.
 */
export const PACK_CONFIGS: PackConfig[] = [
  {
    id: "wotc-base",
    label: "Wizards of the Coast booster",
    era: "Wizards of the Coast (1999–2002)",
    seriesIds: ["base", "gym", "neo"],
    cardsPerPack: 11,
    slots: [
      common(6),
      uncommon(3),
      rare({ rare: 82, holoRare: 18 }),
      {
        id: "energy",
        label: "Basic Energy",
        kind: "energy",
        count: 1,
        fallback: "common",
      },
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: {
      label: "Community-documented 11-card WotC booster",
      note:
        "Wizards-era boosters contained 11 cards. The 6/3/1 split plus one basic Energy matches the Base Set packaging; later WotC sets vary slightly, so the split is modelled. TCGdex records the first WotC sets' holofoil rares as plain 'Rare' (holofoil is a printing variant there), so those sets draw the rare slot from one combined rare pool instead of separating holo from non-holo.",
    },
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
    notes:
      "Card briefs carry no category, so a set whose basic Energies are filed as commons (Base Set) cannot have them split out: the Energy slot is filled from the common pool and says so on the pack page.",
  },
  {
    id: "wotc-legendary",
    label: "Legendary Collection booster",
    era: "Wizards of the Coast (2002)",
    seriesIds: ["lc"],
    cardsPerPack: 9,
    slots: [common(4), uncommon(3), rare({ rare: 80, holoRare: 20 }), reverse(1)],
    boxPacks: 36,
    confidence: "estimated",
    source: {
      label: "Community-documented 9-card Legendary Collection booster",
      note:
        "Legendary Collection was the first English set with a reverse holo in every pack. The exact common/uncommon split is modelled.",
    },
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "ecard",
    label: "e-Card booster",
    era: "e-Card (2002–2003)",
    seriesIds: ["ecard"],
    cardsPerPack: 9,
    slots: [common(4), uncommon(3), rare({ rare: 84, holoRare: 16 }), reverse(1)],
    boxPacks: 36,
    confidence: "estimated",
    source: {
      label: "Community-documented 9-card e-Card booster",
      note: "Nine-card packs with one reverse holo. Slot split modelled by PokeGuru.",
    },
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "ex",
    label: "EX series booster",
    era: "EX (2003–2006)",
    seriesIds: ["ex"],
    cardsPerPack: 9,
    slots: [
      common(4),
      uncommon(3),
      rare({ rare: 82, holoRare: 14, ultraRare: 4 }),
      reverse(1),
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: {
      label: "Community-documented 9-card EX booster",
      note:
        "EX boosters held nine cards. EX-era ultra rares (ex cards) are modelled as a small share of the rare slot.",
    },
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "dp",
    label: "Diamond & Pearl / Platinum booster",
    era: "Diamond & Pearl · Platinum (2007–2010)",
    seriesIds: ["dp", "pl"],
    cardsPerPack: 10,
    slots: [
      common(5),
      uncommon(3),
      rare({ rare: 84, holoRare: 13, ultraRare: 3 }),
      reverse(1),
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "hgss",
    label: "HeartGold & SoulSilver booster",
    era: "HeartGold & SoulSilver (2010–2011)",
    seriesIds: ["hgss", "col"],
    cardsPerPack: 10,
    slots: [
      common(5),
      uncommon(3),
      rare({ rare: 80, holoRare: 12, prime: 4, legend: 2, ultraRare: 2 }),
      reverse(1),
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "bw",
    label: "Black & White booster",
    era: "Black & White (2011–2013)",
    seriesIds: ["bw"],
    cardsPerPack: 10,
    slots: [
      common(5),
      uncommon(3),
      rare({ rare: 82, holoRare: 12, ultraRare: 5, secretRare: 1 }),
      reverse(1),
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "xy",
    label: "XY booster",
    era: "XY (2014–2016)",
    seriesIds: ["xy"],
    cardsPerPack: 10,
    slots: [
      common(5),
      uncommon(3),
      rare({ rare: 80, holoRare: 13, ultraRare: 5.5, secretRare: 1.5 }),
      reverse(1),
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "sm",
    label: "Sun & Moon booster",
    era: "Sun & Moon (2017–2019)",
    seriesIds: ["sm"],
    cardsPerPack: 10,
    slots: [
      common(4),
      uncommon(3),
      rare({ rare: 78, holoRare: 14, ultraRare: 6, secretRare: 1.5, shinyRare: 0.5 }),
      reverse(1),
      { id: "hit", label: "Rare or better", kind: "hit", count: 1, weights: SM_HIT_WEIGHTS },
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
    notes:
      "Sun & Moon packs varied through the era (GX, Prism Star and Tag Team products). The extra hit slot is modelled, not documented per set.",
  },
  {
    id: "swsh",
    label: "Sword & Shield booster",
    era: "Sword & Shield (2020–2022)",
    seriesIds: ["swsh"],
    cardsPerPack: 10,
    slots: [
      common(4),
      uncommon(3),
      rare({ rare: 74, holoRare: 18, ultraRare: 6, secretRare: 1.5, shinyRare: 0.5 }),
      reverse(1),
      { id: "hit", label: "Rare or better", kind: "hit", count: 1, weights: SWSH_HIT_WEIGHTS },
    ],
    boxPacks: 36,
    confidence: "estimated",
    source: MODERN_PACK_SOURCE,
    weightsBasis: ESTIMATED_BASIS,
    checkedAt: CHECKED_AT,
  },
  {
    id: "sv",
    label: "Scarlet & Violet booster",
    era: "Scarlet & Violet (2023–)",
    seriesIds: ["sv", "me"],
    cardsPerPack: 10,
    slots: [
      common(4),
      uncommon(3),
      reverse(1),
      {
        id: "rare",
        label: "Rare or better (guaranteed foil)",
        kind: "rare",
        count: 1,
        weights: SV_HIT_WEIGHTS,
        treatment: "holo",
      },
      reverse(1, "wildcard", "Second reverse foil"),
    ],
    boxPacks: 36,
    confidence: "documented",
    source: SV_SOURCE,
    weightsBasis: MEASURED_SV_BASIS,
    checkedAt: CHECKED_AT,
    notes:
      "Special sets (for example Crown Zenith, 151 or Prismatic Evolutions) were sold in different products; the same 10-card game-card model is used. 151 in particular has different foil placement, so treat the slot split as an estimate even though the era's tier weights are measured.",
  },
];

/**
 * TCGdex set records carry the *series name*, not its id. This map turns the
 * published series names into the stable ids used by the rules above.
 */
export const SERIES_ID_BY_NAME: Record<string, string> = {
  Miscellaneous: "misc",
  Base: "base",
  Gym: "gym",
  Neo: "neo",
  "Legendary Collection": "lc",
  "E-Card": "ecard",
  EX: "ex",
  POP: "pop",
  "Trainer kits": "tk",
  "Diamond & Pearl": "dp",
  Platinum: "pl",
  "HeartGold & SoulSilver": "hgss",
  "Call of Legends": "col",
  "Black & White": "bw",
  "McDonald's Collection": "mc",
  XY: "xy",
  "Sun & Moon": "sm",
  "Sword & Shield": "swsh",
  "Scarlet & Violet": "sv",
  "Pokémon TCG Pocket": "tcgp",
  "Mega Evolution": "me",
};

export function seriesIdFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return SERIES_ID_BY_NAME[name.trim()];
}

/** Resolve the rule for a set. Exact set overrides win over series matches. */
export function resolvePackConfig(set: {
  id: string;
  seriesId?: string;
}): PackConfig | undefined {
  const override = PACK_CONFIGS.find((config) => config.setIds?.includes(set.id));
  if (override) return override;
  if (!set.seriesId) return undefined;
  return PACK_CONFIGS.find((config) => config.seriesIds.includes(set.seriesId as string));
}

export function configById(id: string): PackConfig | undefined {
  return PACK_CONFIGS.find((config) => config.id === id);
}

/** Total cards a configuration produces, used to validate the rule table. */
export function slotCount(config: PackConfig): number {
  return config.slots.reduce((sum, slot) => sum + slot.count, 0);
}

/** Series ordering for the pack browser (oldest era first). */
export const SERIES_ORDER = [
  "base",
  "gym",
  "neo",
  "lc",
  "ecard",
  "ex",
  "dp",
  "pl",
  "hgss",
  "col",
  "bw",
  "xy",
  "sm",
  "swsh",
  "sv",
  "me",
];

/** Provenance badge text used across the simulator UI. */
export function confidenceLabel(confidence: RuleConfidence): string {
  return confidence === "documented" ? "Documented structure" : "Estimated model";
}
