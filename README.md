<p align="center">
  <img src="assets/banner.svg" alt="PokeGuru Banner" width="100%">
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

# 🃏 PokeGuru — Pokémon TCG card database & collection vault

PokeGuru is a fast, installable Pokémon TCG web app for UK collectors. It searches
the full English card database from [TCGdex](https://tcgdex.dev/), shows
**reference** marketplace prices in GBP, and keeps a personal collection vault in
the browser.

> **Pricing honesty:** PokeGuru does **not** invent values, sales, trends or
> history. Every price comes from a dated marketplace snapshot, and anything the
> upstream API does not provide is displayed as **“No Data Available”**. Values are
> *reference prices*, not offers, appraisals or completed sales. PokeGuru is not
> affiliated with Nintendo, Creatures Inc. or The Pokémon Company.

---

## ✨ Features

- **Search & filter** every English card by name, rarity, category, illustrator,
  set and card number. Filters and pagination are stored in the URL, so results
  survive refresh, deep links and the Back button.
- **Card pages** with large artwork, set/series metadata, illustrator, rarity,
  regulation marks, variants, and Cardmarket (EUR → GBP) plus optional TCGplayer
  (USD) reference pricing.
- **Set archive** — browse expansions by series with card counts, release dates
  and set logos.
- **Collection vault** — add/remove cards, quantities and condition notes.
  Stored in `localStorage` (`pokeguru_collection`) on your device only, and old
  v1.6 collections migrate automatically.
- **Card scanner** — real on-device OCR with Tesseract.js, loaded only when you
  scan. The recognised text is matched against the live database and **you**
  confirm the match; nothing is added silently.
- **UK pricing** — EUR→GBP conversion uses live [Frankfurter](https://frankfurter.dev/)
  rates (cached for 12 h) with the rate date and marketplace update date shown.
- **Offline-tolerant PWA** — app shell cached, clearly labelled cached data, and
  a safe update prompt that never traps you on an old version.

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
| `VITE_PUBLIC_SITE_URL` | no | Canonical origin used for canonical/OG tags, `sitemap.xml` and absolute `robots.txt` entries, e.g. `https://pokeguru.example.com` (no trailing slash). Empty = derive from the browser. |
| `VITE_BUY_ME_A_PACK_URL` | no | A real support/payment page for “Buy Me a Pack”. When empty the call-to-action renders in a clearly labelled *not configured* state — no fabricated link is ever shown. |
| `DEPLOY_TARGET` | no | `github-pages` builds with the `/PokeGuru/` base path. Leave unset for Vercel and other root-hosted deployments. |

> There is no real donation destination configured in this repository by
> default. If you fork PokeGuru, set `VITE_BUY_ME_A_PACK_URL` to your own page.

---

## 🗂️ Data sources & pricing rules

**Cards** — TCGdex `https://api.tcgdex.net/v2/en`. PokeGuru migrated off the
deprecated Pokémon TCG API (pokemontcg.io), which retires on 1 March 2027.

**Prices** — TCGdex embeds marketplace snapshots on each full card:

- **Cardmarket (EUR)** is the primary source: `trend`, falling back to `avg`,
  then `low`. `low` and 30-day fields are shown only as reference figures.
- **TCGplayer (USD)** is optional; TCGdex has reported gaps in this feed since
  October 2026, so missing values are shown as *No Data Available*.
- **Currency** — the EUR→GBP rate comes from Frankfurter and is cached for 12
  hours under `pokeguru:fx:eur-gbp:v1`. The app never uses a hard-coded rate; if
  the rate cannot be fetched, GBP values are withheld rather than guessed.
- Every price block shows the marketplace’s update date and the FX date, so you
  can judge how fresh it is.

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

---

## 🧪 Testing

```bash
npm run typecheck   # strict TypeScript
npm test            # 47 tests / 8 files
npm run build       # production build smoke test
```

Covered:

- TCGdex adapter mapping, search filters/URL construction, pagination and sort
  fallback, abort handling, error kinds.
- Frankfurter rate parsing, caching, stale-rate fallback, EUR→GBP conversion.
- Price selection/formatting, including “No Data Available”.
- Search param parsing/serialisation (filters, pagination, sort).
- Collection persistence, legacy pokemontcg.io migration, subscription updates.
- OCR text parsing, candidate scoring and rejection of rules text.
- Route rendering for deep links (`/card/:id`, `/search?q=`, `/collection`,
  unknown routes) with mocked network fixtures that are never shipped.

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

**Git auto-deploy note:** the Vercel project exists, but the connected Vercel
GitHub account only has access to the `LIN4CRE` GitHub account, not
`DLinacre/PokeGuru`, so Vercel cannot yet create its own Git deployments.
Until the Vercel GitHub app is granted access to `DLinacre/PokeGuru`, deploys
must be triggered through the Vercel API/CLI. Once access is granted:

1. Vercel → Project → Settings → Git → connect `DLinacre/PokeGuru`.
2. Keep the production branch as `main` and leave preview deployments enabled.
3. Set `VITE_PUBLIC_SITE_URL` (already present) in all environments.

## GitHub Pages (secondary)

`npm run build:pages` (or the `Deploy to GitHub Pages` workflow) builds with the
`/PokeGuru/` base path. Pages is a mirror only — Vercel is the primary host.

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
