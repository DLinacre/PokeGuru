/**
 * PDF renderer for the flyer scene.
 *
 * pdf-lib is imported lazily so the ~350 kB library is only fetched when a
 * visitor actually asks for the flyer. Everything drawn here is vector: text
 * uses the standard PDF fonts (no font files to download, no bitmaps), shapes
 * are native paths and the QR code is one rectangle per module.
 */

import type { FontFace, FlyerScene, ScenePrimitive } from "./scene";
import { FLYER_MM } from "./scene";

import type { PDFFont, PDFPage } from "pdf-lib";

type PdfDocumentModule = typeof import("pdf-lib");

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

export interface RenderedPdf {
  bytes: Uint8Array;
  /** Page size in PostScript points (1/72 in). */
  points: { width: number; height: number };
  /** Page size in millimetres, for the report and the UI. */
  millimetres: { width: number; height: number };
}

export async function renderFlyerPdf(scene: FlyerScene): Promise<RenderedPdf> {
  const pdfLib: PdfDocumentModule = await import("pdf-lib");
  const { PDFDocument, StandardFonts, degrees, rgb } = pdfLib;

  const doc = await PDFDocument.create();
  doc.setTitle(scene.title);
  doc.setAuthor("PokeGuru");
  doc.setSubject(`PokeGuru promotional flyer (5 × 7 in) — ${scene.url}`);
  doc.setKeywords(["PokeGuru", "Pokémon TCG", "flyer", "QR code", "promotional"]);
  doc.setCreator("PokeGuru flyer generator");
  doc.setProducer("PokeGuru (pdf-lib)");
  doc.setCreationDate(new Date());

  const page = doc.addPage([scene.width, scene.height]);
  // Belt and braces: the page box is the flyer size, so no viewer can silently
  // re-page it to A4 on export.
  page.setMediaBox(0, 0, scene.width, scene.height);
  page.setCropBox(0, 0, scene.width, scene.height);

  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  const flip = (y: number) => scene.height - y;

  for (const primitive of scene.primitives) {
    drawPrimitive(page, primitive, { pageHeight: scene.height, flip, fonts, rgb, degrees });
  }

  const bytes = await doc.save();
  return {
    bytes,
    points: { width: scene.width, height: scene.height },
    millimetres: { width: FLYER_MM.width, height: FLYER_MM.height },
  };
}

interface DrawContext {
  pageHeight: number;
  flip: (y: number) => number;
  fonts: Record<FontFace, PDFFont>;
  rgb: PdfDocumentModule["rgb"];
  degrees: PdfDocumentModule["degrees"];
}

/** Draws text with optional letter tracking, honouring left/centre/right alignment. */
function drawTrackedText(
  page: PDFPage,
  context: DrawContext,
  primitive: Extract<ScenePrimitive, { type: "text" }>
) {
  const font = context.fonts[primitive.font];
  const tracking = primitive.tracking ?? 0;
  const characters = [...primitive.text];
  const width =
    characters.reduce((sum, char) => sum + font.widthOfTextAtSize(char, primitive.size), 0) +
    tracking * Math.max(0, characters.length - 1);

  let x = primitive.x;
  if (primitive.align === "center") x -= width / 2;
  if (primitive.align === "right") x -= width;

  const options = {
    size: primitive.size,
    font,
    color: context.rgb(...toTriplet(primitive.color)),
    opacity: primitive.opacity,
  };

  if (!tracking) {
    page.drawText(primitive.text, { ...options, x, y: context.flip(primitive.y) });
    return;
  }

  let cursor = x;
  for (const char of characters) {
    page.drawText(char, { ...options, x: cursor, y: context.flip(primitive.y) });
    cursor += font.widthOfTextAtSize(char, primitive.size) + tracking;
  }
}

function toTriplet(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  return [r, g, b];
}

