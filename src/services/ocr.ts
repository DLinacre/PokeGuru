/**
 * On-demand OCR for the card scanner.
 *
 * Tesseract.js is ~1MB of JS + WASM and is loaded *only* when a collector
 * actually scans an image, so it never affects first load. The engine and
 * language data are fetched from the official jsDelivr/CDN paths and cached
 * by the service worker afterwards.
 */

import type { TcgCard } from "../types/pokemon";
import { searchCards } from "./tcgdex";
import { extractCardNumber, extractNameCandidates, scoreMatch } from "../utils/ocrParse";
import { SEARCH_PAGE_SIZE } from "../utils/search";

export type OcrStatus =
  | "idle"
  | "loading-engine"
  | "recognising"
  | "matching"
  | "done"
  | "no-text"
  | "unavailable";

export interface OcrProgress {
  status: OcrStatus;
  progress: number;
  detail?: string;
}

export interface OcrCandidateMatch {
  card: TcgCard;
  score: number;
}

export interface OcrResult {
  status: Extract<OcrStatus, "done" | "no-text">;
  text: string;
  confidence: number | null;
  names: string[];
  detectedNumber?: string;
  matches: OcrCandidateMatch[];
}

/** Scale an image down and boost contrast — big accuracy win for phone photos. */
async function preprocess(imageDataUrl: string): Promise<HTMLCanvasElement> {
  const bitmap = await loadImage(imageDataUrl);
  const maxWidth = 1000;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  // Grayscale + simple contrast stretch around mid-grey.
  const contrast = 1.35;
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = Math.min(255, Math.max(0, (grey - 128) * contrast + 128));
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = src;
  });
}

/**
 * Run OCR and look for matching cards in the live database.
 * Throws only for unexpected failures; capability problems resolve with
 * status "unavailable" so the UI can explain them honestly.
 */
export async function recogniseCard(
  imageDataUrl: string,
  onProgress?: (progress: OcrProgress) => void,
  onWorker?: (worker: { terminate: () => Promise<unknown> }) => void
): Promise<OcrResult> {
  onProgress?.({ status: "loading-engine", progress: 0, detail: "Loading text recognition…" });

  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  try {
    const { createWorker } = await import("tesseract.js");

    const canvas = await preprocess(imageDataUrl);

    worker = await createWorker("eng", 1, {
      logger: (message: { status: string; progress: number }) => {
        if (message.status === "recognizing text") {
          onProgress?.({
            status: "recognising",
            progress: message.progress,
            detail: "Reading card text…",
          });
        }
      },
    });

    onWorker?.(worker);
    onProgress?.({ status: "recognising", progress: 0, detail: "Reading card text…" });
    const { data } = await worker.recognize(canvas);
    const text = (data.text ?? "").trim();
    const confidence = typeof data.confidence === "number" ? data.confidence : null;

    if (!text) {
      return { status: "no-text", text: "", confidence, names: [], matches: [] };
    }

    const names = extractNameCandidates(text).map((candidate) => candidate.name);
    const detected = extractCardNumber(text);

    if (!names.length) {
      return {
        status: "no-text",
        text,
        confidence,
        names: [],
        detectedNumber: detected?.number,
        matches: [],
      };
    }

    onProgress?.({ status: "matching", progress: 0.9, detail: "Matching against the card database…" });

    const collected = new Map<string, OcrCandidateMatch>();
    for (const name of names.slice(0, 3)) {
      try {
        const response = await searchCards({
          query: name,
          category: "",
          rarity: "",
          setId: "",
          sort: "name",
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
        });
        for (const card of response.cards) {
          const score = scoreMatch(name, card, detected?.number);
          if (score <= 0) continue;
          const existing = collected.get(card.id);
          if (!existing || existing.score < score) collected.set(card.id, { card, score });
        }
      } catch {
        // A failed candidate search should not kill the whole scan.
      }
    }

    const matches = [...collected.values()].sort((a, b) => b.score - a.score).slice(0, 12);
    onProgress?.({ status: "done", progress: 1, detail: "Scan complete" });

    return {
      status: "done",
      text,
      confidence,
      names,
      detectedNumber: detected?.number,
      matches,
    };
  } catch (err) {
    console.error("PokeGuru OCR failed", err);
    onProgress?.({
      status: "unavailable",
      progress: 0,
      detail: "Text recognition could not start in this browser.",
    });
    throw new OcrUnavailableError(
      "Text recognition could not start. This can happen when the OCR assets are blocked by your network or the browser does not support WebAssembly."
    );
  } finally {
    try {
      await worker?.terminate();
    } catch {
      /* ignore */
    }
  }
}

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}
