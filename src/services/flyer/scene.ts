/**
 * Flyer scene model.
 *
 * The promotional flyer is described once, as a tiny declarative scene, and
 * rendered twice: to PDF (the downloadable, print-ready artefact) and to SVG
 * (used by the visual regression preview and by anyone who wants a vector
 * copy). Keeping the description separate from the renderer means the PDF and
 * the preview can never drift apart, and the renderer stays testable without a
 * browser canvas.
 *
 * Coordinates are top-left origin with y growing downwards, which matches SVG
 * and reads naturally when laying a poster out from the header down.
 */

export const FLYER_PT = { width: 360, height: 504 } as const; // exactly 5 × 7 in
export const FLYER_MM = { width: 127, height: 177.8 } as const;

export type FontFace = "bold" | "regular" | "italic";

export type ScenePrimitive =
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      /** Corner radius in points. */
      r?: number;
      fill?: string;
      opacity?: number;
      stroke?: string;
      strokeWidth?: number;
      /** Rotation in degrees about the rectangle's centre. */
      rotate?: number;
    }
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      opacity?: number;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      font: FontFace;
      color: string;
      align?: "left" | "center" | "right";
      /** Extra space between characters, in points. */
      tracking?: number;
      opacity?: number;
    }
  | {
      type: "qr";
      x: number;
      y: number;
      size: number;
      modules: boolean[][];
      /** Quiet zone in modules, included inside the given size. */
      quiet: number;
      dark: string;
      light: string;
    };

export interface FlyerScene {
  width: number;
  height: number;
  /** Title used for the PDF document properties and the SVG <title>. */
  title: string;
  /** Production URL encoded in the QR code; recorded in the document metadata. */
  url: string;
  primitives: ScenePrimitive[];
}

/* ------------------------------------------------------------------ */
/* Palette — mirrors the app's design tokens                           */
/* ------------------------------------------------------------------ */

export const FLYER_COLORS = {
  ink: "#08090d",
  soft: "#101319",
  card: "#151923",
  elevated: "#1c212d",
  border: "#2c3344",
  accent: "#f04452",
  gold: "#f5a524",
  blue: "#7cc4ff",
  green: "#2fbf71",
  text: "#f4f6fb",
  muted: "#aab3c2",
  mutedDim: "#8b93a3",
  white: "#ffffff",
} as const;

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

/**
 * A vertical gradient built from flat bands. Vector output, no images, and it
 * renders identically in PDF and SVG.
 */
export function verticalGradient(
  x: number,
  y: number,
  w: number,
  h: number,
  from: string,
  to: string,
  stops = 72
): ScenePrimitive[] {
  const bandHeight = h / stops;
  return Array.from({ length: stops }, (_, index) => ({
    type: "rect" as const,
    x,
    y: y + index * bandHeight,
    w,
    // Overlap by a hair so no seams appear at low resolutions.
    h: bandHeight + 0.6,
    fill: mix(from, to, index / (stops - 1)),
  }));
}

/** Soft radial glow approximated by stacked translucent circles. */
export function radialGlow(cx: number, cy: number, radius: number, color: string, strength = 0.16): ScenePrimitive[] {
  const rings = 9;
  return Array.from({ length: rings }, (_, index) => {
    const t = (index + 1) / rings;
    return {
      type: "circle" as const,
      cx,
      cy,
      r: radius * (1 - t * 0.72),
      fill: color,
      opacity: (strength / rings) * (0.45 + t),
    };
  });
}

function sparkle(cx: number, cy: number, size: number, color: string, opacity = 0.85): ScenePrimitive[] {
  // Four-point sparkle: two rotated diamonds of different sizes.
  return [
    {
      type: "rect",
      x: cx - size / 2,
      y: cy - size / 9,
      w: size,
      h: size / 4.5,
      r: size / 9,
      fill: color,
      opacity,
    },
    {
      type: "rect",
      x: cx - size / 9,
      y: cy - size / 2,
      w: size / 4.5,
      h: size,
      r: size / 9,
      fill: color,
      opacity,
    },
  ];
}

/**
 * A stylised card face: foil band, inner frame, art window and a type pip.
 * Abstract on purpose — no Pokémon characters, logos or trade dress.
 */
