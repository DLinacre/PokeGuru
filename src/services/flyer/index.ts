/**
 * Promotional flyer — public API used by the UI.
 *
 * The flyer is a 5 × 6 in, single-page, vector PDF with a QR code that points
 * at the live production site. It is generated on demand (never bundled as a
 * static asset) so there is exactly one copy, it always matches the current
 * design, and the QR code can never go stale after a redeploy.
 */

import { FLYER_FILE_NAME, buildQrMatrix, resolveFlyerOrigin, type FlyerOrigin } from "./qr";
import { buildFlyerScene, FLYER_MM, FLYER_PT, sceneToSvg } from "./scene";
import { renderFlyerPdf } from "./pdf";

export { FLYER_FILE_NAME, FLYER_MM, FLYER_PT, resolveFlyerOrigin };
export type { FlyerOrigin };

export class FlyerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlyerConfigurationError";
  }
}

export interface FlyerFile {
  blob: Blob;
  fileName: string;
  origin: FlyerOrigin;
  points: { width: number; height: number };
  millimetres: { width: number; height: number };
}

function originOrThrow(): FlyerOrigin {
  const resolved = resolveFlyerOrigin();
  if (resolved.origin === null) throw new FlyerConfigurationError(resolved.message);
  return resolved;
}

/** Builds the PDF once per call; callers keep the object URL for reuse. */
export async function buildFlyerFile(): Promise<FlyerFile> {
  const origin = originOrThrow();
  const qr = await buildQrMatrix(origin.origin);
  const scene = buildFlyerScene({ url: origin.origin, host: origin.host, modules: qr.modules, quietZone: qr.quietZone });
  const rendered = await renderFlyerPdf(scene);

  return {
    // Copy into a fresh ArrayBuffer so the Blob never shares memory with the
    // PDF library's working buffer.
    blob: new Blob([rendered.bytes.slice()], { type: "application/pdf" }),
    fileName: FLYER_FILE_NAME,
    origin,
    points: rendered.points,
    millimetres: rendered.millimetres,
  };
}

/** Triggers a download of the print-ready PDF. */
export async function downloadFlyer(): Promise<FlyerFile> {
  const file = await buildFlyerFile();
  triggerDownload(file.blob, file.fileName);
  return file;
}

/**
 * Opens the flyer in a new window and raises the browser's print dialogue.
 *
 * Browsers cannot print a PDF file for you, so the print view is the exact same
 * vector scene rendered as inline SVG on a page whose `@page` size is the flyer
 * itself (127 × 152.4 mm) — the dialogue therefore defaults to 5 × 6 in, and the
 * output stays vector. If the pop-up is blocked we download the PDF instead, so
 * the action never becomes a dead end.
 */
export async function printFlyer(): Promise<{ printed: boolean; downloaded: boolean }> {
  const origin = originOrThrow();
  const qr = await buildQrMatrix(origin.origin);
  const scene = buildFlyerScene({ url: origin.origin, host: origin.host, modules: qr.modules, quietZone: qr.quietZone });
  const svg = sceneToSvg(scene);

  const printWindow = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (!printWindow) {
    const file = await buildFlyerFile();
    triggerDownload(file.blob, file.fileName);
    return { printed: false, downloaded: true };
  }

  try {
    printWindow.opener = null;
  } catch {
    /* some browsers refuse to clear opener on cross-origin windows */
  }

  printWindow.document.open();
  printWindow.document.write(printDocument(svg));
  printWindow.document.close();

  // Give the new document a frame to lay the page out before printing.
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  try {
    printWindow.focus();
    printWindow.print();
  } catch {
    return { printed: false, downloaded: false };
  }
  return { printed: true, downloaded: false };
}

/** Minimal print view: one 5 × 6 in sheet, no chrome, no scripts. */
function printDocument(svg: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PokeGuru flyer — 5 × 6 in</title>
<style>
  @page { size: 127mm 152.4mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .sheet { width: 127mm; height: 152.4mm; }
  .sheet svg { display: block; width: 127mm; height: 152.4mm; }
  .hint { font: 13px/1.4 system-ui, sans-serif; color: #4b5563; padding: 12px 16px; }
  .hint strong { color: #111827; }
  @media print { .hint { display: none; } .sheet { margin: 0; box-shadow: none; } }
  @media screen { body { background: #0b0d12; padding: 16px; } .sheet { margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,.55); } .hint { color: #c7cedb; text-align: center; } .hint strong { color: #ffffff; } }
</style>
</head>
<body>
<p class="hint"><strong>Print at 100% / Actual size</strong> on 5 × 6 in (127 × 152.4 mm) photo paper — borderless if your printer allows it. This window can be closed once printed.</p>
<div class="sheet">${svg}</div>
</body>
</html>`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Vector SVG copy of the same design (used by previews/tests, no PDF). */
export async function buildFlyerSvg(): Promise<string> {
  const origin = originOrThrow();
  const qr = await buildQrMatrix(origin.origin);
  const scene = buildFlyerScene({ url: origin.origin, host: origin.host, modules: qr.modules, quietZone: qr.quietZone });
  return sceneToSvg(scene);
}
