# Release Notes

## [1.10.0] - 2026-11-14

A technical release: prerendered HTML, a real card sitemap, accurate structured
data, browser tests, CI and Windows fixes. No card, pricing, pack or collection
logic changed.

### Added
- **Build-time prerendering** (`build/seo-plugin.ts`, driven by the new
  `src/services/routes.ts` registry). `/`, `/search`, `/sets`, `/packs`,
  `/top-100`, `/wiki`, `/about` and `/flyer` are written as static HTML with
  their own title, description, canonical, Open Graph/Twitter tags, JSON-LD and a
  readable `<main>` — so a crawler that never runs JavaScript sees the right page.
  Vercel serves those files before the SPA rewrite; React still mounts over them
  (`createRoot`, not hydration) and behaves exactly as before.
- **Sitemap index + child sitemaps**: `/sitemap.xml` now lists
  `/sitemaps/pages.xml`, `/sitemaps/sets.xml` and `/sitemaps/cards-N.xml`, built
  from real TCGdex set and card IDs, XML-escaped, chunked below the 50,000-URL
  limit, cached on disk for a day and bounded by a build deadline.
  `sitemap-coverage.json` records how many sets and cards were actually retrieved.
- **Visible breadcrumbs** on card and set pages, mirrored by `BreadcrumbList`
  markup.
- **Playwright browser tests** (`e2e/`) covering navigation, deep links, Back and
  Forward, search URLs, card/set pages, the collection vault and export, pack
  simulator isolation, PWA manifest/service worker/offline fallback, sitemaps,
  responsive overflow at two phone widths, a tablet and desktop, and axe-core
  accessibility checks.
- New unit tests: `tests/prerender-sitemap.test.ts` (12) covering route registry
  rules, head replacement, escaping, chunking and index generation.

### Changed
- **Card pages no longer publish an `Offer`.** A Cardmarket reference valuation
  is not a price PokeGuru sells at, so the old `Product` + `offers` markup is
  replaced with `ItemPage` + `BreadcrumbList` + `ImageObject` and a `Product`
  entity that deliberately has no offers, reviews or availability. Set pages use
  `CollectionPage`. Accuracy over rich-result eligibility.
- **Top 100 candidate pool**: category list extended with further rarity values
  the project already models, per-category discovery counts are stored, and the
  coverage figure only counts candidates still in the current pool. The page now
  states the candidate population, which categories returned nothing, and what
  the list is not. Stored index version bumped to v3 (old caches are discarded).
- **Service worker** no longer replays cached API responses older than 30
  minutes: past that age it prefers the network and falls back to cache only when
  offline, so prices cannot be frozen indefinitely.
- **Entry chunk split**: React/React Router now ship in a long-lived
  `react-vendor` chunk (entry 317 kB → 116 kB; vendor 221 kB cacheable across
  deploys).
- **CI** matches Vercel's Node 26 runtime, adds a Playwright job, and now fails on
  high or critical *production* dependency vulnerabilities instead of allowing
  the audit job to fail silently.
- `npm run build:pages` is a cross-platform Node script (`scripts/build-pages.mjs`)
  instead of `DEPLOY_TARGET=... vite build`, so PowerShell and cmd work.
- Sets, packs and search titles/descriptions now share the prerendered copy, so
  the HTML a crawler receives and the head React writes agree exactly.
- `vercel.json` caches `/sitemaps/*` for an hour.

### Removed
- `src/components/UI/JsonLd.tsx` (only existed to inject the misleading Product
  offer markup).

### Fixed
- Prerendered routes and sitemap entries always point at
  `https://pokeguru.vercel.app`, including from the GitHub Pages mirror.
- `<lastmod>` entries were removed from the sitemap: the build cannot know when an
  upstream card record changed, and a build timestamp is not a modification date.

### Tests (actually run)
- `tsc --noEmit` clean, `eslint .` clean, `vite build` clean.
- `vitest run`: **243 passed / 27 files**.
- Prerender and sitemap verified in the build output: eight static route files,
  `sitemap.xml` index, `sitemaps/pages.xml`, `sitemap-coverage.json`, and a
  JavaScript-disabled check of the served HTML is covered by the Playwright suite.
- Playwright: authored and wired into CI; **not executed in this environment**
  because browser binaries cannot be downloaded here. No browser or Lighthouse
  numbers are claimed above.

## [1.9.0] - 2026-11-14

A branding, SEO and repository-presentation release. No card, pricing, pack or
collection logic changed.

### Branding
- **New logo mark** (`assets/logo-mark.svg`) — an ivory "chase" card with a
  crimson header band and gold guru star, fanned over a deep-blue back card, on a
  dark tile. Replaces the old icon set everywhere: favicon (SVG + 16/32/48/192
  PNG), `apple-touch-icon`, PWA `192`/`512`, a 12 %-padded `maskable` icon, the
  Open Graph image and the GitHub banner.
- **`Brand.tsx` rebuilt** as an inline mirror of the mark with `useId`-scoped
  gradient ids (no id collisions when several marks render), plus a
  `BrandWordmark` and a `compact` variant.
