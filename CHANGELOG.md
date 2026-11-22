# Changelog

All notable changes to PokeGuru. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Detailed prose for each release — including the tests that were actually run —
lives in [RELEASE_NOTES.md](RELEASE_NOTES.md).

## [1.11.1] - 2026-11-14

### Changed
- `/packs` no longer claims simulated pulls are "never valued", which stopped
  being true in 1.11.0. It now describes the figures as Cardmarket reference
  prices for the printing that was opened, not appraisals or offers, and says
  plainly that an unpriced printing is reported rather than guessed. The route
  description used for prerendered copy matches.

### Fixed
- A pulled card whose price lookup failed said *No price*, implying Cardmarket
  had none. It now reads *No data*, and the pack bar says the prices could not be
  loaded instead of claiming nothing is published.
- Clearing the opening history stayed cleared: the v2 loader rebuilt legacy
  entries from pull history on the next visit. Migration now runs only for
  payloads that never had an openings array.
- The running total's screen-reader announcement shared `role="status"` with the
  opening callout; only the callout owns it now, so the announcement is
  unambiguous (and `tests/pack-opening.test.tsx` is green again).
- Opening history listed duplicate pulls under duplicate React keys.
- The keyboard reveal test waited on a synchronous assertion, so it could fail
  mid-update on a loaded machine.

## [1.11.0] - 2026-11-14

### Added
- Market values for every pulled card, with a running pack total, per-card
  prices and an opening summary (`src/services/packValues.ts`,
  `src/hooks/usePackValues.ts`, `PackValueBar`, `PackValueSummary`).
- Finish-aware price matching: a price is used only for the finish that was
  pulled; reverse holofoils report *No price* instead of borrowing another
  printing's value.
- Opening history at `/packs/history` with frozen price snapshots.
- Simulator storage schema v2 with migration from v1.
- `tests/pack-values*.test.*`, `tests/opening-history.test.tsx`,
  `e2e/pack-values.spec.ts`.

### Changed
- Pack prices load progressively (4 concurrent lookups, one per unique card id,
  only for the pack reached) and never block the reveal.
- Summary button reachable with reduced motion enabled.
- Build-time TCGdex requests retry transient failures (3 attempts).
- GitHub Pages and release workflows run on Node 26.

### Fixed
- An opening could be recorded before its prices resolved.

## [1.10.0] - 2026-11-14

### Added
- Build-time prerendering of the eight public routes, driven by a single route
  registry (`src/services/routes.ts`).
- Sitemap index with page, set and real card-ID child sitemaps plus a
  `sitemap-coverage.json` report.
- Visible breadcrumbs on card and set pages, with `BreadcrumbList` markup.
- Playwright + axe-core browser test suite and a CI job for it.
- `tests/prerender-sitemap.test.ts`.

### Changed
- Card structured data: `ItemPage` + `BreadcrumbList` instead of `Product` with an
  `Offer` (a Cardmarket reference value is not a PokeGuru price).
- Top 100: more candidate categories, per-category discovery counts, corrected
  coverage maths, index version 3, clearer methodology panel.
- Service worker: cached API responses older than 30 minutes prefer the network.
- Entry bundle split into app + `react-vendor` chunks.
- CI runs on Node 26, adds browser tests, fails on high/critical production
  vulnerabilities.
- `build:pages` is a cross-platform Node script.
- `vercel.json` rewrites prerendered routes to their static files ahead of the
  SPA catch-all.

### Removed
- `src/components/UI/JsonLd.tsx`.
- `<lastmod>` from the sitemap (not knowable, so not claimed).

## [1.9.0] - 2026-11-14

### Added
- Brand artwork system: new logo mark, favicons, PWA/apple icons, 1200 × 630
  Open Graph image and a 1280 × 640 GitHub banner, all rendered from vector
  sources by `npm run brand`.
- `BrandArtwork` illustration for empty states; `ShareLinks` component with real
  social/email intents and a copy-link button.
- `src/services/seo.ts`: canonical origin, path normalisation, social image
  metadata and Schema.org builders.
- Structured data — `Organization`, `WebSite` + `SearchAction`, `WebApplication`,
  per-route `WebPage`, `FAQPage` on the home page, `ItemList` on Top 100.
- A six-question FAQ on the home page.
- `CHANGELOG.md` and a rewritten `README.md`.

### Changed
- Every canonical, Open Graph and sitemap URL now uses the official Vercel
  origin, including from the GitHub Pages mirror.
- `sitemap.xml` gains `lastmod`, `changefreq` and `priority`, and is generated
  even without `VITE_PUBLIC_SITE_URL`.
- Titles are formatted once — no more doubled site suffix.
- Search result views and the 404 page are `noindex,follow`.
- Version 1.9.0; `repository`/`bugs` metadata and README links corrected.

### Removed
- `scripts/generate-icons.mjs` (superseded by `scripts/generate-brand-assets.mjs`).
- The legacy `npm run deploy` gh-pages script.
- The old `public/og.jpg` and `assets/banner.jpg`.

### Fixed
- Missing `og:image`/`og:url` in the static HTML.
- Canonical URLs that included search query parameters.

## Earlier releases

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for 1.8.0 and before.
