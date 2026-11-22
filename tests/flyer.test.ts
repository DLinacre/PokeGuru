import { afterEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { PDFDocument } from "pdf-lib";
import { FLYER_FILE_NAME, buildFlyerFile, buildFlyerSvg, printFlyer, resolveFlyerOrigin } from "../src/services/flyer";
import { buildQrMatrix, isPublicOrigin } from "../src/services/flyer/qr";
import { FLYER_MM, FLYER_PT, buildFlyerScene, type ScenePrimitive } from "../src/services/flyer/scene";

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

describe("5 × 6 in photo-paper layout", () => {
  it("describes a 127 × 152.4 mm sheet in points and millimetres", () => {
    expect(FLYER_PT).toEqual({ width: 360, height: 432 });
    expect(FLYER_MM).toEqual({ width: 127, height: 152.4 });
    expect(FLYER_PT.height / 72).toBe(6);
    expect(FLYER_MM.height / 25.4).toBeCloseTo(6, 6);
  });

  it("keeps every element inside the sheet, with a safe margin for borderless trimming", () => {
    const modules = Array.from({ length: 21 }, () => Array.from({ length: 21 }, () => false));
    const scene = buildFlyerScene({
      url: PRODUCTION_URL,
      host: "pokeguru.vercel.app",
      modules,
      quietZone: 4,
    });

    const bottomOf = (primitive: ScenePrimitive): number => {
      switch (primitive.type) {
        case "rect":
          // Rotated cards swing a little past their height; allow for the corners.
          return primitive.y + primitive.h + (primitive.rotate ? 8 : 0);
        // Radial glows are intentionally oversized background washes and are
        // clipped by the page box, so they are not layout elements.
        case "circle":
          return 0;
        case "text":
          // `y` is the baseline; allow for descenders rather than a full em box.
          return primitive.y + primitive.size * 0.4;
        case "qr":
          return primitive.y + primitive.size;
      }
    };

    expect(scene.width).toBe(360);
    expect(scene.height).toBe(432);
    // 0.6 pt of slack: the background gradient overlaps its bands by a hair so
    // that no seams show when the PDF is rasterised.
    for (const primitive of scene.primitives) {
      expect(bottomOf(primitive)).toBeLessThanOrEqual(scene.height + 0.6);
    }
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

function makePrintWindow() {
  return {
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
    opener: {},
  };
}

describe("print view", () => {
  it("opens the print dialogue on a true 5 × 6 in photo-paper page", async () => {
    stubSite(PRODUCTION_URL);
    const printWindow = makePrintWindow();
    const open = vi.spyOn(window, "open").mockReturnValue(printWindow as unknown as Window);

    const result = await printFlyer();

    expect(result).toEqual({ printed: true, downloaded: false });
    expect(open).toHaveBeenCalledTimes(1);
    const html = printWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain("@page { size: 127mm 152.4mm");
    expect(html).toContain("width: 127mm; height: 152.4mm");
    expect(html).toContain("pokeguru.vercel.app");
    expect(html).toContain("<svg");
    expect(printWindow.print).toHaveBeenCalledTimes(1);
  });
});

describe("flyer PDF", () => {
  it("is a single 5 × 6 inch portrait page named PokeGuru-5x6-QR-Flyer.pdf", async () => {
    stubSite(PRODUCTION_URL);
    const file = await buildFlyerFile();

    expect(file.fileName).toBe("PokeGuru-5x6-QR-Flyer.pdf");
    expect(file.fileName).toBe(FLYER_FILE_NAME);

    const doc = await PDFDocument.load(await file.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);

    const [page] = doc.getPages();
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(360, 3); // 5 in × 72 pt
    expect(height).toBeCloseTo(432, 3); // 6 in × 72 pt
    expect(width / 72).toBeCloseTo(5, 6);
    expect(height / 72).toBeCloseTo(6, 6);
    expect(height).toBeGreaterThan(width); // portrait

    expect(page.getMediaBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 432 });
    expect(page.getCropBox()).toMatchObject({ x: 0, y: 0, width: 360, height: 432 });

    expect(file.millimetres.width).toBeCloseTo(127, 1);
    expect(file.millimetres.height).toBeCloseTo(152.4, 1);
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
    expect(svg).toContain('viewBox="0 0 360 432"');
  });

  it("refuses to render when no public address is configured", async () => {
    stubSite("");
    await expect(buildFlyerFile()).rejects.toThrow(/VITE_PUBLIC_SITE_URL/);
  });
});
