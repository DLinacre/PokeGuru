/**
 * The public route registry.
 *
 * One list drives three things that used to disagree:
 *   1. **Build-time prerendering** — each `prerender` route is written to
 *      `dist/<route>.html` with its own title, description, canonical,
 *      Open Graph/Twitter tags, JSON-LD and a readable HTML body, so a crawler
 *      that never runs JavaScript still gets the right page.
 *   2. **`sitemap.xml`** — only `indexable` routes are listed.
 *   3. **Runtime `<head>`** — the client hook uses the same title/description
 *      strings so the prerendered HTML and the hydrated app never disagree.
 *
 * This module must stay free of browser APIs: `vite.config.ts` imports it in
 * Node during the build.
 */

export type ChangeFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface PublicRoute {
  /** Absolute path on the canonical origin, e.g. "/sets". */
  path: string;
  /** Page title without the "| PokeGuru" suffix (added once at render time). */
  title: string;
  description: string;
  /** `<h1>` used in the prerendered shell and mirrored by the app. */
  heading: string;
  /** Short, factual paragraphs printed in the prerendered shell. */
  body: string[];
  /** Internal links the shell exposes to crawlers (real routes only). */
  links?: { href: string; label: string }[];
  changefreq: ChangeFreq;
  priority: string;
  /** `false` ⇒ `noindex,follow` and excluded from the sitemap. */
  indexable: boolean;
  /** `true` ⇒ a static HTML file is emitted for this route. */
  prerender: boolean;
}

/**
 * Honest FAQ copy, published both on the home page and as FAQPage structured
 * data — the visible text and the markup are the same strings.
 */
export const HOME_FAQ = [
  {
    question: "Is PokeGuru free to use?",
    answer:
      "Yes. Searching cards, browsing sets, checking reference prices, using the collection vault and opening virtual packs are all free, with no account, no ads and no subscription. Nothing in the app is locked behind a paywall.",
  },
  {
    question: "Where do PokeGuru's Pokémon card prices come from?",
    answer:
      "Prices are Cardmarket marketplace snapshots supplied by TCGdex, converted from EUR to GBP with the daily Frankfurter exchange rate. Every figure shows the printing it belongs to, the marketplace update date and the FX rate date. They are reference values, not completed sales or financial advice.",
  },
  {
    question: "Do I need an account to track my Pokémon card collection?",
    answer:
      "No. The collection vault stores your cards in your own browser's local storage, so there is no sign-up, no server-side copy and no tracking. You can export and re-import your collection as JSON at any time.",
  },
  {
    question: "Are the booster pack openings real?",
    answer:
      "No. The pack simulator generates pulls from each expansion's real card pool using the documented (or clearly labelled estimated) pack structure. Nothing is purchased, no physical cards are supplied, and simulated pulls are kept separate from your real collection.",
  },
  {
    question: "Does PokeGuru work on a phone?",
    answer:
      "Yes. The layout is responsive and PokeGuru is an installable progressive web app, so you can add it to your home screen on Android or iOS and it will keep working with cached data when your connection drops.",
  },
  {
    question: "Is PokeGuru affiliated with The Pokémon Company?",
    answer:
      "No. PokeGuru is an unofficial, non-commercial fan project. Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and The Pokémon Company; no official artwork or partnership is claimed.",
  },
];

const NAV_LINKS = [
  { href: "/search", label: "Search Pokémon cards" },
  { href: "/sets", label: "Every Pokémon TCG set" },
  { href: "/packs", label: "Pack opening simulator" },
  { href: "/top-100", label: "Top 100 by Cardmarket trend" },
  { href: "/wiki", label: "UK set wiki" },
  { href: "/flyer", label: "Printable flyer" },
  { href: "/about", label: "About PokeGuru" },
];

