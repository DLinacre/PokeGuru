import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The web app manifest is emitted per build target from
 * `src/pwa/manifest-template.json` (see vite.config.ts). These tests pin the
 * Chrome installability contract so a future edit cannot silently make the
 * app non-installable again ("no installable PWA available"):
 *  - a name + short_name,
 *  - 192px and 512px icons,
 *  - standalone display,
 *  - id / start_url / scope that agree and sit inside the deployment base
 *    (a static `id: "/"` is outside the `/PokeGuru/` scope on Pages).
 */

const template = readFileSync(path.resolve(__dirname, "../src/pwa/manifest-template.json"), "utf8");

function manifestFor(base: string): Record<string, unknown> {
  return JSON.parse(template.replace(/%BASE%/g, base)) as Record<string, unknown>;
}

describe("PWA manifest template", () => {
  it.each(["/", "/PokeGuru/"])("is installable for base %s", (base) => {
    const manifest = manifestFor(base);
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(manifest.id).toBe(base);
    expect(manifest.start_url).toBe(base);
    expect(manifest.scope).toBe(base);

    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of icons) {
      expect(icon.src.startsWith(base)).toBe(true);
      expect(icon.type).toBe("image/png");
    }

    const shortcuts = manifest.shortcuts as Array<{ url: string }>;
    expect(shortcuts.length).toBeGreaterThan(0);
    for (const shortcut of shortcuts) {
      expect(shortcut.url.startsWith(base)).toBe(true);
    }
  });

  it("has no leftover placeholders", () => {
    for (const base of ["/", "/PokeGuru/"]) {
      expect(JSON.stringify(manifestFor(base))).not.toContain("%BASE%");
    }
  });
});

describe("install prompt capture ordering", () => {
  const html = readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

  it("loads the capture script in <head> before the React entry", () => {
    const capture = html.indexOf("pwa-capture.js");
    const entry = html.indexOf("/src/main.tsx");
    expect(capture).toBeGreaterThan(-1);
    expect(entry).toBeGreaterThan(-1);
    // Chrome fires `beforeinstallprompt` once; a capture script that loads
    // after the React bundle can miss it entirely.
    expect(capture).toBeLessThan(entry);
  });

  it("links the manifest through the deployment base", () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain("%BASE_URL%manifest.webmanifest");
  });
});
