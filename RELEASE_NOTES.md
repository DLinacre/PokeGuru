# Release Notes

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
