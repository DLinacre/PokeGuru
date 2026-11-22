/**
 * Build-time SEO: prerendered HTML and a real sitemap.
 *
 * What this plugin does, and why
 * ------------------------------
 * PokeGuru is a static SPA on Vercel. That is fine for people, but a crawler
 * that does not run JavaScript would otherwise see one generic HTML shell for
 * every URL. This plugin closes that gap without a framework migration:
 *
 *  1. **Prerendering** — for each `prerender` route in `src/services/routes.ts`
 *     it writes `<route>.html` next to `index.html`, containing that route's
 *     title, description, canonical, Open Graph/Twitter tags, JSON-LD and a
 *     readable body. Vercel serves a static file before applying the SPA
 *     rewrite, so `/sets` returns real, route-specific HTML. Once React mounts
 *     it replaces the body (`createRoot`, not hydration), so there is no
 *     mismatch.
 *  2. **Sitemap** — a sitemap *index* plus child sitemaps for pages, sets and
 *     real card IDs read from TCGdex. Sizes are chunked below Google's 50,000
 *     URL / 50 MB limits, every URL is XML-escaped, and every entry points at
 *     the canonical production origin.
 *  3. **Honest coverage** — `sitemap-coverage.json` records how many set and
 *     card pages were actually retrieved, so a network failure during a build
 *     can never be mistaken for a complete catalogue.
 *
 * No modification dates are emitted: this build cannot know when an upstream
 * card record last changed, and inventing one is worse than omitting it.
 */

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  PRODUCTION_ORIGIN,
  canonicalUrl,
  faqSchema,
  graph,
  webPageSchema,
  type JsonLd,
} from "../src/services/seo";
import { HOME_FAQ, PRERENDER_ROUTES, SITEMAP_ROUTES, type PublicRoute } from "../src/services/routes";

const API = "https://api.tcgdex.net/v2/en";
const CACHE_DIR = ".cache/tcgdex";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_URLS_PER_FILE = 45_000;
const FETCH_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 10_000;
const BUILD_BUDGET_MS = 120_000;
const FETCH_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

interface SetRef {
  id: string;
  name?: string;
}

export interface Catalogue {
  sets: SetRef[];
  cards: string[];
  setsSource: "api" | "cache" | "unavailable";
  setDetailSucceeded: number;
  setDetailFailed: number;
  setDetailSkipped: number;
}

/** Escapes text for XML text nodes and attributes. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cachePath(...segments: string[]): string {
  return path.join(CACHE_DIR, ...segments);
}

async function readCache<T>(file: string): Promise<T | null> {
  try {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeCache(file: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch {
    /* a read-only cache directory must never fail the build */
  }
}

/**
 * Fetches JSON, retrying transient failures. A single dropped connection during
 * a build used to collapse the whole sitemap to static pages only, which is a
 * much worse outcome than spending a couple of extra seconds here. 4xx responses
 * other than 429 are treated as permanent: a bad id should fail fast.
 */
async function fetchJson<T>(url: string, signal?: AbortSignal, attempts = FETCH_ATTEMPTS): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let retryable: boolean;
    try {
      const response = await fetch(url, { signal: combined, headers: { accept: "application/json" } });
      if (response.ok) return (await response.json()) as T;
      retryable = response.status === 429 || response.status >= 500;
    } catch {
      retryable = true;
    }
    if (!retryable || attempt === attempts) return null;
    await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * attempt));
  }
  return null;
}

/**
 * Reads the real set list and each set's card IDs. Cached on disk for a day so
 * repeat builds (and CI runs) do not re-download the catalogue, and bounded by
 * a deadline so an unavailable API can never hang a deployment.
 */
