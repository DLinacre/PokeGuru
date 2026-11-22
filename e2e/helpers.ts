import { expect, type Page } from "@playwright/test";

/** Console errors that are noise in a headless browser. */
const IGNORED_CONSOLE = [
  /Failed to load resource/i,
  /net::ERR/i,
  /service worker/i,
  /Download the React DevTools/i,
];

/** Collects real console errors and page exceptions for a test. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => {
    if (!IGNORED_CONSOLE.some((pattern) => pattern.test(error.message))) errors.push(error.message);
  });
  return errors;
}

/** Navigates and waits for the app shell to finish mounting. */
export async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} should respond`).toBeLessThan(400);
  await page.locator("header").first().waitFor({ state: "visible" });
  // The home page always renders an h1; route changes mount lazily.
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
}

/** True when the app is showing its "data unavailable" state. */
export async function dataUnavailable(page: Page): Promise<boolean> {
  const text = (await page.locator("body").innerText()).toLowerCase();
  return /could not be (found|loaded)|failed to load|unavailable|offline/.test(text);
}

/** Asserts the page never scrolls horizontally at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  // 1 px of rounding slack is normal on fractional device pixel ratios.
  expect(scrollWidth, `${label} must not overflow horizontally`).toBeLessThanOrEqual(innerWidth + 1);
}

/** Waits for images inside `selector` to finish loading and checks they decoded. */
export async function expectImagesLoaded(page: Page, selector = "img"): Promise<number> {
  return page.locator(selector).evaluateAll(async (images) => {
    const settled = await Promise.all(
      images.map(async (image) => {
        const img = image as HTMLImageElement;
        if (!img.currentSrc && !img.src) return false;
        if (img.complete) return img.naturalWidth > 0;
        return new Promise<boolean>((resolve) => {
          img.addEventListener("load", () => resolve(img.naturalWidth > 0), { once: true });
          img.addEventListener("error", () => resolve(false), { once: true });
          window.setTimeout(() => resolve(img.naturalWidth > 0), 8000);
        });
      })
    );
    const failed = images.filter((_, index) => !settled[index]);
    if (failed.length) {
      throw new Error(
        `${failed.length} image(s) failed to decode: ` +
          failed
            .slice(0, 3)
            .map((image) => (image as HTMLImageElement).getAttribute("src") ?? "(no src)")
            .join(", ")
      );
    }
    return images.length;
  });
}
