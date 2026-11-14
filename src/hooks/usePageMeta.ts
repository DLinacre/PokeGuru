import { useEffect } from "react";

export interface PageMeta {
  title?: string;
  description?: string;
  /** Path used for canonical/OG URLs, e.g. "/card/base1-4". */
  path?: string;
  type?: "website" | "article";
  image?: string;
}

/** Absolute site origin, configured at build time or derived at runtime. */
export function siteOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (typeof configured === "string" && configured.trim()) {
    return configured.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
  }
  return "";
}

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
}

/**
 * Keeps document title, description, canonical and Open Graph tags in sync
 * with the current route. Domain is never invented: it comes from
 * VITE_PUBLIC_SITE_URL or the address the app is actually served from.
 */
export function usePageMeta({ title, description, path, type = "website", image }: PageMeta): void {
  useEffect(() => {
    const fullTitle = title ? `${title} | PokeGuru` : "PokeGuru — The Pokémon Card Guru";
    document.title = fullTitle;

    if (description) {
      upsertMeta('meta[name="description"]', { name: "description", content: description });
    }

    const origin = siteOrigin();
    const relativePath = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const url = origin ? `${origin}${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}` : relativePath;
    const imageUrl = image ? (image.startsWith("http") ? image : `${origin}${image}`) : origin ? `${origin}/og.png` : undefined;

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    if (description) {
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
      upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    }
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    if (imageUrl) {
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    }
  }, [title, description, path, type, image]);
}
