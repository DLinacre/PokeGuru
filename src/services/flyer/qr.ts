/**
 * Production-address resolution and QR generation for the printed flyer.
 *
 * Two rules drive this file:
 *  1. The QR code may only ever encode the real production site. A missing or
 *     preview-only address is a configuration error we surface, never a reason
 *     to print something that will not resolve.
 *  2. No camera, no scanner, no third-party service. The QR is generated
 *     locally as vector data and drawn straight into the PDF.
 */

/** Filename used for every download, on every platform. */
export const FLYER_FILE_NAME = "PokeGuru-5x7-QR-Flyer.pdf";

export interface FlyerOrigin {
  /** Absolute origin with no trailing slash, e.g. https://pokeguru.vercel.app */
  origin: string;
  /** Host without scheme, e.g. pokeguru.vercel.app — printed under the QR. */
  host: string;
  source: "configured" | "served";
}

export interface FlyerOriginError {
  origin: null;
  host: null;
  message: string;
}

export type FlyerOriginResult = FlyerOrigin | FlyerOriginError;

/**
 * Rejects addresses that cannot be the public site: local dev servers, sandbox
 * previews and Vercel preview deployments (which carry a generated hostname).
 */
export function isPublicOrigin(candidate: string): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search || url.hash) return false;

  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (/^localhost$/.test(host) || /^127\./.test(host) || host === "0.0.0.0" || host === "[::1]") return false;
  if (host.endsWith(".local") || host.endsWith(".e2b.app") || host.endsWith(".internal")) return false;

  if (host.endsWith(".vercel.app")) {
    // Production aliases are exactly three labels (pokeguru.vercel.app).
    // Preview deployments add labels (name-abc123-team-projects.vercel.app) and
    // branch aliases contain "-git-"; both must never reach a printed QR code.
    const labels = host.split(".");
    if (labels.length !== 3) return false;
    if (labels[0].includes("-git-")) return false;
    // Deployment-scoped aliases embed a hash or team segment, e.g.
    // "pokeguru-8f3k2l-team": a hyphen-delimited segment containing digits.
    const segments = labels[0].split("-");
    const hasNumericSegment = segments.some((segment, index) => index > 0 && index < segments.length - 1 && /\d/.test(segment));
    if (hasNumericSegment) return false;
  }

  return true;
}

/**
 * Resolves the address the flyer links to.
 *
 * `VITE_PUBLIC_SITE_URL` is the single source of truth (it is also what the
 * canonical URLs, sitemap and robots.txt use). If it is unset we accept the
 * address the app is actually served from, but only when that address is a
 * plausible production origin — otherwise the caller shows a configuration
 * warning instead of generating a QR code that would not work in print.
 */
export function resolveFlyerOrigin(
  configured: string | undefined = import.meta.env.VITE_PUBLIC_SITE_URL,
  served: string | undefined = typeof window !== "undefined" ? window.location.origin : undefined
): FlyerOriginResult {
  const cleanConfigured = (configured ?? "").trim().replace(/\/+$/, "");
  if (cleanConfigured) {
    if (!isPublicOrigin(cleanConfigured)) {
      return {
        origin: null,
        host: null,
        message: `The configured site address (${cleanConfigured}) is not a public production address, so no QR code was generated.`,
      };
    }
    return { origin: cleanConfigured, host: new URL(cleanConfigured).hostname, source: "configured" };
  }

  const cleanServed = (served ?? "").trim().replace(/\/+$/, "");
  if (cleanServed && isPublicOrigin(cleanServed)) {
    return { origin: cleanServed, host: new URL(cleanServed).hostname, source: "served" };
  }

  return {
    origin: null,
    host: null,
    message:
      "The flyer needs a public site address. Set VITE_PUBLIC_SITE_URL (for example https://pokeguru.vercel.app) and rebuild, so the printed QR code cannot point at a preview deployment.",
  };
}

export interface QrMatrix {
  /** One array per row; true = dark module. */
  modules: boolean[][];
  /** Modules per side (excluding the quiet zone). */
  size: number;
  /** Quiet zone in modules (4 is what the QR specification requires). */
  quietZone: number;
}

type QrFactory = (typeNumber: number, level: "L" | "M" | "Q" | "H") => {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

/**
 * Builds the QR matrix for the flyer. Error-correction level Q survives a
 * slightly scuffed print; the generator picks the smallest version that fits.
 */
export async function buildQrMatrix(url: string, quietZone = 4): Promise<QrMatrix> {
  const loaded = (await import("qrcode-generator")) as unknown as
    | QrFactory
    | { default: QrFactory };
  const factory: QrFactory =
    typeof loaded === "function" ? loaded : (loaded as { default: QrFactory }).default;
  if (!factory) throw new Error("The QR generator could not be loaded.");

  const code = factory(0, "Q");
  code.addData(url);
  code.make();

  const size = code.getModuleCount();
  const modules = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => code.isDark(row, col))
  );
  return { modules, size, quietZone };
}