async function loadCatalogue(warn: (message: string) => void): Promise<Catalogue> {
  const catalogue: Catalogue = {
    sets: [],
    cards: [],
    setsSource: "unavailable",
    setDetailSucceeded: 0,
    setDetailFailed: 0,
    setDetailSkipped: 0,
  };

  const setsFile = cachePath("sets.json");
  let sets = await readCache<SetRef[]>(setsFile);
  if (sets) {
    catalogue.setsSource = "cache";
  } else {
    const fetched = await fetchJson<SetRef[]>(`${API}/sets`);
    if (Array.isArray(fetched)) {
      sets = fetched
        .filter((entry): entry is SetRef => Boolean(entry) && typeof entry === "object" && typeof entry.id === "string")
        .map((entry) => ({ id: entry.id, name: typeof entry.name === "string" ? entry.name : undefined }))
        .filter((entry) => /^[a-z0-9.-]+$/i.test(entry.id));
      writeCache(setsFile, sets);
      catalogue.setsSource = "api";
    }
  }

  if (!sets?.length) {
    warn("[seo] TCGdex set list unavailable — sitemap will list static pages only.");
    return catalogue;
  }
  catalogue.sets = sets;

  const deadline = Date.now() + BUILD_BUDGET_MS;
  const signal = AbortSignal.timeout(BUILD_BUDGET_MS);
  const queue = [...sets];
  const cards = new Set<string>();

  const worker = async (): Promise<void> => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      if (Date.now() > deadline) {
        catalogue.setDetailSkipped += 1;
        continue;
      }
      const file = cachePath("sets", `${next.id}.json`);
      let detail = await readCache<{ cards?: { id?: unknown }[] }>(file);
      if (!detail) {
        detail = await fetchJson<{ cards?: { id?: unknown }[] }>(`${API}/sets/${encodeURIComponent(next.id)}`, signal);
        if (detail) writeCache(file, detail);
      }
      if (!detail || !Array.isArray(detail.cards)) {
        catalogue.setDetailFailed += 1;
        continue;
      }
      catalogue.setDetailSucceeded += 1;
      for (const card of detail.cards) {
        if (card && typeof card.id === "string" && /^[a-z0-9.-]+$/i.test(card.id)) cards.add(card.id);
      }
    }
  };

  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
  catalogue.cards = [...cards].sort();
  return catalogue;
}

export interface SitemapFile {
  path: string;
  urls: { loc: string; changefreq?: string; priority?: string }[];
}

export function buildSitemapFiles(siteUrl: string, catalogue: Catalogue): SitemapFile[] {
  const files: SitemapFile[] = [];

  files.push({
    path: "pages.xml",
    urls: SITEMAP_ROUTES.map((route) => ({
      loc: route.path === "/" ? `${siteUrl}/` : `${siteUrl}${route.path}`,
      changefreq: route.changefreq,
      priority: route.priority,
    })),
  });

  if (catalogue.sets.length) {
    files.push({
      path: "sets.xml",
      urls: catalogue.sets.map((set) => ({
        loc: `${siteUrl}/set/${encodeURIComponent(set.id)}`,
        changefreq: "monthly",
        priority: "0.6",
      })),
    });
  }

  for (let index = 0; index < catalogue.cards.length; index += MAX_URLS_PER_FILE) {
    const chunk = catalogue.cards.slice(index, index + MAX_URLS_PER_FILE);
    const part = index / MAX_URLS_PER_FILE + 1;
    files.push({
      path: `cards-${part}.xml`,
      urls: chunk.map((id) => ({
        loc: `${siteUrl}/card/${encodeURIComponent(id)}`,
        changefreq: "monthly",
        priority: "0.5",
      })),
    });
  }

  return files;
}

