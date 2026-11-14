/** Test-only fixtures. These never ship to the application bundle. */

export const SET_BRIEF = {
  id: "swsh3",
  name: "Darkness Ablaze",
  logo: "https://assets.tcgdex.net/en/swsh/swsh3/logo",
  symbol: "https://assets.tcgdex.net/univ/swsh/swsh3/symbol",
  cardCount: { total: 201, official: 189 },
};

export const CARD_BRIEF = {
  id: "swsh3-136",
  localId: "136",
  name: "Furret",
  image: "https://assets.tcgdex.net/en/swsh/swsh3/136",
};

export const CARD_DETAIL = {
  ...CARD_BRIEF,
  category: "Pokemon",
  illustrator: "tetsuya koizumi",
  rarity: "Uncommon",
  set: SET_BRIEF,
  variants: { firstEdition: false, holo: false, normal: true, reverse: true },
  hp: 110,
  types: ["Colorless"],
  attacks: [
    { cost: ["Colorless"], name: "Feelin' Fine", effect: "Draw 3 cards." },
    { cost: ["Colorless"], name: "Tail Smash", effect: "Flip a coin.", damage: 90 },
  ],
  abilities: [{ name: "Run Away", effect: "Once during your turn, you may draw a card.", type: "Ability" }],
  weaknesses: [{ type: "Fighting", value: "×2" }],
  retreat: 1,
  legal: { standard: false, expanded: true },
  updated: "2026-10-01T10:00:00.000Z",
  pricing: {
    cardmarket: {
      updated: "2026-11-12T00:42:15.000Z",
      unit: "EUR",
      avg: 0.08,
      low: 0.02,
      trend: 0.08,
      avg1: 0.03,
      avg7: 0.08,
      avg30: 0.08,
      "avg-holo": 0.27,
      "low-holo": 0.03,
      "trend-holo": 0.21,
    },
    tcgplayer: {
      updated: "2026-11-12T20:07:54.000Z",
      unit: "USD",
      normal: { lowPrice: 0.02, midPrice: 0.17, highPrice: 25.09, marketPrice: 0.09, directLowPrice: 0.04 },
      reverse: { lowPrice: 0.09, midPrice: 0.26, highPrice: 5.17, marketPrice: 0.23 },
    },
  },
};

export const FX_PAYLOAD = [{ date: "2026-11-14", base: "EUR", quote: "GBP", rate: 0.855 }];
