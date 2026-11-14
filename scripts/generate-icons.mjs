#!/usr/bin/env node
/**
 * Rasterises the PokeGuru logo mark into every icon size the app and stores
 * need. The vector in `assets/logo-mark.svg` is the single source of truth, so
 * favicon, PWA icons, Apple touch icon and store artwork stay in sync.
 *
 * Usage: npm run icons
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets/logo-mark.svg");
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");

async function render(size, { padding = 0, background = null } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(source, { density: 384 }).resize(inner, inner).png().toBuffer();

  let image = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 10, g: 12, b: 17, alpha: 1 },
    },
  }).composite([{ input: mark, top: Math.round((size - inner) / 2), left: Math.round((size - inner) / 2) }]);

  return image.png({ compressionLevel: 9, palette: true }).toBuffer();
}

async function main() {
  await mkdir(iconsDir, { recursive: true });

  const outputs = [
    { file: path.join(iconsDir, "icon-192.png"), size: 192 },
    { file: path.join(iconsDir, "icon-512.png"), size: 512 },
    { file: path.join(iconsDir, "icon-maskable-512.png"), size: 512, padding: 0.12 },
    { file: path.join(iconsDir, "apple-touch-icon.png"), size: 180 },
    { file: path.join(publicDir, "favicon-32.png"), size: 32 },
    { file: path.join(publicDir, "favicon-192.png"), size: 192 },
  ];

  for (const output of outputs) {
    const buffer = await render(output.size, { padding: output.padding });
    await writeFile(output.file, buffer);
    console.log(`wrote ${path.relative(root, output.file)} (${output.size}x${output.size})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