export function renderUrlset(file: SitemapFile): string {
  const urls = file.urls
    .map((url) => {
      const parts = [`    <loc>${escapeXml(url.loc)}</loc>`];
      if (url.changefreq) parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
      if (url.priority) parts.push(`    <priority>${url.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderIndex(siteUrl: string, files: SitemapFile[]): string {
  const entries = files
    .map((file) => `  <sitemap>\n    <loc>${escapeXml(`${siteUrl}/sitemaps/${file.path}`)}</loc>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

/** Replaces a single `<meta>`/`<link>`/`<title>` value in the built head. */
function replaceHead(html: string, route: PublicRoute, siteUrl: string): string {
  const title = `${route.title} | PokeGuru`;
  const canonical = canonicalUrl(route.path);
  const robots = route.indexable
    ? "index,follow,max-image-preview:large,max-snippet:-1"
    : "noindex,follow";
  const socialImage = `${siteUrl}/og.png`;
  const socialAlt = `PokeGuru — ${route.title}`;

  let output = html;
  output = output.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttribute(title)}</title>`);
  output = output.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escapeHtmlAttribute(route.description)}" />`
  );
  output = output.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${escapeHtmlAttribute(canonical)}" />`
  );
  output = output.replace(
    /<meta name="robots" content="[^"]*" \/>/,
    `<meta name="robots" content="${robots}" />`
  );
  output = output.replace(
    /<meta name="googlebot" content="[^"]*" \/>/,
    `<meta name="googlebot" content="${robots}" />`
  );
  output = output.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtmlAttribute(title)}" />`
  );
  output = output.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escapeHtmlAttribute(route.description)}" />`
  );
  output = output.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${escapeHtmlAttribute(canonical)}" />`
  );
  output = output.replace(
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${escapeHtmlAttribute(socialImage)}" />`
  );
  output = output.replace(
    /<meta property="og:image:secure_url" content="[^"]*" \/>/,
    `<meta property="og:image:secure_url" content="${escapeHtmlAttribute(socialImage)}" />`
  );
  output = output.replace(
    /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:image:alt" content="${escapeHtmlAttribute(socialAlt)}" />`
  );
  output = output.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtmlAttribute(title)}" />`
  );
  output = output.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(route.description)}" />`
  );
  output = output.replace(
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${escapeHtmlAttribute(canonical)}" />`
  );
  return output;
}

function renderJsonLd(route: PublicRoute): string {
  const nodes: JsonLd[] = [
    webPageSchema({ name: route.title, description: route.description, path: route.path }),
  ];
  if (route.path === "/") nodes.push(faqSchema(HOME_FAQ));
  const data = graph(...nodes);
  // JSON.stringify output is escaped for `</script>` safety.
  return `<script type="application/ld+json" id="prerender-jsonld">${JSON.stringify(data).replace(
    /</g,
    "\\u003c"
  )}</script>`;
}

function renderStaticBody(route: PublicRoute): string {
  const links = (route.links ?? [])
    .map((link) => `        <li><a href="${escapeHtmlAttribute(link.href)}">${escapeHtmlAttribute(link.label)}</a></li>`)
    .join("\n");
  const paragraphs = route.body.map((text) => `      <p>${escapeHtmlAttribute(text)}</p>`).join("\n");
  return `<div id="root"><main style="max-width:46rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#e7e9ee;background:#08090d">
      <p style="font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#9aa3b2"><a href="/" style="color:#f04452;text-decoration:none">PokeGuru</a> · pokeguru.vercel.app</p>
      <h1 style="font-size:2rem;line-height:1.15;margin:.5rem 0 1rem">${escapeHtmlAttribute(route.heading)}</h1>
${paragraphs}
${links ? `      <nav aria-label="PokeGuru pages">\n      <ul>\n${links}\n      </ul>\n      </nav>` : ""}
      <p style="color:#9aa3b2;font-size:.85rem">This page needs JavaScript for the interactive card database. Everything described above is available at <a href="/" style="color:#f5a524">pokeguru.vercel.app</a>.</p>
    </main></div>`;
}

/** Public for tests: turns the built shell into a route-specific page. */
export function prerenderHtml(html: string, route: PublicRoute, siteUrl: string): string {
  const withHead = replaceHead(html, route, siteUrl);
  const withJsonLd = withHead.replace("</head>", `    ${renderJsonLd(route)}\n  </head>`);
  return withJsonLd.replace('<div id="root"></div>', renderStaticBody(route));
}

