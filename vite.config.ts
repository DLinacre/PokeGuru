import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import fs from "node:fs";
import { PRODUCTION_ORIGIN, organizationSchema, webApplicationSchema, webSiteSchema } from "./src/services/seo";
import { seoFiles } from "./build/seo-plugin";

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

/**
 * Emits deployment assets that depend on the build target:
 *  - service worker (cache version + base path)
 *  - robots.txt / sitemap.xml (only with a configured public URL)
 *  - GitHub Pages 404 redirect (only on the Pages build)
 *  - a strict CSP <meta> for hosts that cannot set response headers
 */
function deploymentFiles(options: { base: string; siteUrl: string; isPages: boolean; version: string }): Plugin {
  const { base, siteUrl, isPages, version } = options;
  return {
    name: "pokeguru-deployment-files",
    apply: "build",
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

      // One canonical host, one sitemap index. Sitemap and robots entries never
      // include the mirror's base path: they always describe the canonical
      // Vercel URLs, even when this build is published to the GitHub Pages mirror.
      const robots = siteUrl
        ? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
        : "User-agent: *\nAllow: /\nDisallow: /search?\n";
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });

      // `sitemap.xml` (an index of pages/sets/cards sitemaps) and the prerendered
      // per-route HTML are produced by the seo plugin in ./build/seo-plugin.ts.

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
      seoFiles({ siteUrl, enabled: siteUrl.length > 0, outDir: "dist" }),
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
      rollupOptions: {
        output: {
          /**
           * Keep the React runtime in its own long-lived chunk. It changes far
           * less often than app code, so a deploy only invalidates the app
           * chunks and repeat visitors keep a warm cached runtime.
           * Everything heavy (pdf-lib for the flyer, tesseract.js for the
           * scanner) is already behind a dynamic import and stays out of this.
           */
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return "react-vendor";
            }
            if (id.includes("node_modules/lucide-react")) return "icons";
            return undefined;
          },
        },
      },
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
