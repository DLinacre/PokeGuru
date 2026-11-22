import { expect, test } from "@playwright/test";
import { dataUnavailable, expectImagesLoaded, open } from "./helpers";

test.describe("search, filtering and card pages", () => {
  test("search writes the query to the URL and survives a reload", async ({ page }) => {
    await open(page, "/search");
    const input = page.getByRole("searchbox").or(page.getByPlaceholder(/charizard|search/i)).first();
    await input.fill("pikachu");
    await input.press("Enter");
    await expect(page).toHaveURL(/[?&]q=pikachu/i);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/[?&]q=pikachu/i);
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");
    await expect(page.locator('a[href^="/card/"]').first()).toBeVisible({ timeout: 25_000 });
  });

  test("filters persist in the URL and can be cleared", async ({ page }) => {
    await open(page, "/search?rarity=Illustration%20rare&sort=newest");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");
    await expect(page).toHaveURL(/rarity=Illustration/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/rarity=Illustration/);
  });

  test("a card page shows artwork, price provenance and a canonical URL", async ({ page }) => {
    await open(page, "/search?q=charizard");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");
    const firstCard = page.locator('a[href^="/card/"]').first();
    await firstCard.waitFor({ timeout: 25_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/card\//);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /pokeguru\.vercel\.app\/card\//);
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expectImagesLoaded(page, "main img, article img, img");
    // Prices are always attributed to Cardmarket — never presented as our own offer.
    await expect(page.locator("body")).toContainText(/Cardmarket/i);
  });

  test("card structured data never claims a PokeGuru offer", async ({ page }) => {
    await open(page, "/search?q=pikachu");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");
    const firstCard = page.locator('a[href^="/card/"]').first();
    await firstCard.waitFor({ timeout: 25_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/card\//);
    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
      nodes.map((node) => node.textContent ?? "")
    );
    const joined = schemas.join("\n");
    expect(joined).toContain("BreadcrumbList");
    expect(joined).toContain("ItemPage");
    // Accuracy rule: no Offer/AggregateOffer/availability for a reference price.
    expect(joined).not.toMatch(/"@type"\s*:\s*"(Offer|AggregateOffer)"/);
    expect(joined).not.toMatch(/availability|priceCurrency/);
  });

  test("set page lists cards and links back to the archive", async ({ page }) => {
    await open(page, "/sets");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");
    const firstSet = page.locator('a[href^="/set/"]').first();
    await firstSet.waitFor({ timeout: 25_000 });
    await firstSet.click();
    await expect(page).toHaveURL(/\/set\//);
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /all sets/i }).first()).toBeVisible();
  });
});