export interface SeoPluginOptions {
  siteUrl: string;
  /** Only the canonical host is prerendered; the GitHub Pages mirror is not. */
  enabled: boolean;
  outDir: string;
}

export function seoFiles(options: SeoPluginOptions): Plugin {
  const siteUrl = options.siteUrl.replace(/\/+$/, "");
  let resolvedOutDir = options.outDir;
  let catalogue: Catalogue = {
    sets: [],
    cards: [],
    setsSource: "unavailable",
    setDetailSucceeded: 0,
    setDetailFailed: 0,
    setDetailSkipped: 0,
  };

  return {
    name: "pokeguru-seo",
    apply: "build",
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      if (!options.enabled) return;
      // `SEO_OFFLINE=1` keeps unit-test/CI builds fast and hermetic; the sitemap
      // then lists static pages only and says so in sitemap-coverage.json.
      if (process.env.SEO_OFFLINE === "1") {
        this.warn?.("[seo] SEO_OFFLINE=1 — sitemap will list static pages only.");
        return;
      }
      catalogue = await loadCatalogue((message) => this.warn(message));
      this.warn?.(
        `[seo] catalogue: ${catalogue.sets.length} sets, ${catalogue.cards.length} cards ` +
          `(set details ok=${catalogue.setDetailSucceeded} failed=${catalogue.setDetailFailed} skipped=${catalogue.setDetailSkipped}, source=${catalogue.setsSource})`
      );
    },
    writeBundle() {
      if (!options.enabled) return;
      const indexPath = path.join(resolvedOutDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const shell = fs.readFileSync(indexPath, "utf8");

      for (const route of PRERENDER_ROUTES) {
        const file = path.join(resolvedOutDir, `${route.path.replace(/^\//, "") || "index"}.html`);
        if (route.path === "/") continue; // index.html is already the home page shell
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, prerenderHtml(shell, route, siteUrl));
      }
      // The home page keeps its filename but gets the same treatment.
      const home = PRERENDER_ROUTES.find((route) => route.path === "/");
      if (home) fs.writeFileSync(indexPath, prerenderHtml(shell, home, siteUrl));

      const files = buildSitemapFiles(siteUrl, catalogue);
      const sitemapDir = path.join(resolvedOutDir, "sitemaps");
      fs.mkdirSync(sitemapDir, { recursive: true });
      for (const file of files) fs.writeFileSync(path.join(sitemapDir, file.path), renderUrlset(file));
      fs.writeFileSync(path.join(resolvedOutDir, "sitemap.xml"), renderIndex(siteUrl, files));

      const coverage = {
        generatedAt: new Date().toISOString(),
        canonicalOrigin: siteUrl,
        productionOrigin: PRODUCTION_ORIGIN,
        catalogue: {
          setsSource: catalogue.setsSource,
          sets: catalogue.sets.length,
          cards: catalogue.cards.length,
          setDetailSucceeded: catalogue.setDetailSucceeded,
          setDetailFailed: catalogue.setDetailFailed,
          setDetailSkipped: catalogue.setDetailSkipped,
        },
        counts: {
          pages: SITEMAP_ROUTES.length,
          sets: catalogue.sets.length,
          cards: catalogue.cards.length,
          total: SITEMAP_ROUTES.length + catalogue.sets.length + catalogue.cards.length,
        },
        sitemaps: files.map((file) => ({ path: `/sitemaps/${file.path}`, urls: file.urls.length })),
        notes: [
          "Card and set URLs come from TCGdex at build time; no identifiers are invented.",
          "No lastmod element is emitted: upstream modification dates are not published to this build.",
          "Failure to reach TCGdex degrades coverage; the counts above are what was actually written.",
        ],
      };
      fs.writeFileSync(path.join(resolvedOutDir, "sitemap-coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`);
    },
  };
}
