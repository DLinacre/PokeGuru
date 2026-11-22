import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import fs from "node:fs";
import { PRODUCTION_ORIGIN, organizationSchema, webApplicationSchema, webSiteSchema } from "./src/services/seo";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://assets.tcgdex.net",
  "font-src 'self' data:",
  "connect-src 'self' https://api.tcgdex.net https://api.frankfurter.dev https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const STATIC_ROUTES = [
  "/",
  "/search",
  "/sets",
  "/wiki",
  "/collection",
  "/scanner",
  "/packs",
  "/packs/collection",
  "/top-100",
  "/flyer",
  "/about",
];

/**
 * Emits deployment assets that depend on the build target:
 *  - service worker (cache version + base path)
 *  - robots.txt / sitemap.xml (only with a configured public URL)
 *  - GitHub Pages 404 redirect (only on the Pages build)
 *  - a strict CSP <meta> for hosts that cannot set response headers
 */
function deploymentFiles(options: { base: string; siteUrl: string; isPages: boolean; version: string }): Plugin {
  const { base, siteUrl, isPages, version } = options;
  /** Set ids discovered from the public API at build time (never invented). */
  let setIds: string[] = [];

  return {
    name: "pokeguru-deployment-files",
    apply: "build",
    async buildStart() {
      if (!siteUrl) return;
      try {
        const response = await fetch("https://api.tcgdex.net/v2/en/sets", {
          signal: AbortSignal.timeout(8000),
          headers: { accept: "application/json" },
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (Array.isArray(data)) {
          setIds = data
            .map((entry) => (entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined))
            .filter((id): id is string => typeof id === "string" && /^[a-z0-9.-]+$/i.test(id));
          this.warn?.(`[sitemap] ${setIds.length} set pages included from TCGdex`);
        }
      } catch {
        this.warn?.("[sitemap] TCGdex unavailable; sitemap will contain static routes only");
      }
    },
    transformIndexHtml(html) {
      let output = html;
      // Strict CSP for static hosts; identical to the Vercel header policy.
      output = output.replace(
        "</head>",
        `    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`
      );
      // Site-wide structured data (organisation + site + application). Page-level
      // schema is added at runtime by usePageMeta(); this is the shell that ships
      // in the HTML so crawlers that do not run JavaScript still see it.
      const siteJsonLd = `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [organizationSchema(), webSiteSchema(), webApplicationSchema()],
      })}</script>`;
      return output.replace("<!--SITE_JSONLD-->", siteJsonLd);
    },
    generateBundle() {
      const swTemplate = fs.readFileSync(path.resolve(__dirname, "src/pwa/sw-template.js"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: swTemplate.replace(/%BASE%/g, base).replace(/%VERSION%/g, version),
      });

      // The manifest is emitted per build target (like the service worker) so
      // `id`, `start_url`, `scope`, icon and shortcut URLs always sit inside
      // the deployment base. A static manifest with `id: "/"` is outside the
      // `/PokeGuru/` scope on the GitHub Pages build, which makes that build
      // non-installable ("no installable PWA available").
      const manifestTemplate = fs.readFileSync(path.resolve(__dirname, "src/pwa/manifest-template.json"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: manifestTemplate.replace(/%BASE%/g, base),
      });

      const offlineTemplate = fs.readFileSync(path.resolve(__dirname, "src/pwa/offline.html"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "offline.html",
        source: offlineTemplate.replace(/%BASE%/g, base),
      });

      // One canonical host, one sitemap. `/search` result pages are crawlable
      // but canonicalise to `/search` and are marked noindex at runtime, so
      // there is no crawl trap in the query parameters.
      // Sitemap and robots entries never include the mirror's base path: they
      // always describe the canonical Vercel URLs, even when this build is being
      // published to the GitHub Pages mirror.
      const robots = siteUrl
        ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
        : "User-agent: *\nAllow: /\nDisallow: /search?\n";
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });

      if (siteUrl) {
        // lastmod is the build time: the content of every listed page is served
        // from this build, so it is an honest "last changed" signal (we never
        // claim a freshness we cannot back up).
        const lastmod = new Date().toISOString().slice(0, 10);
        const priorities: Record<string, { changefreq: string; priority: string }> = {
          "/": { changefreq: "daily", priority: "1.0" },
          "/search": { changefreq: "weekly", priority: "0.9" },
          "/packs": { changefreq: "weekly", priority: "0.9" },
          "/sets": { changefreq: "weekly", priority: "0.8" },
          "/top-100": { changefreq: "daily", priority: "0.8" },
          "/wiki": { changefreq: "weekly", priority: "0.8" },
          "/flyer": { changefreq: "monthly", priority: "0.6" },
          "/about": { changefreq: "monthly", priority: "0.6" },
          "/collection": { changefreq: "monthly", priority: "0.4" },
          "/scanner": { changefreq: "monthly", priority: "0.5" },
          "/packs/collection": { changefreq: "monthly", priority: "0.3" },
        };
        const staticUrls = STATIC_ROUTES.map((route) => {
          const meta = priorities[route] ?? { changefreq: "weekly", priority: "0.6" };
          return `  <url><loc>${siteUrl}${route === "/" ? "/" : route}</loc><lastmod>${lastmod}</lastmod><changefreq>${meta.changefreq}</changefreq><priority>${meta.priority}</priority></url>`;
        });
        const setUrls = setIds.map(
          (id) =>
            `  <url><loc>${siteUrl}/set/${id}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
        );
        const urls = [...staticUrls, ...setUrls].join("\n");
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      }

      if (isPages) {
        const segments = base.split("/").filter(Boolean).length;
        this.emitFile({
          type: "asset",
          fileName: "404.html",
          source: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>PokeGuru</title>
<script>
  // GitHub Pages deep-link redirect: encode the path so the SPA can restore it.
  (function () {
    var seg = ${segments};
    var l = window.location;
    l.replace(
      l.protocol + "//" + l.hostname + (l.port ? ":" + l.port : "") +
      l.pathname.split("/").slice(0, 1 + seg).join("/") + "/?/" +
      l.pathname.slice(1).split("/").slice(seg).join("/").replace(/&/g, "~and~") +
      (l.search ? "&" + l.search.slice(1).replace(/&/g, "~and~") : "") +
      l.hash
    );
  }());
</script></head><body></body></html>`,
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isPages = env.DEPLOY_TARGET === "github-pages";
  const base = isPages ? "/PokeGuru/" : env.VITE_BASE_PATH || "/";
  // Default to the official Vercel origin: the sitemap and robots.txt must
  // always describe the canonical host, including local and GitHub Pages builds.
  const siteUrl = (env.VITE_PUBLIC_SITE_URL || PRODUCTION_ORIGIN).replace(/\/+$/, "");
  // The service worker cache version is a build stamp; the *app* version shown
  // in the UI is package.json's version so there is one source of truth.
  const version = `${Date.now()}`;
  const packageVersion = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version as string;

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion),
    },
    plugins: [
      react(),
      tailwindcss(),
      deploymentFiles({ base, siteUrl, isPages, version }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      // Source maps are not shipped: they are large and this is a public app.
      sourcemap: false,
      target: "es2020",
      cssCodeSplit: true,
      reportCompressedSize: true,
    },
    // Bind to all interfaces so sandbox previews/proxies can reach the server,
    // and accept proxied hostnames rather than only localhost.
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      allowedHosts: true,
    },
  };
});
