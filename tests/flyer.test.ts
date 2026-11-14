import { afterEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { FLYER_FILE_NAME, buildFlyerFile, buildFlyerSvg, resolveFlyerOrigin } from "../src/services/flyer";
import { buildQrMatrix, isPublicOrigin } from "../src/services/flyer/qr";

const PRODUCTION_URL = "https://pokeguru.vercel.app";

function stubSite(value: string | undefined) {
  vi.stubEnv("VITE_PUBLIC_SITE_URL", value ?? "");
}

/** Rasterises the QR matrix (with its quiet zone) into an ImageData for jsQR. */
function rasterise(modules: boolean[][], quietZone: number, scale = 8): ImageData {
  const size = modules.length + quietZone * 2;
  const width = size * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < modules.length; row += 1) {
    for (let col = 0; col < modules.length; col += 1) {
      if (!modules[row][col]) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = (col + quietZone) * scale + dx;
          const y = (row + quietZone) * scale + dy;
          const index = (y * width + x) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
    }
  }
  return { data, width, height: width, colorSpace: "srgb" } as ImageData;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production address resolution", () => {
  it("accepts ordinary https sites but rejects anything that is not the live site", () => {
    expect(isPublicOrigin(PRODUCTION_URL)).toBe(true);
    expect(isPublicOrigin("https://pokeguru.co.uk")).toBe(true);

    expect(isPublicOrigin("http://pokeguru.vercel.app")).toBe(false);
    expect(isPublicOrigin("https://localhost:5173")).toBe(false);
    expect(isPublicOrigin("https://127.0.0.1")).toBe(false);
    expect(isPublicOrigin("https://pokeguru.local")).toBe(false);
    expect(isPublicOrigin("https://5173-abc.e2b.app")).toBe(false);
    expect(isPublicOrigin("https://pokeguru-git-main-team.vercel.app")).toBe(false);
    expect(isPublicOrigin("https://pokeguru-8f3k2l-team-projects.vercel.app")).toBe(false);
    expect(isPublicOrigin("https://pokeguru.vercel.app/about")).toBe(false);
    expect(isPublicOrigin("not a url")).toBe(false);
  });

  it("uses VITE_PUBLIC_SITE_URL when it is a public address", () => {
    stubSite(PRODUCTION_URL);
    const resolved = resolveFlyerOrigin();
    expect(resolved).toMatchObject({ origin: PRODUCTION_URL, host: "pokeguru.vercel.app", source: "configured" });
  });

  it("falls back to the served origin when the app runs on the real domain", () => {
    const resolved = resolveFlyerOrigin("", PRODUCTION_URL);
    expect(resolved).toMatchObject({ origin: PRODUCTION_URL, source: "served" });
  });

  it("refuses to build a QR code for a local or preview host", () => {
    stubSite("");
    const local = resolveFlyerOrigin("", "http://localhost:3000");
    expect(local.origin).toBeNull();
    expect(local.host).toBeNull();
    expect("message" in local && local.message).toMatch(/VITE_PUBLIC_SITE_URL/);

    const preview = resolveFlyerOrigin("", "https://pokeguru-8f3k2l-team.vercel.app");
    expect(preview.origin).toBeNull();
  });
});

describe("QR code", () => {
  it("decodes back to the production URL with an independent decoder", async () => {
    const matrix = await buildQrMatrix(PRODUCTION_URL);
    expect(matrix.quietZone).toBe(4);
    expect(matrix.size).toBeGreaterThanOrEqual(21);

    const image = rasterise(matrix.modules, matrix.quietZone);
    const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    expect(decoded?.data).toBe(PRODUCTION_URL);
  });
});

describe("flyer PDF", () => {
  it("is a single 5 × 7 inch portrait page named PokeGuru-5x7-QR-Flyer.pdf", async () => {
    stubSite(PRODUCTION_URL);
    const file = await buildFlyerFile();

    expect(file.fileName).toBe("PokeGuru-5x7-QR-Flyer.pdf");
    expect(file.fileName).toBe(FLYER_FILE_NAME);

    const doc = await PDFDocument.load(await file.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);

    const [page] = doc.getPages();
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(360, 3); // 5 in × 72 pt
    expect(height).toBeCloseTo(504, 3); // 7 in × 72 pt
    expect(width / 72).toBeCloseTo(5, 6);
    expect(height / 72).toBeCloseTo(7, 6);
    expect(height).toBeGreaterThan(width); // portrait

    expect(page.getMediaBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 504 });
    expect(page.getCropBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 504 });

    expect(file.millimetres.width).toBeCloseTo(127, 1);
    expect(file.millimetres.height).toBeCloseTo(177.8, 1);
    expect(file.blob.type).toBe("application/pdf");
  });

  it("embeds the production address in the document and the vector copy", async () => {
    stubSite(PRODUCTION_URL);
    const file = await buildFlyerFile();
    const raw = new TextDecoder("latin1").decode(new Uint8Array(await file.blob.arrayBuffer()));
    expect(raw.startsWith("%PDF-")).toBe(true);

    const svg = await buildFlyerSvg();
    expect(svg).toContain("pokeguru.vercel.app");
    expect(svg).toContain("<desc>");
    expect(svg).toContain('viewBox="0 0 360 504"');
  });

  it("refuses to render when no public address is configured", async () => {
    stubSite("");
    await expect(buildFlyerFile()).rejects.toThrow(/VITE_PUBLIC_SITE_URL/);
  });
});
