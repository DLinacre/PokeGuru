/**
 * Generates PWA/app icons without any image dependencies.
 * Draws a PokeGuru poké-ball mark and writes PNGs using Node's zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.resolve("public/icons");

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const COLORS = {
  bg: [15, 17, 21, 255],
  red: [239, 68, 68, 255],
  white: [244, 244, 245, 255],
  dark: [17, 17, 17, 255],
  transparent: [0, 0, 0, 0],
};

function roundedRectContains(x, y, size, radius) {
  const r = radius;
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
  if (x > size - r && y < r) return (x - (size - r)) ** 2 + (y - r) ** 2 <= r * r;
  if (x < r && y > size - r) return (x - r) ** 2 + (y - (size - r)) ** 2 <= r * r;
  if (x > size - r && y > size - r) return (x - (size - r)) ** 2 + (y - (size - r)) ** 2 <= r * r;
  return true;
}

function drawIcon(size, { maskable = false } = {}) {
  const buffer = Buffer.alloc(size * size * 4);
  const centre = size / 2;
  const ballRadius = size * (maskable ? 0.3 : 0.36);
  const ringWidth = Math.max(2, size * 0.045);
  const bandHeight = Math.max(3, size * 0.075);
  const innerRadius = ballRadius * 0.3;
  const cornerRadius = maskable ? 0 : size * 0.18;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let colour = maskable ? COLORS.bg : COLORS.transparent;

      if (maskable || roundedRectContains(x, y, size, cornerRadius)) {
        colour = COLORS.bg;
        const dx = x + 0.5 - centre;
        const dy = y + 0.5 - centre;
        const distance = Math.hypot(dx, dy);

        // Outer dark ring
        if (distance <= ballRadius + ringWidth / 2 && distance >= ballRadius - ringWidth / 2) colour = COLORS.dark;
        // Ball body
        if (distance < ballRadius - ringWidth / 2) colour = dy < 0 ? COLORS.red : COLORS.white;
        // Equator band
        if (distance < ballRadius - ringWidth / 2 && Math.abs(dy) <= bandHeight / 2) colour = COLORS.dark;
        // Centre button
        if (distance <= innerRadius + ringWidth * 0.7 && distance >= innerRadius - ringWidth * 0.7) colour = COLORS.dark;
        if (distance < innerRadius - ringWidth * 0.7) colour = COLORS.white;
      }

      buffer[index] = colour[0];
      buffer[index + 1] = colour[1];
      buffer[index + 2] = colour[2];
      buffer[index + 3] = colour[3];
    }
  }
  return encodePng(size, size, buffer);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const outputs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
];

for (const [name, size, options] of outputs) {
  const png = drawIcon(size, options);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`wrote public/icons/${name} (${size}×${size}, ${png.length} bytes)`);
}
