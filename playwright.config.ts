import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for PokeGuru.
 *
 * The suite runs against a real production build served by `vite preview`, in
 * the same four device classes the site is designed for: two Android phone
 * widths, a tablet and a desktop. Card data comes from the live TCGdex API, so
 * tests that need a card are written to skip cleanly (and say so) when the API
 * is unreachable rather than inventing data.
 *
 * Browsers are installed separately (`npm run test:e2e:install`) because the
 * binaries are large; CI does this in its own job.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "android-small", use: { ...devices["Pixel 5"] } },
    { name: "android-large", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { ...devices["iPad Mini"] } },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
