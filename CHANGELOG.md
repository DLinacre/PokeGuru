# Changelog

All notable changes to PokeGuru. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Detailed prose for each release — including the tests that were actually run —
lives in [RELEASE_NOTES.md](RELEASE_NOTES.md).

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

## [Unreleased]

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