function cardFace(
  x: number,
  y: number,
  w: number,
  h: number,
  rotate: number,
  palette: { frame: string; art: string; glow: string }
): ScenePrimitive[] {
  const pad = w * 0.07;
  return [
    // Drop shadow
    { type: "rect", x: x + 2, y: y + 3, w, h, r: 5, fill: "#000000", opacity: 0.45, rotate },
    // Frame
    {
      type: "rect",
      x,
      y,
      w,
      h,
      r: 5,
      fill: palette.frame,
      opacity: 1,
      stroke: "#ffffff",
      strokeWidth: 0.6,
      rotate,
    },
    // Art window
    {
      type: "rect",
      x: x + pad,
      y: y + pad,
      w: w - pad * 2,
      h: h * 0.52,
      r: 3,
      fill: palette.art,
      rotate,
    },
    // Art glow
    { type: "circle", cx: x + w / 2, cy: y + pad + h * 0.26, r: w * 0.16, fill: palette.glow, opacity: 0.55 },
    { type: "circle", cx: x + w / 2, cy: y + pad + h * 0.26, r: w * 0.09, fill: "#ffffff", opacity: 0.35 },
    // Text rules
    { type: "rect", x: x + pad, y: y + h * 0.62, w: w * 0.55, h: 2.4, r: 1.2, fill: "#000000", opacity: 0.35, rotate },
    { type: "rect", x: x + pad, y: y + h * 0.7, w: w * 0.8, h: 1.8, r: 0.9, fill: "#000000", opacity: 0.22, rotate },
    { type: "rect", x: x + pad, y: y + h * 0.76, w: w * 0.7, h: 1.8, r: 0.9, fill: "#000000", opacity: 0.22, rotate },
    // Type pip
    {
      type: "circle",
      cx: x + w - pad - w * 0.09,
      cy: y + h - pad - w * 0.09,
      r: w * 0.09,
      fill: "#ffffff",
      opacity: 0.9,
    },
  ];
}

/** A booster-pack silhouette with a tear notch and foil strip. */
function boosterPack(x: number, y: number, w: number, h: number, rotate: number): ScenePrimitive[] {
  return [
    { type: "rect", x: x + 2, y: y + 3, w, h, r: 6, fill: "#000000", opacity: 0.45, rotate },
    { type: "rect", x, y, w, h, r: 6, fill: "#26313f", stroke: "#5b6a80", strokeWidth: 0.9, rotate },
    { type: "rect", x: x + 5, y: y + 5, w: w - 10, h: 8, r: 2, fill: FLYER_COLORS.accent, opacity: 0.95, rotate },
    {
      type: "rect",
      x: x + 5,
      y: y + h * 0.32,
      w: w - 10,
      h: h * 0.4,
      r: 3,
      fill: FLYER_COLORS.gold,
      opacity: 0.22,
      rotate,
    },
    { type: "circle", cx: x + w / 2, cy: y + h * 0.52, r: w * 0.17, fill: FLYER_COLORS.white, opacity: 0.16 },
    { type: "rect", x: x + 8, y: y + h - 14, w: w * 0.5, h: 3, r: 1.5, fill: FLYER_COLORS.white, opacity: 0.35, rotate },
  ];
}

export interface FlyerSceneOptions {
  /** Production URL encoded in the QR code and printed in full. */
  url: string;
  /** Host shown in the large, readable line beneath the QR. */
  host: string;
  /** QR modules, dark = true. Row-major, `modules[row][col]`. */
  modules: boolean[][];
  quietZone?: number;
}

/**
 * Builds the whole flyer. Everything is vector: text, shapes and the QR code
 * itself (one rectangle per dark module), so the PDF stays crisp at any print
 * resolution and needs no bitmaps.
 */