- **New social card** (`assets/social-card.svg` → `public/og.png`, 1200 × 630 and
  a committed 1280 × 640 banner for GitHub) with the wordmark, a three-line
  claim, six feature chips and the live URL.
- **Empty states and loading now carry real artwork**: a new `BrandArtwork`
  component (SVG, no extra request) replaces the generic dashed box, and the
  route skeleton already shows the live mark.
- One generator, `scripts/generate-brand-assets.mjs`, renders every icon and
  social asset (`npm run brand`). The old `generate-icons.mjs` is gone.

### SEO
- **New `src/services/seo.ts`** is the single source of truth for the canonical
  origin (Vercel), canonical-path normalisation, social image dimensions and
  Schema.org builders.
- **Canonicals always point at `https://pokeguru.vercel.app`**, including from
  the GitHub Pages mirror and preview deployments. Query strings and hashes are
  stripped, so `/search?q=…` never becomes a canonical URL.
- **Titles** are formatted once: the site name is appended at most once, and long
  titles are shortened rather than truncated by Google. Fixes the doubled
  “Top 100 … · PokeGuru | PokeGuru” suffix.
- **Indexing directives**: search result views and the 404 page are
  `noindex,follow`; everything else is `index,follow` with
  `max-image-preview:large`.
- **Open Graph/Twitter**: `og:image`/`og:url` are now in the static HTML as well
  as the runtime head, with `og:image:width/height/alt`, `og:image:type`,
  `twitter:card=summary_large_image` and image alt text.
- **Structured data**: `Organization`, `WebSite` (with `SearchAction`) and
  `WebApplication` ship in the static shell; `WebPage` per route, `FAQPage` on the
  home page (matching the new visible FAQ copy) and `ItemList` on Top 100. No
  ratings, review counts or prices are invented.
- **`sitemap.xml`** now carries `lastmod`, per-route `changefreq`/`priority` and
  is generated even when `VITE_PUBLIC_SITE_URL` is unset (it defaults to the
  production origin); `robots.txt` always points at the canonical sitemap.
- `index.html` head rewritten: canonical, robots/googlebot, colour scheme,
  referrer policy, PWA/apple meta, corrected icon paths, and a `<noscript>`
  summary of what the app is.

### Promotion
- **New `ShareLinks` component** — real X/Facebook/Reddit/LinkedIn/WhatsApp/email
  intent links plus a copy-link button, all pointing at the canonical origin. On
  the home page and the flyer page.
- The home page “Share PokeGuru” panel now pairs the share row with the printable
  flyer CTA, and a new **six-question FAQ** gives search results (and readers)
  straight answers about pricing sources, privacy and the simulator.

### Repository
- **README rewritten** around the live Vercel URL: brand banner, what the app is,
  current feature set, tech stack, project structure, quick start, scripts,
  configuration, Vercel deployment, SEO notes, testing, known limitations,
  privacy, contributing and licence.
- Repository metadata corrected: `bugs`/`repository` point at the real repo,
  `homepage` at the live site, and the legacy `npm run deploy` (gh-pages) script
  was removed — the manual workflow uses `build:pages`.
- New `CHANGELOG.md`; version bumped to **1.9.0**.
- GitHub Pages workflow now builds with the Vercel canonical origin, so the mirror
  cannot publish a self-canonicalising sitemap.

### Tests
- New `tests/seo.test.tsx` (15 assertions): canonical origin/path handling, asset
  URLs, single site suffix, long-title shortening, `WebSite`/`WebApplication`
  shape (and the absence of invented ratings), `FAQPage` mirroring, `ItemList`
  numbering and the `@graph` envelope — plus two jsdom tests that drive
  `usePageMeta` and assert the real head output: a query-free canonical,
  index/`noindex` directives, `og:*`/`twitter:*` tags and JSON-LD replacement.
- Full run for this release: `tsc --noEmit` clean, `eslint .` clean,
  `vitest run` **231 passed / 26 files**, `vite build` clean.

## [1.8.0] - 2026-11-14

### Added
- **The flyer has its own page (`/flyer`).** Live preview, download and print
  controls, a three-step “printing it on 5 × 6 photo paper” guide, a “what is on
  it” checklist and a “does the QR scan?” note. Linked from the footer nav, the
  homepage “Share PokeGuru” panel and the About page.
- `/flyer` and `/top-100` added to `sitemap.xml`.

### Changed
- **Flyer is now 5 × 6 in (127 × 152.4 mm = 360 × 432 pt)** for standard 5 × 6
  photo paper. The scene was re-laid out for the shorter sheet: tighter hero,
  same 98 pt QR, badge and legal lines moved up, and a ~6 mm safe margin so
  borderless photo printing cannot clip the artwork. The print view’s
  `@page`/sheet CSS, the PDF page box, the preview aspect ratio, the download
  filename (`PokeGuru-5x6-QR-Flyer.pdf`) and every on-screen dimension all match.
- **Flyer controls no longer appear on every page.** The footer, homepage and
  About page now carry a single link to `/flyer` instead of the download/print
  panel, so the site chrome stays clean.

