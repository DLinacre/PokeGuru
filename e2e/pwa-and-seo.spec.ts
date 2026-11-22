import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test.describe("PWA", () => {
  test("manifest is installable and every icon resolves", async ({ page, request }) => {
    await open(page, "/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href!, page.url()).toString();
    const response = await request.get(manifestUrl);
    expect(response.status()).toBe(200);
    const manifest = await response.json();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    const sizes = (manifest.icons ?? []).map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

    for (const icon of manifest.icons as { src: string; purpose?: string }[]) {
      const iconResponse = await request.get(new URL(icon.src, page.url()).toString());
      expect(iconResponse.status(), `icon ${icon.src}`).toBe(200);
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
    }
    expect((manifest.icons as { purpose?: string }[]).some((icon) => (icon.purpose ?? "").includes("maskable"))).toBe(true);
  });

  test("service worker registers and caches the shell", async ({ page }) => {
    await open(page, "/");
    const registered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.scriptURL ?? registration.scope ?? null;
    });
    expect(registered).toContain("sw.js");
  });

  test("offline navigation falls back to the offline page", async ({ page, context }) => {
    await open(page, "/");
    await page.waitForTimeout(1500); // let the worker finish installing
    await context.setOffline(true);
    await page.goto("/sets", { waitUntil: "domcontentloaded" }).catch(() => undefined);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body.toLowerCase()).toMatch(/offline|cached|connection/);
    await context.setOffline(false);
  });
});

test.describe("SEO surface", () => {
  const EXPECTED: { path: string; title: RegExp }[] = [
    { path: "/", title: /PokeGuru/ },
    { path: "/sets", title: /set|expansion/i },
    { path: "/top-100", title: /top 100|valuable/i },
    { path: "/about", title: /about/i },
  ];

  for (const route of EXPECTED) {
    test(`${route.path} has canonical, robots and social metadata`, async ({ page }) => {
      await open(page, route.path);
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https:\/\/pokeguru\.vercel\.app/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index,follow/);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\.png$/);
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    });
  }

  test("search result views are noindex and canonicalise to /search", async ({ page }) => {
    await open(page, "/search?q=charizard&sort=newest");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://pokeguru.vercel.app/search");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex,follow/);
  });

  test("sitemap index and child sitemaps are valid XML", async ({ request }) => {
    const index = await request.get("/sitemap.xml");
    expect(index.status()).toBe(200);
    const indexBody = await index.text();
    expect(indexBody).toContain("<sitemapindex");
    const children = [...indexBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((loc) => loc.startsWith("https://pokeguru.vercel.app/sitemaps/"))).toBe(true);

    const pages = await request.get("/sitemaps/pages.xml");
    const body = await pages.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>https://pokeguru.vercel.app/</loc>");
    // XML must be well formed: no raw ampersands.
    expect(body).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  test("robots.txt points at the canonical sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const body = await response.text();
    expect(body).toContain("Sitemap: https://pokeguru.vercel.app/sitemap.xml");
    expect(body).not.toContain("dlinacre.github.io");
  });
});
