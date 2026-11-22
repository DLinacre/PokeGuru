import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectNoHorizontalOverflow, open } from "./helpers";

const PUBLIC_PAGES = ["/", "/search", "/sets", "/packs", "/top-100", "/wiki", "/about", "/flyer"];

test.describe("responsive layout", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} fits the viewport`, async ({ page }) => {
      await open(page, path);
      await expectNoHorizontalOverflow(page, path);

      // Interactive controls must be reachable: nothing may be hidden behind a
      // zero-height container at this width.
      const header = page.locator("header").first();
      await expect(header).toBeVisible();
      const headerBox = await header.boundingBox();
      expect(headerBox?.height ?? 0).toBeGreaterThan(0);

      // Every image must carry an alt attribute (decorative ones use alt="").
      const missingAlt = await page.locator("img:not([alt])").count();
      expect(missingAlt, `${path} images without an alt attribute`).toBe(0);
    });
  }

  test("navigation is usable on a phone", async ({ page }) => {
    await open(page, "/");
    const nav = page.locator("header nav, nav").first();
    await expect(nav).toBeVisible();
        const links = page.locator('header a[href^="/"], nav a[href^="/"]');
    expect(await links.count()).toBeGreaterThan(2);
  });
});

test.describe("accessibility (axe-core)", () => {
  for (const path of ["/", "/search", "/sets", "/about"]) {
    test(`${path} has no serious or critical violations`, async ({ page }) => {
      await open(page, path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical"
      );
      const summary = blocking
        .map((violation) => `${violation.id} (${violation.nodes.length} nodes): ${violation.help}`)
        .join("\n");
      expect(blocking, `serious/critical axe violations on ${path}\n${summary}`).toEqual([]);
    });
  }

  test("keyboard focus is visible and reaches the search field", async ({ page }) => {
    await open(page, "/");
    const focusedTags: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      focusedTags.push(
        await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          return element ? `${element.tagName}:${element.getAttribute("href") ?? element.id ?? ""}` : "none";
        })
      );
    }
    expect(focusedTags.some((tag) => /^(A|BUTTON|INPUT|TEXTAREA|SELECT):/.test(tag))).toBe(true);

    // The focused element must show a visible outline or ring.
    const hasVisibleFocusStyle = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const outline = parseFloat(style.outlineWidth || "0");
      return outline > 0 || style.boxShadow !== "none";
    });
    expect(hasVisibleFocusStyle).toBe(true);
  });
});
