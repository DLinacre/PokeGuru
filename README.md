<p align="center">
  <img src="assets/banner.jpg" alt="PokeGuru — open Pokémon TCG card database with GBP reference prices" width="100%">
</p>

<p align="center">
  <a href="https://pokeguru.vercel.app"><img src="https://img.shields.io/badge/live-pokeguru.vercel.app-F59E0B?style=for-the-badge&logo=vercel&logoColor=white" alt="Live site"></a>
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white">
  <img src="https://img.shields.io/badge/data-TCGdex-EF4444?style=for-the-badge">
  <img src="https://img.shields.io/badge/license-MIT-34D399?style=for-the-badge">
</p>

---

<h1 align="center">PokeGuru</h1>
<p align="center"><strong>Every card. Every set. Honest GBP pricing.</strong></p>

PokeGuru is a fast, installable Pokémon TCG web app for UK collectors. It searches
the full English card database from [TCGdex](https://tcgdex.dev/), shows
**printing-aware** Cardmarket reference prices in GBP with a dated exchange rate,
and keeps a private collection vault in the browser.

> **Pricing honesty:** PokeGuru does **not** invent values, sales, trends or
> history. Every price comes from a dated marketplace snapshot, and anything the
> upstream API does not provide is displayed as **“No Data Available”**. Values are
> *reference prices*, not offers, appraisals or completed sales. PokeGuru is not
> affiliated with Nintendo, Creatures Inc. or The Pokémon Company.

---

## ✨ Features

- **Search & filter** every English card by name, set, collector number,
  illustrator, rarity and category. Price-range and printing filters apply to the
  loaded page (the search API returns no prices in list results) and say so.
  Filters and pagination live in the URL, so results survive refresh, deep links
  and the Back button.
- **Card pages** with large artwork, set/series metadata, illustrator, rarity,
  regulation marks, variants, every published Cardmarket band, a confidence
  rating for the headline figure, and optional TCGplayer (USD) reference prices.
- **Set archive** — browse expansions by series with card counts, release dates
  and set logos. A set's total reference value can be computed on demand from
  each card's own marketplace snapshot.
- **Collection vault** — add, remove, search, sort and value cards; import and
  export JSON. Stored in `localStorage` (`pokeguru_collection`) on your device
  only, and old v1.6 collections migrate automatically. Importing merges and
  never deletes existing cards.
- **Card scanner** — real on-device OCR with Tesseract.js, loaded only when you
  scan. The recognised text is matched against the live database and **you**
  confirm the match; nothing is added silently.
- **UK pricing** — EUR→GBP conversion uses live [Frankfurter](https://frankfurter.dev/)
  rates (cached for 12 h) with the rate date and marketplace update date shown.
- **Pack Opening Simulator** — open unlimited virtual boosters from every era,
  generated from the real card pool of the chosen expansion with era-specific
  pack structures. Every pack panel states whether its structure is documented
  or estimated, shows the modelled tier odds with sources, and keeps simulated
  pulls in their own store (`pokeguru_pack_sim_v1`) so they can never leak into
  your real collection or its valuation.
- **Printable 5 × 7 in flyer** — one-click, vector, print-ready PDF
  (`PokeGuru-5x7-QR-Flyer.pdf`) with a QR code that always points at the live
  production site, plus a Print option that opens your print dialogue. Linked
  from the footer, the homepage “Share PokeGuru” panel and the About page.
- **Offline-tolerant PWA** — app shell cached, clearly labelled cached data, a
  safe update prompt that never traps you on an old version, and an optional
  install invitation (“Take PokeGuru with you!”).

---

## 🧱 Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Tailwind CSS 4, Lucide icons |
| Build | Vite 8 (route-level code splitting, no production sourcemaps) |
| Routing | React Router 7 (`BrowserRouter`, real URLs, SPA rewrites) |
| Card data | [TCGdex v2 REST API](https://tcgdex.dev/rest) — no API key |
| FX rates | [Frankfurter v2](https://frankfurter.dev/) — no API key |
| OCR | [Tesseract.js 7](https://github.com/naptha/tesseract.js) (lazy, on demand) |
| Tests | Vitest + Testing Library + jsdom |
| Hosting | Vercel (primary), GitHub Pages (optional) |

No paid services, API keys or subscriptions are required.

---

## 🚀 Quick start

```bash
git clone https://github.com/DLinacre/PokeGuru.git
cd PokeGuru
npm ci            # install exactly what the lockfile pins
npm run dev       # http://localhost:5173
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest suite |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run build:pages` | Build for GitHub Pages (base `/PokeGuru/`) |
| `npm run icons` | Regenerate PWA PNG icons from the vector source |

---

## ⚙️ Configuration

Copy `.env.example` to `.env` (or set the same variables in your host’s
dashboard). Every variable is **public** — Vite inlines `VITE_*` at build time,
so never put secrets in them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_PUBLIC_SITE_URL` | **yes for the flyer** | Canonical origin used for canonical/OG tags, `sitemap.xml`, absolute `robots.txt` entries **and the QR code on the printable flyer**, e.g. `https://pokeguru.example.com` (no trailing slash). Empty = derive from the browser and skip the sitemap; for the flyer the served origin is used only when it looks like a real production address (see below). When set, the build asks TCGdex for the live set list so every `/set/:id` page is listed (static routes only if the API is unreachable). |
| `VITE_BUY_ME_A_PACK_URL` | no | A real support/payment page for “Buy Me a Pack”. When empty the call-to-action renders in a clearly labelled *not configured* state — no fabricated link is ever shown. |
| `DEPLOY_TARGET` | no | `github-pages` builds with the `/PokeGuru/` base path. Leave unset for Vercel and other root-hosted deployments. |

> There is no real donation destination configured in this repository by
> default. If you fork PokeGuru, set `VITE_BUY_ME_A_PACK_URL` to your own page.

---

## 🎴 Printable flyer

Every page footer, the homepage “Share PokeGuru” panel and the About page offer
**🎴 Download PokeGuru Flyer** (and **Print flyer**).

- **File:** `PokeGuru-5x7-QR-Flyer.pdf` — exactly one page, exactly **5 × 7 in
  portrait (127 × 177.8 mm = 360 × 504 pt)**. The PDF is generated in the browser
  on demand, so it is never a stale checked-in binary: one current design, one
  download, no server work.
- **Everything is vector** — text uses the standard Helvetica faces, the artwork
  is native PDF paths and the QR code is one rectangle per module, so it stays
  sharp at any print resolution.
- **The QR code is verified.** `tests/flyer.test.ts` decodes the generated
  matrix with the independent `jsqr` decoder and asserts the payload is the
  production URL, and also re-opens the produced PDF to assert the page count
  and page box.
- **The production address is enforced.** `src/services/flyer/qr.ts` accepts
  `VITE_PUBLIC_SITE_URL` (or, if unset, the origin the app is served from) only
  when it is `https`, has no path/query/hash, and is not `localhost`, `127.x`,
  `*.local`, a sandbox preview (`*.e2b.app`) or a Vercel preview/branch
  deployment. If nothing passes, the buttons show a **configuration warning**
  instead of generating a QR code that would not work once printed — no dummy
  URLs, ever.
- **Print flyer** builds the same vector scene into a print view with
  `@page { size: 127mm 177.8mm; margin: 0 }` and opens the browser’s print
  dialogue, so the page defaults to 5 × 7 in and stays vector. Keep the scale at
  100% / “Actual size” (never “Fit to page”). The design is full-bleed dark, so
  a slightly heavier paper stock keeps it crisp.
- **Wording:** the flyer advertises only shipped features (search, set archive,
  collection, real market prices, free virtual packs) and carries an unofficial
  fan-project disclaimer. No official artwork, logos, character images or
  partnership claims are used.

To point the flyer at your own domain, set `VITE_PUBLIC_SITE_URL` (for example
in the Vercel project’s environment variables) and redeploy; Google Fonts, the
sitemap, canonical tags and the printed QR code all follow that one value.

---

## 🎁 Pack Opening Simulator

| Piece | Where |
| --- | --- |
| Era rules & rarity taxonomy | `src/data/packRules.ts` |
| Catalogue (one cached request per TCGdex series) | `src/services/packCatalogue.ts` |
| Card-pool builder (rarity-filtered briefs) | `src/services/packPools.ts` |
| Random generation engine + odds | `src/services/packEngine.ts` |
| Simulated collection store | `src/services/simStore.ts` |
| Opening experience | `src/components/Packs/*`, `src/pages/PackOpenPage.tsx` |
| Catalogue & collection pages | `src/pages/PacksPage.tsx`, `src/pages/SimCollectionPage.tsx` |

**What is real:** card ids, names, images, expansion membership and rarity all
come from TCGdex. Pools are built by asking for card briefs per rarity, so a
pack never contains a card from another expansion or a card whose rarity we do
not know (unmapped cards are counted and reported on the pack page).

**What is modelled:** TCGdex does not publish booster artwork or per-rarity pull
odds. Wrappers are PokeGuru illustrations built from each set's logo and series
palette, labelled on every pack. Tier odds are derived from the documented pack
size and that set's own rarity mix, and are labelled *estimated* — only the
Scarlet & Violet ten-card structure is marked *documented* (Pokémon's published
contents). There is no pity timer, no boost and no rigged outcome.

**Isolation:** simulated pulls live under `pokeguru_pack_sim_v1`, are never
priced, and are never read by the collection vault, valuation or export code.

---

## 🗂️ Data sources & pricing rules

**Cards** — TCGdex `https://api.tcgdex.net/v2/en`. PokeGuru migrated off the
deprecated Pokémon TCG API (pokemontcg.io), which retires on 1 March 2027.

**Prices** — TCGdex embeds marketplace snapshots on each full card:

- **Cardmarket (EUR)** is the primary source. Its standard print and holofoil
  print are separate bands, and PokeGuru resolves which printing a card has
  before reading a price. A non-holo card is never valued with the holofoil
  band; when a card carries both printings, the other band is shown separately
  as an alternate printing.
- **Headline figure** — Cardmarket `trend`, then `avg`, then 30-day `avg30`, then
  `low`. Every published band (`trend`, `avg`, `low`, 1/7/30-day) is listed with
  its EUR source value and the GBP conversion.
- **Confidence** — each price is labelled `Verified` (fresh trend/average),
  `Indicative` (undated, 7–30 days old, or printing unconfirmed), `Stale` (>30
  days), `Price Unverified` (lowest-listing-only), or `No Data Available`. The
  tooltip always explains the reason.
- **TCGplayer (USD)** is optional and shown in USD only, never silently
  converted. TCGdex has reported gaps in this feed since October 2026, so missing
  values are shown as *No Data Available*.
- **Currency** — the EUR→GBP rate comes from Frankfurter and is cached under
  `pokeguru:fx:eur-gbp:v1`. The app never uses a hard-coded rate; if the rate
  cannot be fetched, GBP values are withheld (`fx-missing`) rather than guessed.
- Every price block shows the marketplace update date, the FX rate date, the
  matched card id and the matched printing.

**What PokeGuru deliberately does not do:** graded/PSA valuations, price
history charts, “market trends”, sales feeds or estimated portfolio returns.
That data is not available from the free upstream APIs, so it is not displayed.

---

## 🖼️ Images & caching

- Card thumbnails use TCGdex’s `low` variant; detail pages use `high`.
- Images are lazy-loaded below the fold, above-the-fold artwork is eager, and
  every image has explicit dimensions to avoid layout shift.
- Requests are deduplicated in-memory, persisted in `localStorage` with typed
  TTLs, and aborted via `AbortSignal` when a query changes — stale responses can
  never overwrite newer ones.
- Page size is 24 cards (down from 250) with URL-driven pagination.

---

## 🔍 Card scanner

The scanner uses Tesseract.js, downloaded from jsDelivr the first time you open
it — the main bundle stays small for everyone who never scans. Text is parsed
into candidate names/collector numbers, cross-checked against the real database,
and presented for confirmation with a confidence score. If OCR fails or the
network is unavailable, the scanner says so; it never pretends to have found a
card.

---

## 📲 PWA

- Valid web manifest with 192/512/maskable icons, theme colours and shortcuts.
- Service worker caches the app shell and hashed assets, serves an offline
  fallback for navigations, and uses stale-while-revalidate for card data with a
  bounded cache (250 entries).
- Cached/offline data is labelled in the UI.
- Updates are non-blocking: a prompt appears, and `SKIP_WAITING` swaps versions
  on your next action instead of pinning an old build.
- **Install invitation** (`src/components/UI/InstallPrompt.tsx`): a branded
  “Take PokeGuru with you!” card appears ~7 s after load, only when the browser
  can actually install the app (`beforeinstallprompt` has fired) or on iOS,
  where it explains the Safari “Add to Home Screen” route instead of pretending
  a one-tap prompt exists. The browser’s own install dialogue is opened **only**
  after the visitor chooses *Install PokeGuru*; *Maybe later* or a dismissal is
  remembered in `localStorage` for 60 days, and the card never appears when the
  app is already installed (standalone display mode).

---

## 🧪 Testing

```bash
npm run lint        # ESLint (typescript-eslint + react-hooks)
npm run typecheck   # strict TypeScript
npm test            # 132 tests / 16 files
npm run build       # production build smoke test
```

Covered:

- TCGdex adapter mapping, search filters/URL construction, pagination and sort
  fallback, abort handling, error kinds.
- Frankfurter rate parsing, caching, stale-rate fallback, EUR→GBP conversion.
- Pricing engine: printing resolution, no cross-printing leakage, band
  selection, confidence ratings (verified/indicative/stale/unverified/
  unavailable), missing-FX handling, alternate printings, formatting and
  “No Data Available”.
- Search param parsing/serialisation (filters, pagination, sort).
- Collection persistence, legacy pokemontcg.io migration, subscription updates.
- OCR text parsing, candidate scoring and rejection of rules text.
- Pack rules: every era rule totals its configured pack size, every booster
  series resolves to a rule, only Scarlet & Violet is marked *documented*, and
  promo/energy/deck products are excluded.
- Pack engine: cards only come from the selected set, sizes and guaranteed slots
  hold, rarities stay inside their slot, no duplicate cards, reverse/holo
  finishes, deterministic seeds, statistical weight tolerance, honest fallbacks
  and a hard failure when the pool has no usable cards.
- Pack catalogue + pool builder: series-based catalogue, promo filtering,
  curated release-date joins, leaky upstream responses rejected, missing
  rarity data reported instead of guessed, network failures surfaced.
- Simulated collection store: duplicate counts, persistence, history cap, rapid
  openings, corrupt-storage recovery, and a guarantee that the real collection
  key is never touched.
- Opening experience: sealed → open → summary flow, batch opening, no cards
  generated before the user opens the pack.
- Result highlights: card counts, multi-rare detection and best-tier badges
  derived only from the cards actually drawn.
- Route rendering for deep links (`/card/:id`, `/search?q=`, `/collection`,
  `/packs`, `/packs/collection`, unknown routes) with mocked network fixtures
  that are never shipped.

Fixtures live in `tests/` and are only used by Vitest.

Not automated in this repository: Lighthouse/Core Web Vitals runs and
cross-browser visual regression tests. The production bundle sizes above come
from `npm run build`, and the live deployment is smoke-tested by loading `/`,
`/search?q=…`, `/card/:id`, `/sets`, `/collection`, `/scanner` and `/about`.

---

## 📈 Measured performance

Production build, before → after this upgrade:

| Metric | Before | After |
| --- | --- | --- |
| JS entry (gzip) | 110.21 kB | **98.40 kB** (−10.7%) |
| CSS (gzip) | 9.51 kB | 9.80 kB (+0.3 kB, more components) |
| Production sourcemaps | 1.68 MB `.map` shipped | none |
| Route chunks | single bundle | 15 lazy chunks (search 2.72 kB, set pages ≈2.5 kB, scanner 6.02 kB gzip) |
| Image requests | full-size artwork in every tile | 245×337 WebP thumbnails, with a fallback chain if a variant is missing |
| JS entry after V3 (gzip) | 98.40 kB | **79.52 kB** |
| CSS after V3 (gzip) | 9.80 kB | 11.91 kB (design-system tokens, still one file) |
| Cards fetched per search | 250 | 24 |
| Requests per search | 1 huge list | 1 page + throttled detail hydration (concurrency 5) |

The homepage is the only eagerly loaded route; everything else is fetched on
navigation.

---

## ☁️ Deployment

### Vercel (primary)

The project is deployed at **https://pokeguru.vercel.app** (production alias).

1. Import `DLinacre/PokeGuru` in Vercel — `vercel.json` already pins the Vite
   framework, `npm ci`, `npm run build` and the `dist` output directory.
2. Add `VITE_PUBLIC_SITE_URL` (your production URL) and, if you have one,
   `VITE_BUY_ME_A_PACK_URL`.
3. SPA rewrites send `/search`, `/card/:id`, `/sets`, `/collection` and
   `/scanner` to `index.html`, so refreshes and direct links work.
4. `main` deploys to production; pull requests get preview deployments.
5. Security headers (including a CSP that allows TCGdex, Frankfurter and the
   Tesseract CDN), immutable asset caching and `no-store` on `sw.js` are all in
   `vercel.json`.
6. Set `VITE_PUBLIC_SITE_URL=https://pokeguru.vercel.app` in the project so
   canonical tags, `sitemap.xml` and `robots.txt` are generated for the real
   origin.

`VITE_PUBLIC_SITE_URL` is already set to `https://pokeguru.vercel.app` in the
project, so canonical tags, `robots.txt` and `sitemap.xml` are generated for the
real origin.

**Git auto-deploy note:** the project is connected to `DLinacre/PokeGuru` and
production deployments have been produced from `main` commits. If a new commit
does not trigger a deployment, check Vercel → Project → Settings → Git and
confirm the GitHub app still has access to `DLinacre/PokeGuru`, with `main` as
the production branch and preview deployments enabled.
3. Set `VITE_PUBLIC_SITE_URL` (already present) in all environments.

## GitHub Pages (secondary, currently paused)

`npm run build:pages` builds with the `/PokeGuru/` base path. Pages is a mirror
only — Vercel is the primary host.

The `Deploy to GitHub Pages` workflow is manual (`workflow_dispatch`) while the
repository's `github-pages` environment only allows the `gh-pages` branch:

1. Repo → **Settings → Environments → github-pages → Deployment branches and
   tags** → add `main` (the Actions token cannot change this policy).
2. Then re-add `push: branches: [main]` to `.github/workflows/deploy.yml`.

---

## 🖼️ GitHub presentation

- Repository social preview: upload `assets/banner.jpg` (1280×640) in
  **Settings → General → Social preview**. GitHub has no API for this, so it is
  a one-off manual upload.
- The README banner uses the same image from `assets/`.
- Screenshots of the finished app are taken from the live site; do not commit
  mock-ups or fabricated UI captures.

---

## 🔐 Privacy

- No accounts, analytics, trackers or cookies.
- Your collection never leaves the browser; there is no PokeGuru backend.
- Outbound requests go only to TCGdex, Frankfurter and (when scanning)
  jsDelivr/Tesseract.
- `SECURITY.md` explains how to report a vulnerability.

---

## 👋 Buy Me a Pack

PokeGuru is free and ad-free. If it helps you, you can buy the maintainer a pack
of Pokémon cards — the link is configured with `VITE_BUY_ME_A_PACK_URL` and
opens with `rel="noopener noreferrer"`.

---

## 📄 License

MIT — see [LICENSE](LICENSE). Pokémon and Pokémon TCG are trademarks of their
respective owners; this is an unofficial fan project.