export const PUBLIC_ROUTES: PublicRoute[] = [
  {
    path: "/",
    title: "Pokémon TCG card database, GBP prices & pack simulator",
    description:
      "Search every Pokémon TCG card, browse every set, check Cardmarket reference prices in GBP with dated exchange rates, track your collection privately and open free virtual booster packs.",
    heading: "Know every Pokémon card you own, and what it is actually worth",
    body: [
      "PokeGuru is a free, open Pokémon TCG card database for UK collectors: search every English card, browse every expansion, and see printing-aware Cardmarket reference prices converted to GBP with a dated exchange rate.",
      "Everything runs in your browser. The collection vault and the pack-opening simulator store their data on your device, and no account, ad or subscription is involved. Prices are reference values from a dated marketplace snapshot, not offers or completed sales.",
    ],
    links: NAV_LINKS,
    changefreq: "daily",
    priority: "1.0",
    indexable: true,
    prerender: true,
  },
  {
    path: "/search",
    title: "Pokémon card search",
    description:
      "Search the Pokémon TCG card database by name, set, collector number, illustrator, rarity and category, with Cardmarket reference prices in GBP.",
    heading: "Search the Pokémon TCG card database",
    body: [
      "Search by name, set, collector number, illustrator, rarity or category. Filters and pagination live in the URL, so a result stays put when you refresh, bookmark or press Back.",
      "Card artwork and card details come from TCGdex; prices are Cardmarket marketplace reference values converted to GBP with the daily Frankfurter exchange rate.",
    ],
    links: [
      { href: "/sets", label: "Browse sets instead" },
      { href: "/top-100", label: "Top 100 by value" },
      { href: "/", label: "PokeGuru home" },
    ],
    changefreq: "weekly",
    priority: "0.9",
    indexable: true,
    prerender: true,
  },
  {
    path: "/sets",
    title: "Every Pokémon TCG expansion",
    description:
      "Browse every Pokémon TCG expansion with release dates, set logos and card counts, then open any set to see its cards and reference values.",
    heading: "Every Pokémon TCG expansion, in release order",
    body: [
      "The complete English expansion index, ordered by real release date, with card counts and set logos. Open a set to browse its cards and, on demand, its total Cardmarket reference value.",
      "Set metadata is supplied by TCGdex; the UK set wiki adds release notes for the sets UK collectors ask about most.",
    ],
    links: [
      { href: "/wiki", label: "UK set wiki" },
      { href: "/search", label: "Search cards" },
      { href: "/", label: "PokeGuru home" },
    ],
    changefreq: "weekly",
    priority: "0.8",
    indexable: true,
    prerender: true,
  },
  {
    path: "/packs",
    title: "Free Pokémon card opening simulator",
    description:
      "Open unlimited free virtual Pokémon card packs from every era, generated from each expansion's real card pool, with documented or clearly estimated pack structures.",
    heading: "The free Pokémon card opening simulator",
    body: [
      "Pick an expansion and open a virtual booster built from that set's real card pool. Each pack panel states whether its structure is documented or estimated, and shows the modelled tier odds with sources.",
      "Simulated pulls are stored separately from your real collection and nothing is purchased: this is a fan-made simulator, not a shop. Where Cardmarket publishes a price for the printing that was opened, each pull shows that reference figure in GBP with its marketplace date and FX rate; where it does not, the pull is marked unpriced rather than estimated.",
    ],
    links: [
      { href: "/packs/collection", label: "Your simulated pulls" },
      { href: "/sets", label: "Every set" },
      { href: "/", label: "PokeGuru home" },
    ],
    changefreq: "weekly",
    priority: "0.9",
    indexable: true,
    prerender: true,
  },
  {
    path: "/top-100",
    title: "Top 100 most valuable Pokémon cards",
    description:
      "The most valuable Pokémon cards by Cardmarket trend, ranked from an assessed candidate pool, with GBP and EUR reference prices and the marketplace update date.",
    heading: "The most valuable Pokémon cards, by Cardmarket trend",
    body: [
      "A ranked list of the highest Cardmarket trend values found in PokeGuru's assessed candidate pool: one printing per card, raw and ungraded, English cards only.",
      "Cards without a real Cardmarket price are excluded rather than estimated, and the page always reports how much of the candidate pool has actually been priced.",
    ],
    links: [
      { href: "/search", label: "Card search" },
      { href: "/sets", label: "Every set" },
      { href: "/", label: "PokeGuru home" },
    ],
    changefreq: "daily",
    priority: "0.8",
    indexable: true,
    prerender: true,
  },
  {
    path: "/wiki",
    title: "UK Pokémon set wiki",
    description:
      "Notes on UK Pokémon TCG sets — release dates, print runs and what collectors should know — mapped onto the card database.",
    heading: "The UK Pokémon set wiki",
    body: [
      "Curated notes on the sets UK collectors ask about most: when a set reached the UK, how it was distributed, and which quirks matter when you buy or value cards.",
      "Every entry links back to the live set page, so the wiki and the card database never drift apart.",
    ],
    links: [
      { href: "/sets", label: "Every set" },
      { href: "/search", label: "Search cards" },
      { href: "/", label: "PokeGuru home" },
    ],
    changefreq: "weekly",
    priority: "0.8",
    indexable: true,
    prerender: true,
  },
  {
    path: "/about",
    title: "About PokeGuru, its data and its sources",
    description:
      "How PokeGuru works, where its card data and Cardmarket reference prices come from, how the packs and the collection vault behave, and what the project does not claim.",
    heading: "About PokeGuru",
    body: [
      "PokeGuru is an unofficial, non-commercial fan project. Card data and artwork come from TCGdex, Cardmarket reference prices arrive through the same API, and exchange rates come from Frankfurter.",
      "The collection vault and the simulator keep everything in your browser's local storage. Nothing is uploaded, and no analytics or advertising scripts are loaded.",
    ],
    links: NAV_LINKS,
    changefreq: "monthly",
    priority: "0.6",
    indexable: true,
    prerender: true,
  },
  {
    path: "/flyer",
    title: "Printable 5 × 6 in flyer",
    description:
      "A one-page PokeGuru flyer for card-shop counters, league nights and trade binders: exactly 5 × 6 in, with a QR code that points at the live site.",
    heading: "The PokeGuru flyer",
    body: [
      "One vector page, exactly 5 × 6 in (127 × 152.4 mm), with a QR code straight to the live site. Download the PDF or print it from the browser.",
      "The QR code always resolves to the production deployment, never to a preview or a local address.",
    ],
    links: [
      { href: "/", label: "PokeGuru home" },
      { href: "/about", label: "About PokeGuru" },
    ],
    changefreq: "monthly",
    priority: "0.6",
    indexable: true,
    prerender: true,
  },
  {
    path: "/collection",
    title: "Your Pokémon card collection vault",
    description:
      "Track and value your own Pokémon card collection privately in this browser. Nothing is uploaded and there is no account.",
    heading: "The collection vault",
    body: [
      "Your collection lives in this browser's local storage only. Add and remove cards, sort them, export a JSON backup and import it again on another device.",
      "This page is personal to you, so it is deliberately excluded from search results.",
    ],
    changefreq: "monthly",
    priority: "0.2",
    indexable: false,
    prerender: false,
  },
  {
    path: "/scanner",
    title: "Scan a Pokémon card",
    description: "Read a Pokémon card with on-device OCR, then confirm the match yourself before adding it anywhere.",
    heading: "Scan a Pokémon card",
    body: [
      "The scanner runs OCR on your device with Tesseract.js, loaded only when you open it, and matches the recognised text against the live card database.",
      "Every match must be confirmed by you. The camera is used only while this page is open, and scanner sessions are not indexed.",
    ],
    changefreq: "yearly",
    priority: "0.2",
    indexable: false,
    prerender: false,
  },
  {
    path: "/packs/history",
    title: "Your pack opening history",
    description:
      "Review previous simulated pack openings with the Cardmarket values that were current when each pack was opened.",
    heading: "Your opening history",
    body: [
      "Each opening is saved in this browser with the prices that were current at the time, so a past opening never changes when the market moves.",
    ],
    changefreq: "yearly",
    priority: "0.1",
    indexable: false,
    prerender: false,
  },
  {
    path: "/packs/collection",
    title: "Your simulated pulls",
    description: "Simulated pack pulls stored separately from your real collection, shown with the Cardmarket reference value of the printing that was opened.",
    heading: "Your simulated pulls",
    body: [
      "Simulated pulls are kept apart from the collection vault so they can never affect your real valuation.",
      "Each pull shows the Cardmarket reference value for the finish that was opened, and the opening history keeps those figures frozen at the time of the pull. They are never presented as cards you own or can sell.",
    ],
    changefreq: "yearly",
    priority: "0.1",
    indexable: false,
    prerender: false,
  },
];

/** Routes that get a static HTML file at build time. */
export const PRERENDER_ROUTES = PUBLIC_ROUTES.filter((route) => route.prerender);

/** Routes that belong in `sitemap.xml`. */
export const SITEMAP_ROUTES = PUBLIC_ROUTES.filter((route) => route.indexable);

/** Presentation-only routes that must never be indexed, wherever they are linked. */
export const NOINDEX_PATHS: string[] = PUBLIC_ROUTES.filter((route) => !route.indexable).map((route) => route.path);

/** Looks up a route by exact path. */
export function routeByPath(path: string): PublicRoute | undefined {
  const normalised = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return PUBLIC_ROUTES.find((route) => route.path === normalised);
}
