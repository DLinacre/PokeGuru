import { useEffect } from "react";
import {
  SITE_NAME,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_PATH,
  SOCIAL_IMAGE_WIDTH,
  absoluteAssetUrl,
  canonicalOrigin,
  canonicalUrl,
  type JsonLd,
} from "../services/seo";

export interface PageMeta {
  /** Page title; the site name is appended automatically. */
  title?: string;
  description?: string;
  /** Route used for the canonical/OG URL, e.g. "/card/base1-4". */
  path?: string;
  type?: "website" | "article";
  /** Absolute or root-relative social image; defaults to the branded card. */
  image?: string;
  imageAlt?: string;
  /**
   * Indexing directive. Defaults to indexable. Use "noindex,follow" for pages
   * that are a *view* of another URL (search results, the 404 page).
   */
  robots?: string;
  /** Structured data for this page (see `src/services/seo.ts`). */
  jsonLd?: JsonLd | null;
  /** Stable id for the page's JSON-LD script element. */
  jsonLdId?: string;
}

const DEFAULT_TITLE = `${SITE_NAME} — The Pokémon Card Guru`;
const DEFAULT_DESCRIPTION =
  "An open Pokémon TCG card database: search every card, browse every set, check Cardmarket reference prices in GBP, keep a private collection and open free virtual booster packs.";
const DEFAULT_ROBOTS = "index,follow,max-image-preview:large,max-snippet:-1";

/** Absolute site origin used for canonical and social URLs. */
export function siteOrigin(): string {
  return canonicalOrigin();
}

function upsertTag(selector: string, tag: "meta" | "link", attrs: Record<string, string>): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
  return el;
}

/**
 * Strips a trailing site name from a page title so we never render
 * "Top 100 · PokeGuru | PokeGuru".
 */
export function formatTitle(title?: string): string {
  if (!title) return DEFAULT_TITLE;
  const cleaned = title.replace(/\s*[|·—-]\s*PokeGuru\s*$/i, "").trim();
  if (!cleaned) return DEFAULT_TITLE;
  if (cleaned.length > 58) return `${cleaned.slice(0, 57).trimEnd()}… | ${SITE_NAME}`;
  return `${cleaned} | ${SITE_NAME}`;
}

/**
 * Keeps document title, description, canonical, robots, Open Graph/Twitter tags
 * and page-level JSON-LD in sync with the current route.
 *
 * Every absolute URL is derived from `canonicalOrigin()` (Vercel production), so
 * the GitHub Pages mirror and preview deployments never claim to be canonical.
 */
export function usePageMeta({
  title,
  description,
  path,
  type = "website",
  image,
  imageAlt,
  robots,
  jsonLd,
  jsonLdId = "page-jsonld",
}: PageMeta): void {
  useEffect(() => {
    const fullTitle = formatTitle(title);
    const metaDescription = description?.trim() || DEFAULT_DESCRIPTION;
    document.title = fullTitle;

    upsertTag('meta[name="description"]', "meta", { name: "description", content: metaDescription });

    const routePath = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const url = canonicalUrl(routePath);
    const imageUrl = absoluteAssetUrl(image ?? SOCIAL_IMAGE_PATH);
    const alt = imageAlt ?? "PokeGuru — an open Pokémon TCG database with GBP reference prices and a free pack-opening simulator";

    upsertTag('link[rel="canonical"]', "link", { rel: "canonical", href: url });

    upsertTag('meta[name="robots"]', "meta", { name: "robots", content: robots ?? DEFAULT_ROBOTS });
    upsertTag('meta[name="googlebot"]', "meta", { name: "googlebot", content: robots ?? DEFAULT_ROBOTS });

    upsertTag('meta[property="og:type"]', "meta", { property: "og:type", content: type });
    upsertTag('meta[property="og:site_name"]', "meta", { property: "og:site_name", content: SITE_NAME });
    upsertTag('meta[property="og:locale"]', "meta", { property: "og:locale", content: "en_GB" });
    upsertTag('meta[property="og:title"]', "meta", { property: "og:title", content: fullTitle });
    upsertTag('meta[property="og:description"]', "meta", { property: "og:description", content: metaDescription });
    upsertTag('meta[property="og:url"]', "meta", { property: "og:url", content: url });
    upsertTag('meta[property="og:image"]', "meta", { property: "og:image", content: imageUrl });
    upsertTag('meta[property="og:image:secure_url"]', "meta", {
      property: "og:image:secure_url",
      content: imageUrl,
    });
    upsertTag('meta[property="og:image:type"]', "meta", { property: "og:image:type", content: "image/png" });
    upsertTag('meta[property="og:image:width"]', "meta", {
      property: "og:image:width",
      content: String(SOCIAL_IMAGE_WIDTH),
    });
    upsertTag('meta[property="og:image:height"]', "meta", {
      property: "og:image:height",
      content: String(SOCIAL_IMAGE_HEIGHT),
    });
    upsertTag('meta[property="og:image:alt"]', "meta", { property: "og:image:alt", content: alt });

    upsertTag('meta[name="twitter:card"]', "meta", { name: "twitter:card", content: "summary_large_image" });
    upsertTag('meta[name="twitter:title"]', "meta", { name: "twitter:title", content: fullTitle });
    upsertTag('meta[name="twitter:description"]', "meta", { name: "twitter:description", content: metaDescription });
    upsertTag('meta[name="twitter:image"]', "meta", { name: "twitter:image", content: imageUrl });
    upsertTag('meta[name="twitter:image:alt"]', "meta", { name: "twitter:image:alt", content: alt });
    upsertTag('meta[name="twitter:url"]', "meta", { name: "twitter:url", content: url });

    // Page-level structured data: replaced on every navigation so a card page
    // never leaves its schema behind on the next route.
    const existing = document.getElementById(jsonLdId);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = jsonLdId;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

  }, [title, description, path, type, image, imageAlt, robots, jsonLd, jsonLdId]);
}
