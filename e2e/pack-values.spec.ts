import { expect, test } from "@playwright/test";
import { dataUnavailable, open, watchConsole } from "./helpers";

/**
 * Pack values, end to end.
 *
 * These run against the real TCGdex data, so they assert on *structure and
 * honesty* rather than specific amounts: a total is either absent ("—") or a
 * GBP figure whose coverage is stated, and the opening history always shows
 * what was recorded.
 */
test.describe("pack market values", () => {
  test("a single pack shows a value bar and a summary with coverage", async ({ page }) => {
    const errors = watchConsole(page);
    await open(page, "/packs");
    if (await dataUnavailable(page)) test.skip(true, "TCGdex unreachable in this environment");

    // Pick the most recent expansion with a supported pack, then open one.
    const firstPack = page.getByRole("link", { name: /open|pack/i }).first();
    await firstPack.waitFor({ timeout: 25_000 });
    await firstPack.click();
    await expect(page.locator("h1")).toBeVisible({ timeout: 25_000 });

    await page.getByRole("button", { name: /^open pack$|^open \d+ packs$/i }).first().click();
    await expect(page.getByText(/current pack value/i)).toBeVisible({ timeout: 25_000 });

    // Reveal everything, then read the summary.
    const revealPack = page.getByRole("button", { name: /reveal pack|see summary/i }).first();
    if (await revealPack.isVisible().catch(() => false)) await revealPack.click();

    // The running total is either a GBP figure or an explicit "—".
    const valueText = await page.getByText(/current pack value/i).locator("..").innerText();
    expect(valueText).toMatch(/£\d|—/);
    expect(valueText).toMatch(/priced/i);

    await expect(page.getByRole("heading", { name: /market value/i })).toBeVisible({ timeout: 30_000 });
    const summary = await page.getByRole("heading", { name: /market value/i }).locator("../..").innerText();
    expect(summary).toMatch(/coverage/i);
    expect(summary).toMatch(/reference valuations, not offers/i);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("the opening is recorded and survives a reload", async ({ page }) => {
    await open(page, "/packs/history");
    const emptyOrList = page.locator("body");
    await expect(emptyOrList).toContainText(/opening history/i, { timeout: 20_000 });

    // Seed a recorded opening through the documented storage contract, then
    // prove the history view reads it back after a reload.
    await page.evaluate(() => {
      const pull = {
        key: "base1-4|holo",
        cardId: "base1-4",
        name: "Charizard",
        localId: "4",
        setId: "base1",
        setName: "Base Set",
        finish: "holo",
        tier: "holoRare",
        status: "priced",
        eur: 250,
        gbp: 210.5,
        basis: "trend",
        variant: "holo",
        printing: "Holofoil printing",
        source: "cardmarket",
        priceUpdatedAt: "2026-11-13T00:00:00.000Z",
        fxDate: "2026-11-14",
        fxRate: 0.842,
        retrievedAt: Date.now(),
        flags: [],
      };
      window.localStorage.setItem(
        "pokeguru_pack_sim_v1",
        JSON.stringify({
          version: 2,
          cards: {},
          packsOpened: 1,
          history: [],
          openings: [
            {
              id: "e2e-session",
              setId: "base1",
              setName: "Base Set",
              seriesId: "base",
              startedAt: Date.now(),
              completedAt: Date.now(),
              valuesRecorded: true,
              packs: [
                {
                  packId: "e2e-pack",
                  openedAt: Date.now(),
                  seed: "e2e",
                  bestTier: "holoRare",
                  pulls: [pull],
                  totals: {
                    cards: 1,
                    priced: 1,
                    unavailable: 0,
                    pending: 0,
                    totalGbp: 210.5,
                    totalEur: 250,
                    averageGbp: 210.5,
                    highest: { cardId: "base1-4", name: "Charizard", gbp: 210.5 },
                    lowest: { cardId: "base1-4", name: "Charizard", gbp: 210.5 },
                  },
                },
              ],
              totals: {
                cards: 1,
                priced: 1,
                unavailable: 0,
                pending: 0,
                totalGbp: 210.5,
                totalEur: 250,
                averageGbp: 210.5,
                highest: { cardId: "base1-4", name: "Charizard", gbp: 210.5 },
                lowest: { cardId: "base1-4", name: "Charizard", gbp: 210.5 },
              },
            },
          ],
          settings: { sound: false, reduceMotion: true, wrapperStyle: "crimson" },
        })
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toContainText("Base Set", { timeout: 20_000 });
    await expect(page.locator("body")).toContainText("£210.50");
    await expect(page.locator("body")).toContainText(/1 of 1 priced/);
  });
});
