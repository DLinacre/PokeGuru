/**
 * Promotional flyer — public API used by the UI.
 *
 * The flyer is a 5 × 7 in, single-page, vector PDF with a QR code that points
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
 * Opens the generated PDF in a new tab so the visitor can use the browser's
 * own print dialogue. Falls back to downloading the file when pop-ups are
 * blocked, so the action never becomes a dead end.
 */
export async function printFlyer(): Promise<{ printed: boolean; file: FlyerFile }> {
  const file = await buildFlyerFile();
  const url = URL.createObjectURL(file.blob);
  const opened = typeof window !== "undefined" ? window.open(url, "_blank", "noopener,noreferrer") : null;

  if (!opened) {
    triggerDownload(file.blob, file.fileName);
    return { printed: false, file };
  }

  // Leave the URL alive long enough for the PDF viewer to load it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { printed: true, file };
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