export function buildFlyerScene({ url, host, modules, quietZone = 4 }: FlyerSceneOptions): FlyerScene {
  const { width, height } = FLYER_PT;
  const primitives: ScenePrimitive[] = [];

  // Background
  primitives.push(...verticalGradient(0, 0, width, height, "#141a26", "#07080c"));
  primitives.push(...radialGlow(width - 26, 74, 150, FLYER_COLORS.accent, 0.5));
  primitives.push(...radialGlow(22, height - 96, 140, FLYER_COLORS.gold, 0.34));
  primitives.push(...radialGlow(width / 2, 250, 190, FLYER_COLORS.blue, 0.12));

  // Thin accent rule at the very top
  primitives.push({ type: "rect", x: 0, y: 0, w: width, h: 3, fill: FLYER_COLORS.accent });

  /* ---------------- Header ---------------- */
  const markX = 24;
  const markY = 24;
  primitives.push({
    type: "rect",
    x: markX,
    y: markY,
    w: 32,
    h: 32,
    r: 9,
    fill: FLYER_COLORS.accent,
    stroke: "#ffffff",
    strokeWidth: 0.7,
  });
  // Monogram: a stylised card + spark, drawn with rectangles only.
  primitives.push({ type: "rect", x: markX + 9, y: markY + 7.5, w: 14, h: 17, r: 2.5, fill: FLYER_COLORS.white, opacity: 0.95 });
  primitives.push({ type: "rect", x: markX + 11.5, y: markY + 10, w: 9, h: 6, r: 1.4, fill: FLYER_COLORS.accent });
  primitives.push({ type: "rect", x: markX + 11.5, y: markY + 18, w: 6.5, h: 1.7, r: 0.85, fill: FLYER_COLORS.accent, opacity: 0.8 });
  primitives.push({ type: "rect", x: markX + 11.5, y: markY + 21, w: 5, h: 1.7, r: 0.85, fill: FLYER_COLORS.accent, opacity: 0.55 });

  primitives.push({
    type: "text",
    x: markX + 42,
    y: markY + 15,
    text: "POKEGURU",
    size: 21,
    font: "bold",
    color: FLYER_COLORS.text,
    tracking: 2.4,
  });
  primitives.push({
    type: "text",
    x: markX + 43,
    y: markY + 29,
    text: "Your Pokémon TCG companion.",
    size: 9.5,
    font: "italic",
    color: FLYER_COLORS.muted,
  });

  /* ---------------- Hero artwork ---------------- */
  primitives.push(...boosterPack(248, 62, 56, 82, 13));
  primitives.push(
    ...cardFace(64, 96, 62, 86, -11, {
      frame: "#e8566a",
      art: "#2a1220",
      glow: FLYER_COLORS.gold,
    })
  );
  primitives.push(
    ...cardFace(150, 82, 76, 104, 2, {
      frame: "#1d2740",
      art: "#0e1a2c",
      glow: FLYER_COLORS.blue,
    })
  );
  // Holo sheen sweeping across the centre card.
  primitives.push({ type: "rect", x: 156, y: 96, w: 16, h: 84, r: 8, fill: "#ffffff", opacity: 0.07, rotate: 18 });
  primitives.push({ type: "rect", x: 196, y: 96, w: 7, h: 84, r: 3.5, fill: FLYER_COLORS.blue, opacity: 0.12, rotate: 18 });
  primitives.push(
    ...cardFace(236, 100, 62, 86, 12, {
      frame: "#f0c05a",
      art: "#241a08",
      glow: FLYER_COLORS.green,
    })
  );
  primitives.push(...sparkle(126, 92, 13, FLYER_COLORS.gold, 0.95));
  primitives.push(...sparkle(300, 168, 10, FLYER_COLORS.blue, 0.9));
  primitives.push(...sparkle(46, 176, 8, FLYER_COLORS.accent, 0.85));

  /* ---------------- Headline ---------------- */
  primitives.push({
    type: "text",
    x: width / 2,
    y: 236,
    text: "DISCOVER. COLLECT. OPEN.",
    size: 18,
    font: "bold",
    color: FLYER_COLORS.gold,
    align: "center",
    tracking: 1.5,
  });
  primitives.push({
    type: "rect",
    x: width / 2 - 26,
    y: 245,
    w: 52,
    h: 2,
    r: 1,
    fill: FLYER_COLORS.accent,
  });

  const body = [
    "Explore every Pokémon card and expansion.",
    "Track your collection and follow real market prices.",
    "Open unlimited FREE virtual booster packs.",
  ];
  body.forEach((line, index) => {
    primitives.push({
      type: "text",
      x: width / 2,
      y: 264 + index * 12,
      text: line,
      size: 9,
      font: "regular",
      color: FLYER_COLORS.muted,
      align: "center",
    });
  });

  /* ---------------- QR code ---------------- */
  const panelX = 62;
  const panelY = 296;
  const panelW = width - panelX * 2;
  const panelH = 156;
  primitives.push({
    type: "rect",
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    r: 12,
    fill: FLYER_COLORS.white,
  });
  const qrSize = 118;
  const qrX = width / 2 - qrSize / 2;
  const qrY = panelY + 8;
  primitives.push({
    type: "qr",
    x: qrX,
    y: qrY,
    size: qrSize,
    modules,
    quiet: quietZone,
    dark: "#000000",
    light: FLYER_COLORS.white,
  });

  primitives.push({
    type: "text",
    x: width / 2,
    y: qrY + qrSize + 19,
    text: host,
    size: 13,
    font: "bold",
    color: "#0b0d12",
    align: "center",
    tracking: 0.2,
  });

  /* ---------------- Badge + footer ---------------- */
  const badgeText = "FREE TO EXPLORE · UNLIMITED VIRTUAL PACK OPENINGS";
  const badgeW = 268;
  const badgeX = width / 2 - badgeW / 2;
  primitives.push({
    type: "rect",
    x: badgeX,
    y: 458,
    w: badgeW,
    h: 18,
    r: 9,
    fill: FLYER_COLORS.gold,
  });
  primitives.push({
    type: "text",
    x: width / 2,
    y: 466,
    text: badgeText,
    size: 7.2,
    font: "bold",
    color: "#20160a",
    align: "center",
    tracking: 0.55,
  });

  primitives.push({
    type: "text",
    x: width / 2,
    y: 484,
    text: "Unofficial fan-made companion. No physical cards are supplied or sold.",
    size: 5.6,
    font: "regular",
    color: FLYER_COLORS.mutedDim,
    align: "center",
  });
  primitives.push({
    type: "text",
    x: width / 2,
    y: 493,
    text: "Not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures Inc. or GAME FREAK.",
    size: 5.6,
    font: "regular",
    color: FLYER_COLORS.mutedDim,
    align: "center",
  });

  return {
    width,
    height,
    title: "PokeGuru — Your Pokémon TCG companion",
    url,
    primitives,
  };
}

