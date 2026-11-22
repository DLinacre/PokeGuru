#!/usr/bin/env node
/**
 * Renders every brand asset from vector sources so nothing is hand-cropped.
 *
 * Sources (single source of truth, both versioned):
 *   assets/logo-mark.svg    the mark: favicon, PWA icons, app header, social card
 *   assets/social-card.svg  the Open Graph / GitHub social card layout
 *
 * Outputs:
 *   public/favicon.svg, public/favicon-16/32/48.png
 *   public/icons/{apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png
 *   public/og.png                      1200 × 630 (Open Graph + Twitter/X)
 *   assets/social-preview.png          1280 × 640 (GitHub repository social preview)
 *   assets/brand/banner-1280x640.png   README banner (same artwork)
 *
 * Usage: npm run brand   (or `npm run icons` / `npm run social` individually)
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SOURCE_MARK = path.join(root, "assets/logo-mark.svg");
const SOURCE_CARD = path.join(root, "assets/social-card.svg");
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");
const brandDir = path.join(root, "assets/brand");

/** Tile colour behind the mark on raster icons (matches the SVG tile's base). */
const TILE = { r: 10, g: 12, b: 17, alpha: 1 };

async function renderMark(size, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(SOURCE_MARK, { density: 384 }).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: TILE } })
    .composite([
      {
        input: mark,
        top: Math.round((size - inner) / 2),
        left: Math.round((size - inner) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The social card is laid out at 1280 × 640 so GitHub's preview is pixel-exact.
 * The Open Graph/Twitter variant is centre-cropped to 1200 × 630 (the card's
 * content is kept well inside the crop, so nothing important is lost).
 */
async function renderSocialCard({ width, height }) {
  const card = await sharp(SOURCE_CARD, { density: 144 }).resize(width, height, { fit: "cover" }).png().toBuffer();

  // Place the real logo mark over the artwork area.
  const markSize = Math.round(height * 0.56);
  const mark = await sharp(SOURCE_MARK, { density: 384 }).resize(markSize, markSize).png().toBuffer();
  // Keep the mark fully inside both the 1280×640 card and the 1200×630 crop.
  const markLeft = width - markSize - Math.round(width * 0.075);
  const markTop = Math.round((height - markSize) / 2);

  return sharp(card)
    .composite([{ input: mark, top: markTop, left: markLeft }])
    .sharpen({ sigma: 0.6 })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(brandDir, { recursive: true });

  const icons = [
    { file: "public/icons/icon-192.png", size: 192 },
    { file: "public/icons/icon-512.png", size: 512 },
    // Maskable icons need a safe zone: the mark sits inside 76 % of the canvas.
    { file: "public/icons/icon-maskable-512.png", size: 512, padding: 0.12 },
    { file: "public/icons/apple-touch-icon.png", size: 180 },
    { file: "public/favicon-16.png", size: 16 },
    { file: "public/favicon-32.png", size: 32 },
    { file: "public/favicon-48.png", size: 48 },
    { file: "public/favicon-192.png", size: 192 },
  ];

  for (const icon of icons) {
    const buffer = await renderMark(icon.size, { padding: icon.padding });
    await writeFile(path.join(root, icon.file), buffer);
    console.log(`icon   ${icon.file} (${icon.size}×${icon.size})`);
  }

  // Vector favicon: identical geometry to the mark, no raster edge at any DPI.
  const markSvg = await readFile(SOURCE_MARK, "utf8");
  await writeFile(path.join(publicDir, "favicon.svg"), markSvg);
  console.log("icon   public/favicon.svg (vector)");

  const og = await renderSocialCard({ width: 1200, height: 630 });
  await writeFile(path.join(publicDir, "og.png"), og);
  console.log("social public/og.png (1200×630)");

  const preview = await renderSocialCard({ width: 1280, height: 640 });
  await writeFile(path.join(root, "assets/social-preview.png"), preview);
  await writeFile(path.join(brandDir, "banner-1280x640.png"), preview);
  console.log("social assets/social-preview.png + assets/brand/banner-1280x640.png (1280×640)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
