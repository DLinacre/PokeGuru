import { expect, test } from "@playwright/test";
import { dataUnavailable, open } from "./helpers";

test.describe("collection vault", () => {
  test("the vault survives a reload and can be exported", async ({ page }) => {
    await open(page, "/collection");

    // Seed through the same storage contract the app uses (v1 collection shape).
    await page.evaluate(() => {
      window.localStorage.setItem(
        "pokeguru_collection",
        JSON.stringify({
          version: 1,
          items: [
            {
              id: "base1-4",
              addedAt: Date.now(),
              card: {
                id: "base1-4",
                name: "Charizard",
                localId: "4",
                setId: "base1",
                setName: "Base Set",
                setSeries: "Base",
                rarity: "Rare Holo",
                imageBase: "https://assets.tcgdex.net/en/base/base1/4",
              },
            },
          ],
        })
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toContainText(/charizard/i, { timeout: 20_000 });

    const download = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("button", { name: /export/i }).first().click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.json$/i);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/charizard/i, { timeout: 20_000 });
  });

  test("corrupt stored data does not break the page", async ({ page }) => {
    await open(page, "/collection");
    await page.evaluate(() => window.localStorage.setItem("pokeguru_collection", "{not json"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("pack opening simulator", () => {
  test("pulls are stored apart from the real collection", async ({ page }) => {
    await open(page, "/packs");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");

    const start = page.getByRole("button", { name: /open|rip|pack/i }).first();
    await start.waitFor({ timeout: 25_000 });
    await start.click();
    await expect(page).toHaveURL(/\/packs\/[a-z0-9.-]+/i, { timeout: 25_000 });

    // A pack page must state the simulated/real distinction and never write into
    // the collection vault's storage key.
    const collectionBefore = await page.evaluate(() => window.localStorage.getItem("pokeguru_collection"));
    const openPack = page.getByRole("button", { name: /open pack|rip|open/i }).first();
    if (await openPack.isVisible().catch(() => false)) {
      await openPack.click();
      await page.waitForTimeout(3000);
    }
    const collectionAfter = await page.evaluate(() => window.localStorage.getItem("pokeguru_collection"));
    expect(collectionAfter).toBe(collectionBefore);
    const simKeys = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((key) => key.startsWith("pokeguru_pack_sim"))
    );
    expect(simKeys.length).toBeGreaterThan(0);
  });
});