/** Renders the scene as standalone SVG (vector). Used by previews and tests. */
export function sceneToSvg(scene: FlyerScene): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">`,
    `<title>${escapeXml(scene.title)}</title>`,
    `<desc>Unofficial fan-made flyer for ${escapeXml(scene.url)}. No physical cards supplied.</desc>`,
    `<rect width="${scene.width}" height="${scene.height}" fill="#07080c"/>`,
  ];

  for (const primitive of scene.primitives) {
    if (primitive.type === "rect") {
      if (!primitive.fill && !primitive.stroke) continue;
      const centreX = primitive.x + primitive.w / 2;
      const centreY = primitive.y + primitive.h / 2;
      const transform = primitive.rotate ? ` transform="rotate(${primitive.rotate} ${num(centreX)} ${num(centreY)})"` : "";
      const attrs = [
        `x="${num(primitive.x)}"`,
        `y="${num(primitive.y)}"`,
        `width="${num(primitive.w)}"`,
        `height="${num(primitive.h)}"`,
        primitive.r ? `rx="${num(primitive.r)}"` : "",
        primitive.fill && primitive.fill !== "none" ? `fill="${primitive.fill}"` : `fill="none"`,
        primitive.opacity !== undefined ? `fill-opacity="${num(primitive.opacity)}"` : "",
        primitive.stroke ? `stroke="${primitive.stroke}"` : "",
        primitive.strokeWidth !== undefined ? `stroke-width="${num(primitive.strokeWidth)}"` : "",
        transform,
      ]
        .filter(Boolean)
        .join(" ");
      parts.push(`<rect ${attrs}/>`);
      continue;
    }

    if (primitive.type === "circle") {
      const attrs = [
        `cx="${num(primitive.cx)}"`,
        `cy="${num(primitive.cy)}"`,
        `r="${num(primitive.r)}"`,
        primitive.fill ? `fill="${primitive.fill}"` : `fill="none"`,
        primitive.opacity !== undefined ? `fill-opacity="${num(primitive.opacity)}"` : "",
        primitive.stroke ? `stroke="${primitive.stroke}"` : "",
        primitive.strokeWidth !== undefined ? `stroke-width="${num(primitive.strokeWidth)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      parts.push(`<circle ${attrs}/>`);
      continue;
    }

    if (primitive.type === "text") {
      const anchor = primitive.align === "center" ? "middle" : primitive.align === "right" ? "end" : "start";
      const weight = primitive.font === "bold" ? 700 : primitive.font === "italic" ? 400 : 400;
      const style = primitive.font === "italic" ? "italic" : "normal";
      parts.push(
        `<text x="${num(primitive.x)}" y="${num(primitive.y)}" fill="${primitive.color}" font-family="Helvetica, Arial, sans-serif" font-size="${num(
          primitive.size
        )}" font-weight="${weight}" font-style="${style}" text-anchor="${anchor}"${
          primitive.tracking ? ` letter-spacing="${num(primitive.tracking)}"` : ""
        }${primitive.opacity !== undefined ? ` fill-opacity="${num(primitive.opacity)}"` : ""}>${escapeXml(primitive.text)}</text>`
      );
      continue;
    }

    // QR: quiet zone as a light plate, then one rect per dark module.
    const quiet = primitive.quiet;
    const total = primitive.modules.length + quiet * 2;
    const cell = primitive.size / total;
    parts.push(
      `<rect x="${num(primitive.x)}" y="${num(primitive.y)}" width="${num(primitive.size)}" height="${num(primitive.size)}" fill="${
        primitive.light
      }"/>`
    );
    for (let row = 0; row < primitive.modules.length; row += 1) {
      for (let col = 0; col < primitive.modules[row].length; col += 1) {
        if (!primitive.modules[row][col]) continue;
        parts.push(
          `<rect x="${num(primitive.x + (col + quiet) * cell)}" y="${num(primitive.y + (row + quiet) * cell)}" width="${num(
            cell
          )}" height="${num(cell)}" fill="${primitive.dark}"/>`
        );
      }
    }
  }

  parts.push("</svg>");
  return parts.join("\n");
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
