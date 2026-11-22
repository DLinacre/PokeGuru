/**
 * One place for the site's canonical identity and its structured data.
 *
 * Rules this file enforces:
 *  - **Vercel is canonical.** `VITE_PUBLIC_SITE_URL` wins when it is set, and
 *    otherwise the official production address is used, so the GitHub Pages
 *    mirror and any preview URL always point search engines at one URL.
 *  - **No invented facts.** Structured data is built from values the app
 *    actually has (URLs, names, the version in package.json). There are no
 *    ratings, review counts, prices or "award" claims anywhere in it.
 *  - **No duplicate URLs.** Query strings (search terms, sort orders, filters)
 *    are strips for the canonical URL; pages whose URL encodes a query are
 *    marked `noindex` and treated as a view of the canonical page.
 */

/** The official production origin. Vercel is the primary application. */
export const PRODUCTION_ORIGIN = "https://pokeguru.vercel.app";

/** Site name used in titles, Open Graph and structured data. */
export const SITE_NAME = "PokeGuru";

/** Default social card (1200 × 630), rendered from `assets/social-card.svg`. */
export const SOCIAL_IMAGE_PATH = "/og.png";
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

/** Single-sentence description reused as the default meta description. */
export const SITE_TAGLINE = "The Pokémon card guru";

/**
 * The origin search engines should treat as canonical.
 *
 * A configured `VITE_PUBLIC_SITE_URL` is trusted; without it we fall back to the
 * documented production address rather than whatever host happens to be serving
 * the page (a GitHub Pages mirror or a Vercel preview would otherwise canonicalise
 * itself and split ranking signals).
 */
export function canonicalOrigin(): string {
  // `import.meta.env` is undefined when this module is imported by vite.config.ts
  // (build-time HTML/JSON-LD injection), so read it defensively and fall back to
  // the production origin.
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_PUBLIC_SITE_URL;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim().replace(/\/+$/, "");
  }
  return PRODUCTION_ORIGIN;
}

/**
 * Normalises a route into a canonical path: no hash, no tracking parameters and
 * no duplicate slashes. Search/filter state is *not* part of a canonical URL.
 */
export function canonicalPath(pathname: string): string {
  const withoutHash = pathname.split("#")[0] ?? "/";
  const withoutQuery = withoutHash.split("?")[0] ?? "/";
  const collapsed = withoutQuery.replace(/\/{2,}/g, "/");
  if (!collapsed.startsWith("/")) return `/${collapsed}`;
  return collapsed === "" ? "/" : collapsed;
}

/** Absolute canonical URL for a route. */
export function canonicalUrl(pathname: string): string {
  const path = canonicalPath(pathname);
  return `${canonicalOrigin()}${path === "/" ? "" : path}`;
}

/** Absolute URL for a site-relative asset (e.g. the social card). */
export function absoluteAssetUrl(assetPath: string): string {
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${canonicalOrigin()}${assetPath.startsWith("/") ? assetPath : `/${assetPath}`}`;
}

/* ------------------------------------------------------------------------- */
/* Structured data                                                            */
/* ------------------------------------------------------------------------- */

export type JsonLd = Record<string, unknown>;

const ORG_ID = `${PRODUCTION_ORIGIN}/#organization`;
const SITE_ID = `${PRODUCTION_ORIGIN}/#website`;
const APP_ID = `${PRODUCTION_ORIGIN}/#webapp`;

/** The project itself, as a real organisation entity with no invented details. */
export function organizationSchema(): JsonLd {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: `${canonicalOrigin()}/`,
    logo: {
      "@type": "ImageObject",
      url: absoluteAssetUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    sameAs: ["https://github.com/DLinacre/PokeGuru"],
  };
}

/** The site entity, including the on-site search action. */
export function webSiteSchema(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    alternateName: "PokeGuru — The Pokémon Card Guru",
    url: `${canonicalOrigin()}/`,
    inLanguage: "en-GB",
    description:
      "An open Pokémon TCG card database with GBP reference prices, set archives, a private collection vault and a free pack-opening simulator.",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${canonicalOrigin()}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * The application entity. `SoftwareApplication` is accurate: PokeGuru is a free
 * web app with no paid tier, no ratings and no review count to report.
 */
export function webApplicationSchema(): JsonLd {
  return {
    "@type": "WebApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    url: `${PRODUCTION_ORIGIN}/`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-GB",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    description:
      "Search Pokémon TCG cards, browse every set, check Cardmarket reference prices in GBP, keep a private collection and open free virtual booster packs.",
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
  };
}

/** Question/answer pairs — only used where the answers are visible on the page. */
export function faqSchema(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** A visible, ordered list of links (used by the Top 100 page). */
export function itemListSchema(name: string, items: { name: string; url: string }[]): JsonLd {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteAssetUrl(item.url),
    })),
  };
}

/** A generic page entity so each route can be described precisely. */
export function webPageSchema(options: { name: string; description: string; path: string }): JsonLd {
  return {
    "@type": "WebPage",
    name: options.name,
    description: options.description,
    url: canonicalUrl(options.path),
    inLanguage: "en-GB",
    isPartOf: { "@id": SITE_ID },
  };
}

/**
 * Wraps one or more schema objects in a single `@graph` document, with the
 * shared organisation/site entities included once.
 */
export function graph(...nodes: JsonLd[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), webSiteSchema(), webApplicationSchema(), ...nodes],
  };
}
