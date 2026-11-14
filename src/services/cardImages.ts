/**
 * Central card-artwork resolution.
 *
 * Every card image in PokeGuru comes from TCGdex, whose asset URLs have no file
 * extension: an API card carries `https://assets.tcgdex.net/en/sv/sv06.5/016`
 * and the caller appends `/{quality}.{format}` — quality is `low` (245×337) or
 * `high` (600×825), format is `webp` (preferred), `png` or `jpg`.
 *
 * Before this module existed each component built its own URL, which produced
 * duplicated extensions (`.../016.webp/low.webp`), no alternatives when one
 * derivative was missing, and no way to recover from a failed request. This
 * module is the single place that knows how to turn anything we might hold —
 * an API base, a legacy full URL, a saved pool entry — into an ordered list of
 * valid candidate URLs.
 *
 * Rules:
 *  - never invent a URL: no base ⇒ no candidates;
 *  - never append an extension twice;
 *  - cheapest/most appropriate derivative first for the context;
 *  - other published derivatives after it, so a missing format is survivable.
 */

export type CardImageSize = "thumb" | "full";

export interface CardImageCandidate {
  url: string;
  quality: "low" | "high";
  format: "webp" | "png" | "jpg";
  /** True when this is the asset the card page should ideally show. */
  preferred: boolean;
}

export interface CardImageSource {
  /** TCGdex asset base with no quality/extension, e.g. …/en/sv/sv06.5/016 */
  base?: string;
  /** Absolute URLs we already have (legacy records, saved pools, proxies). */
  direct: string[];
}

const TCGDEX_HOST = "https://assets.tcgdex.net";
const EXTENSION_RE = /\.(webp|png|jpe?g|svg)$/i;
const QUALITY_SUFFIX_RE = /\/(low|high)\.(webp|png|jpe?g)$/i;
const ASSET_PATH_RE = /^\/(?:en|fr|de|es|it|pt|nl|pl|ru|ja|ko|zh-cn|zh-tw|zh-hant|id|th|univ)\/[A-Za-z0-9._/-]+$/;

/** Derivatives in priority order for each context. */
const DERIVATIVES: Record<CardImageSize, Array<{ quality: "low" | "high"; format: "webp" | "png" | "jpg" }>> = {
  // Grids: 245×337 is plenty and much cheaper.
  thumb: [
    { quality: "low", format: "webp" },
    { quality: "low", format: "png" },
    { quality: "high", format: "webp" },
    { quality: "high", format: "png" },
  ],
  // Detail pages and pack reveals: the big scan first, then the thumbnail.
  full: [
    { quality: "high", format: "webp" },
    { quality: "high", format: "png" },
    { quality: "low", format: "webp" },
    { quality: "low", format: "png" },
  ],
};

/**
 * Normalises anything we hold into a TCGdex asset base.
 *
 * Accepts `…/016`, `…/016.webp`, `…/016/low.webp` and returns `…/016`.
 * Returns undefined for values that are not TCGdex assets, so callers never
 * fabricate a URL for a card that has no artwork.
 */
export function normaliseImageBase(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  let trimmed = value.trim();
  if (!trimmed) return undefined;

  // Saved data may carry query strings or fragments from older builds.
  trimmed = trimmed.split("#")[0].split("?")[0].replace(/\/+$/, "");
  if (!trimmed) return undefined;

  if (!/^https?:\/\//i.test(trimmed)) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.hostname !== "assets.tcgdex.net") return undefined;
  if (!ASSET_PATH_RE.test(url.pathname)) return undefined;

  const path = url.pathname.replace(QUALITY_SUFFIX_RE, "").replace(EXTENSION_RE, "");
  if (!path || !ASSET_PATH_RE.test(path)) return undefined;
  return `${TCGDEX_HOST}${path}`;
}

/** Path under assets.tcgdex.net, e.g. `/en/sv/sv06.5/016`. */
export function imageBasePath(base: string | undefined): string | undefined {
  const normalised = normaliseImageBase(base);
  if (!normalised) return undefined;
  return normalised.slice(TCGDEX_HOST.length);
}

/** The canonical URL for one derivative of a card. */
export function imageUrlFor(base: string, quality: "low" | "high", format: "webp" | "png" | "jpg"): string | undefined {
  const normalised = normaliseImageBase(base);
  if (!normalised) return undefined;
  return `${normalised}/${quality}.${format}`;
}

/**
 * Collects every usable source for a card. `imageBase` is what the TCGdex
 * adapter produces; `images`/`image` cover legacy records and saved pulls.
 */
export function cardImageSource(input: {
  imageBase?: string | null;
  images?: { small?: string; large?: string } | null;
  image?: string | null;
}): CardImageSource {
  const base =
    normaliseImageBase(input.imageBase) ??
    normaliseImageBase(input.image) ??
    normaliseImageBase(input.images?.large) ??
    normaliseImageBase(input.images?.small);

  const direct: string[] = [];
  const pushDirect = (value: string | undefined) => {
    if (!value) return;
    if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) return;
    // A value that resolves to the base is already covered by the derivatives.
    if (base && normaliseImageBase(value) === base) return;
    if (!direct.includes(value)) direct.push(value);
  };
  pushDirect(input.images?.small);
  pushDirect(input.images?.large);
  pushDirect(input.image ?? undefined);

  return { base, direct };
}

/**
 * Ordered candidate URLs for a card, most appropriate first, de-duplicated.
 * An empty array means the provider published no artwork for this card.
 */
export function cardImageCandidates(
  input: {
    imageBase?: string | null;
    images?: { small?: string; large?: string } | null;
    image?: string | null;
  },
  size: CardImageSize = "thumb"
): CardImageCandidate[] {
  const source = cardImageSource(input);
  const candidates: CardImageCandidate[] = [];
  const seen = new Set<string>();

  const add = (url: string | undefined, quality: "low" | "high", format: "webp" | "png" | "jpg", preferred: boolean) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, quality, format, preferred });
  };

  const base = source.base;
  if (base) {
    DERIVATIVES[size].forEach((derivative, index) => {
      add(imageUrlFor(base, derivative.quality, derivative.format), derivative.quality, derivative.format, index === 0);
    });
  }

  for (const url of source.direct) {
    if (!url) continue;
    add(url, "high", "webp", candidates.length === 0);
  }

  return candidates;
}

/** Convenience: the URL that should be tried first, if any. */
export function preferredCardImage(
  input: {
    imageBase?: string | null;
    images?: { small?: string; large?: string } | null;
    image?: string | null;
  },
  size: CardImageSize = "thumb"
): string | undefined {
  return cardImageCandidates(input, size)[0]?.url;
}

/** True when the provider published no artwork for a card (distinct from a load failure). */
export function hasCardArtwork(input: {
  imageBase?: string | null;
  images?: { small?: string; large?: string } | null;
  image?: string | null;
}): boolean {
  return cardImageCandidates(input).length > 0;
}
