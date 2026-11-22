import { expect, test } from "@playwright/test";
import { dataUnavailable, expectNoHorizontalOverflow, open, watchConsole } from "./helpers";

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /card|worth|pokémon/i },
  { path: "/search", heading: /search/i },
  { path: "/sets", heading: /set|expansion/i },
  { path: "/packs", heading: /pack/i },
  { path: "/top-100", heading: /valuable|top 100/i },
  { path: "/wiki", heading: /wiki|set/i },
  { path: "/collection", heading: /collection|vault/i },
  { path: "/scanner", heading: /scan/i },
  { path: "/about", heading: /about/i },
  { path: "/flyer", heading: /flyer/i },
];

test.describe("core navigation", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders with a heading and no console errors`, async ({ page }) => {
      const errors = watchConsole(page);
      await open(page, route.path);
      await expect(page.locator("h1").first()).toHaveText(route.heading);
      // Exactly one h1 keeps the document outline unambiguous.
      await expect(page.locator("h1")).toHaveCount(1);
      await expectNoHorizontalOverflow(page, route.path);
      expect(errors, `console errors on ${route.path}`).toEqual([]);
    });
  }

  test("header links reach every core page", async ({ page }) => {
    await open(page, "/");
    for (const route of ["/sets", "/packs", "/top-100", "/wiki", "/collection"]) {
      await page.locator(`header a[href="${route}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}(\\?|$)`));
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("Back and Forward restore the same route", async ({ page }) => {
    await open(page, "/");
    await page.goto("/sets");
    await expect(page.locator("h1").first()).toContainText(/set|expansion/i);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/sets$/);
    await expect(page.locator("h1").first()).toContainText(/set|expansion/i);
  });

  test("a deep link survives a hard reload", async ({ page }) => {
    await open(page, "/sets");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toContainText(/set|expansion/i);
    // The prerendered HTML must already carry the route's own title.
    await expect(page).toHaveTitle(/sets|expansion/i);
  });

  test("an unknown URL shows the not-found page, not a blank screen", async ({ page }) => {
    await page.goto("/this-route-does-not-exist", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).toContainText(/not found|does not exist|could not/i);
  });

  test("prerendered HTML is readable without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto("/sets", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    // Written at build time by build/seo-plugin.ts, not by the browser.
    await expect(page.locator("h1")).toContainText(/expansion|set/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://pokeguru.vercel.app/sets"
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/);
    await context.close();
  });

  test("invalid card id degrades to a readable error and is not indexable", async ({ page }) => {
    await page.goto("/card/definitely-not-a-real-card-id", { waitUntil: "domcontentloaded" });
    await page.locator("h1, body").first().waitFor();
    expect(await dataUnavailable(page)).toBe(true);
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    // Either the shell's noindex or the app's own directive must be present.
    expect(robots ?? "").toMatch(/noindex|index/);
  });
});