/** SVG path for a rounded rectangle, using the flyer's top-left origin convention. */
function roundedRectPath(w: number, h: number, radius: number): string {
  const r = Math.max(0.1, Math.min(radius, w / 2, h / 2));
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

/**
 * Origin for a path drawn in top-left coordinates, rotated about its centre.
 * drawSvgPath places the path's (0,0) at x,y and grows downwards, and its
 * `rotate` turns the path about that same point.
 */
function pathOrigin(
  primitive: Extract<ScenePrimitive, { type: "rect" }>,
  pageHeight: number,
  degrees: DrawContext["degrees"]
) {
  const rotation = primitive.rotate ?? 0;
  const centreX = primitive.x + primitive.w / 2;
  const centreY = pageHeight - (primitive.y + primitive.h / 2);
  if (!rotation) {
    // Path origin is the top-left corner: shift up by the height.
    return { x: primitive.x, y: pageHeight - primitive.y, rotate: degrees(0) };
  }
  const phi = (-rotation * Math.PI) / 180;
  const local = { x: primitive.w / 2, y: -primitive.h / 2 };
  const rotated = {
    x: local.x * Math.cos(phi) - local.y * Math.sin(phi),
    y: local.x * Math.sin(phi) + local.y * Math.cos(phi),
  };
  return { x: centreX - rotated.x, y: centreY - rotated.y, rotate: degrees(-rotation) };
}

/** Rotates a scene rectangle about its centre, returning the PDF-space origin. */
function rotatedOrigin(
  primitive: Extract<ScenePrimitive, { type: "rect" }>,
  pageHeight: number,
  degrees: DrawContext["degrees"]
) {
  const centreX = primitive.x + primitive.w / 2;
  const centreY = pageHeight - (primitive.y + primitive.h / 2);
  const rotation = primitive.rotate ?? 0;
  if (!rotation) return { x: primitive.x, y: pageHeight - primitive.y - primitive.h, rotate: degrees(0) };

  // Scene rotation is clockwise (y grows down), PDF rotation is anticlockwise.
  const theta = (-rotation * Math.PI) / 180;
  const dx = -(primitive.w / 2) * Math.cos(theta) + (primitive.h / 2) * Math.sin(theta);
  const dy = -(primitive.w / 2) * Math.sin(theta) - (primitive.h / 2) * Math.cos(theta);
  return { x: centreX + dx, y: centreY + dy, rotate: degrees(-rotation) };
}

function drawPrimitive(page: PDFPage, primitive: ScenePrimitive, context: DrawContext) {
  switch (primitive.type) {
    case "rect": {
      const hasFill = Boolean(primitive.fill) && primitive.fill !== "none";
      const hasStroke = Boolean(primitive.stroke);
      if (!hasFill && !hasStroke) return;

      if (primitive.r && primitive.r > 0) {
        const origin = pathOrigin(primitive, context.pageHeight, context.degrees);
        page.drawSvgPath(roundedRectPath(primitive.w, primitive.h, primitive.r), {
          x: origin.x,
          y: origin.y,
          rotate: origin.rotate,
          ...(hasFill ? { color: context.rgb(...toTriplet(primitive.fill as string)) } : {}),
          ...(hasStroke
            ? { borderColor: context.rgb(...toTriplet(primitive.stroke as string)), borderWidth: primitive.strokeWidth ?? 1 }
            : {}),
          opacity: primitive.opacity ?? 1,
          borderOpacity: primitive.opacity ?? 1,
        });
        return;
      }

      const origin = rotatedOrigin(primitive, context.pageHeight, context.degrees);
      page.drawRectangle({
        x: origin.x,
        y: origin.y,
        width: primitive.w,
        height: primitive.h,
        rotate: origin.rotate,
        ...(hasFill ? { color: context.rgb(...toTriplet(primitive.fill as string)) } : {}),
        ...(hasStroke ? { borderColor: context.rgb(...toTriplet(primitive.stroke as string)), borderWidth: primitive.strokeWidth ?? 1 } : {}),
        opacity: primitive.opacity ?? 1,
        borderOpacity: primitive.opacity ?? 1,
      });
      return;
    }
    case "circle": {
      page.drawCircle({
        x: primitive.cx,
        y: context.flip(primitive.cy),
        size: primitive.r,
        ...(primitive.fill ? { color: context.rgb(...toTriplet(primitive.fill)) } : {}),
        ...(primitive.stroke
          ? { borderColor: context.rgb(...toTriplet(primitive.stroke)), borderWidth: primitive.strokeWidth ?? 1 }
          : {}),
        opacity: primitive.opacity ?? 1,
        borderOpacity: primitive.opacity ?? 1,
      });
      return;
    }
    case "text": {
      drawTrackedText(page, context, primitive);
      return;
    }
    case "qr": {
      const total = primitive.modules.length + primitive.quiet * 2;
      const cell = primitive.size / total;
      // Light plate (includes the required quiet zone).
      page.drawRectangle({
        x: primitive.x,
        y: context.flip(primitive.y + primitive.size),
        width: primitive.size,
        height: primitive.size,
        color: context.rgb(...toTriplet(primitive.light)),
      });
      const dark = context.rgb(...toTriplet(primitive.dark));
      for (let row = 0; row < primitive.modules.length; row += 1) {
        for (let col = 0; col < primitive.modules[row].length; col += 1) {
          if (!primitive.modules[row][col]) continue;
          const x = primitive.x + (col + primitive.quiet) * cell;
          const y = primitive.y + (row + primitive.quiet) * cell;
          page.drawRectangle({
            x,
            y: context.flip(y + cell),
            // Tiny overlap stops hairline seams between neighbouring modules.
            width: cell + 0.05,
            height: cell + 0.05,
            color: dark,
          });
        }
      }
      return;
    }
  }
}