### Tests
- New coverage for the 5 × 6 in geometry (points, millimetres, page box, print
  CSS, SVG viewBox) and for the layout staying inside the sheet.
- New coverage for the flyer’s dedicated page and for the footer *not* embedding
  the controls.
- The price-confidence test now pins `Date.now()` to the day after its fixture,
  so it no longer turns “verified” into “indicative” purely as wall-clock time
  passes (it had started failing for that reason alone).

## [1.7.2] - 2026-11-14

### Fixed
- **PWA installability ("no installable PWA available").** Three causes fixed:
  - The web app manifest is now emitted per build target (like the service
    worker) so `id`, `start_url`, `scope`, icon and shortcut URLs always sit
    inside the deployment base. The old static manifest had `id: "/"`, which
    is outside the `/PokeGuru/` scope on the GitHub Pages build and made that
    build non-installable. The manifest template lives in
    `src/pwa/manifest-template.json`.
  - `beforeinstallprompt` is now captured in `<head>` before React loads
    (`public/pwa-capture.js`, an external script so the strict CSP allows
    it). Chrome fires the event once; if it fired before React mounted, the
    in-app "Install PokeGuru" invitation could never appear. The component
    now picks up the stashed event on mount and via a re-broadcast event.
  - The GitHub Pages mirror (`dlinacre.github.io/PokeGuru`) was a stale
    August build with no manifest or service worker at all (every path,
    including `/manifest.webmanifest` and `/sw.js`, served the old
    `index.html`). It has been rebuilt from current `main`, so both live
    addresses now serve the current, installable app. Vercel remains the
    primary host.

### Changed
- `package.json` `homepage` and the GitHub repository website link now point
  at the primary Vercel address (`https://pokeguru.vercel.app`), and the
  README carries an explicit "Open the live app" link, so visitors land on
  the current version instead of the mirror.

## [1.7.1] - 2026-11-14

### Fixed
- **Card artwork across the whole app.** Every image is now resolved by one
  module (`src/services/cardImages.ts`) and rendered by one component
  (`<CardArtwork>`), used by the grid, card page, preview modal, collection
  vault, scanner results, header suggestions and the booster simulator.
  - A TCGdex asset base is normalised before use, so a base that already ended
    in `.webp` or `/low.webp` no longer produced `…/016.webp/low.webp`.
  - Each image tries the published derivatives in turn (`low.webp → low.png →
    high.webp → high.png`), so one missing format no longer leaves a hole.
  - The booster simulator stores the asset *base* rather than a hand-built
    `…/low.webp` URL, which was the cause of blank pack faces.
  - Cards whose artwork the provider never published now say **“No artwork”**;
    a card whose image simply failed to load says **“Artwork unavailable”** and
    offers a retry. Both are distinct states and neither renders a broken image.
- **Service worker no longer touches artwork.** `assets.tcgdex.net` and every
  image request bypass the worker entirely, and only complete `basic` responses
  are cached (previously an opaque or error response could be replayed to an
  `<img>`), with quota errors swallowed. Bumping the version invalidates the old
  caches on activation.

### Added
- **Top 100 by value** (`/top-100`) — a ranked list of the most valuable cards by
  Cardmarket trend, one printing per card, GBP with the EUR source figure,
  marketplace update date, FX rate date, coverage/progress reporting and honest
  empty states. Includes name/set search, rarity and era filters and four sorts.
  Linked from the desktop nav, the mobile nav and the footer.
- **Version in the UI** — the footer and the About page show the version from
  `package.json` (injected at build time as `__APP_VERSION__`), so there is one
  source of truth and no invented build numbers.

### Changed
- **Buy Me a Pack** always links to `https://paypal.me/dlinacre16` in a new tab
  with `rel="noopener noreferrer"`. The `VITE_BUY_ME_A_PACK_URL` environment
  variable and the “not configured” state are gone: the button works on every
  deployment with no configuration.

### Removed
- The temporary `/diag.html` diagnostic page.

## [1.0.0] - 2026-06-13

### Added
- **About Page**: New dedicated page with project mission, features, and detailed "Search Tags" documentation.
- **Advanced Filters**: Added "Supertype" and "Rarity" dropdowns to the search page for better card discovery.
- **Release Tracking**: This file to track project milestones.
- **Improved Wiki Navigation**: Links to "Browse" sets in the Wiki are now intelligently disabled for future sets, showing a "Coming Soon" badge instead.

### Fixed
- **XY Set ID**: Corrected the set ID for the main XY expansion from `xy0` to `xy1` to ensure correct card browsing.
- **Regional Formatting**: Standardized date formatting to `en-GB` (DD/MM/YYYY) in set details to match the UK-centric focus of the Wiki.
- **Mobile Header**: Improved spacing and responsiveness of the navigation menu on small screens.

### Changed
- **Footer Updates**: Added direct links to About and Search Tags sections.
- **Search Logic**: Refined the Lucene query builder to handle multiple filters (Type, Rarity, Supertype) simultaneously.

---
*PokeGuru — The ultimate Pokémon TCG database.*
