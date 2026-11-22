# Changelog

All notable changes to PokeGuru. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

Detailed prose for each release — including the tests that were actually run —
lives in [RELEASE_NOTES.md](RELEASE_NOTES.md).

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
