import { describe, expect, it } from "vitest";
import {
  MAX_URLS_PER_FILE,
  buildSitemapFiles,
  escapeXml,
  prerenderHtml,
  renderIndex,
  renderUrlset,
  type Catalogue,
} from "../build/seo-plugin";
import { PRERENDER_ROUTES, PUBLIC_ROUTES, SITEMAP_ROUTES, routeByPath } from "../src/services/routes";
import { PRODUCTION_ORIGIN } from "../src/services/seo";

const SITE = "https://pokeguru.vercel.app";

function catalogue(overrides: Partial<Catalogue> = {}): Catalogue {
  return {
    sets: [],
    cards: [],
    setsSource: "api",
    setDetailSucceeded: 0,
    setDetailFailed: 0,
    setDetailSkipped: 0,
    ...overrides,
  };
}

describe("route registry", () => {
  it("marks personal and utility pages noindex and out of the sitemap", () => {
    for (const path of ["/collection", "/scanner", "/packs/collection"]) {
      const route = routeByPath(path);
      expect(route?.indexable, `${path} must be noindex`).toBe(false);
      expect(SITEMAP_ROUTES.map((entry) => entry.path)).not.toContain(path);
    }
  });

  it("only prerenders indexable pages that are worth prerendering", () => {
    expect(PRERENDER_ROUTES.length).toBeGreaterThanOrEqual(8);
    expect(PRERENDER_ROUTES.map((route) => route.path)).toContain("/");
    expect(PRERENDER_ROUTES.every((route) => route.body.length > 0 && route.heading.length > 0)).toBe(true);
  });

  it("never lets two routes claim the same path", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("prerendered HTML", () => {
  const shell = `<!doctype html><html><head>
<title>PokeGuru — default</title>
<meta name="description" content="default" />
<link rel="canonical" href="https://pokeguru.vercel.app/" />
<meta name="robots" content="index,follow" />
<meta name="googlebot" content="index,follow" />
<meta property="og:title" content="default" />
<meta property="og:description" content="default" />
<meta property="og:url" content="https://pokeguru.vercel.app/" />
<meta property="og:image" content="https://pokeguru.vercel.app/og.png" />
<meta property="og:image:secure_url" content="https://pokeguru.vercel.app/og.png" />
<meta property="og:image:alt" content="default" />
<meta name="twitter:title" content="default" />
<meta name="twitter:description" content="default" />
<meta name="twitter:url" content="https://pokeguru.vercel.app/" />
</head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`;

  it("writes route-specific head tags pointing at the canonical host", () => {
    const route = routeByPath("/sets")!;
    const html = prerenderHtml(shell, route, SITE);
    expect(html).toContain(`<title>${route.title} | PokeGuru</title>`);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/sets" />`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}/sets" />`);
    expect(html).toContain(`<meta name="twitter:url" content="${SITE}/sets" />`);
    expect(html).toContain('content="index,follow,max-image-preview:large,max-snippet:-1"');
  });

  it("keeps a readable body and JSON-LD for crawlers without JavaScript", () => {
    const route = routeByPath("/packs")!;
    const html = prerenderHtml(shell, route, SITE);
    expect(html).toContain("<h1");
    expect(html).toContain(route.heading);
    expect(html).toContain('id="prerender-jsonld"');
    expect(html).toContain("WebPage");
    // The app bundle is still there: the page behaves like the SPA once React mounts.
    expect(html).toContain('/assets/app.js');
  });

  it("emits noindex for a non-indexable route", () => {
    const route = routeByPath("/collection")!;
    const html = prerenderHtml(shell, route, SITE);
    expect(html).toContain('<meta name="robots" content="noindex,follow" />');
  });

  it("escapes HTML in generated markup", () => {
    const route = { ...routeByPath("/about")!, hiding: undefined, heading: 'About <script>alert("x")</script>' };
    const html = prerenderHtml(shell, route, SITE);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("sitemap generation", () => {
  it("escapes XML metacharacters", () => {
    expect(escapeXml('a & b < c > d " e \' f')).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
  });

  it("lists only indexable pages when the catalogue is unavailable", () => {
    const files = buildSitemapFiles(SITE, catalogue());
    expect(files).toHaveLength(1);
    const xml = renderUrlset(files[0]);
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).not.toContain("/collection");
    expect(xml).not.toContain("/scanner");
    // No invented modification dates.
    expect(xml).not.toContain("<lastmod>");
  });

  it("chunks card URLs below the 50,000-URL protocol limit", () => {
    const cards = Array.from({ length: MAX_URLS_PER_FILE + 5 }, (_, index) => `t${index}-1`);
    const files = buildSitemapFiles(SITE, catalogue({ cards, sets: [{ id: "base1" }] }));
    const cardFiles = files.filter((file) => file.path.startsWith("cards-"));
    expect(cardFiles).toHaveLength(2);
    expect(cardFiles[0].urls.length).toBe(MAX_URLS_PER_FILE);
    expect(cardFiles[1].urls.length).toBe(5);
    for (const file of files) expect(file.urls.length).toBeLessThanOrEqual(45_000);
  });

  it("builds a well-formed index pointing at absolute child sitemaps", () => {
    const files = buildSitemapFiles(SITE, catalogue({ sets: [{ id: "base1" }], cards: ["base1-4"] }));
    const index = renderIndex(SITE, files);
    expect(index).toContain("<sitemapindex");
    expect(index).toContain(`<loc>${SITE}/sitemaps/pages.xml</loc>`);
    expect(index).toContain(`<loc>${SITE}/sitemaps/sets.xml</loc>`);
    expect(index).toContain(`<loc>${SITE}/sitemaps/cards-1.xml</loc>`);
  });

  it("always points at the production origin, never the Pages mirror", () => {
    const files = buildSitemapFiles(PRODUCTION_ORIGIN, catalogue({ sets: [{ id: "sv01" }] }));
    for (const file of files) {
      for (const url of file.urls) {
        expect(url.loc.startsWith(PRODUCTION_ORIGIN)).toBe(true);
        expect(url.loc).not.toContain("github.io");
      }
    }
  });
});
