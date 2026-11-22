# Release Notes

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
