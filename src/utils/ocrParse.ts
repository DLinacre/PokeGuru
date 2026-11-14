/**
 * Pure helpers for turning OCR output into candidate card names.
 * Kept free of browser APIs so they can be unit tested in isolation.
 */

const NOISE_PATTERNS = [
  /^basic\b/i,
  /^stage\s*\d/i,
  /^evolves?\s+from/i,
  /^\d+\s*hp\b/i,
  /^hp\s*\d+/i,
  /^(weakness|resistance|retreat)\b/i,
  /^(ability|pokemon power|poké-power|poké-body)\b/i,
  /^(trainer|supporter|stadium|item|tool|special energy|basic energy)\b/i,
  /^illus(trator)?\.?\b/i,
  /^\d+\s*\/\s*\d+$/,
  /^(v|vmax|vstar|ex|gx|lv\.?x)$/i,
  /^©/,
  /^[^A-Za-z]*$/,
];

function isLikelyName(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 42) return false;
  if (NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;

  // Card names do not contain colons; rules text almost always does.
  if (trimmed.includes(":")) return false;

  const letters = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 3) return false;
  if (letters / trimmed.length < 0.7) return false;
  if (/\d{3,}/.test(trimmed)) return false;

  // Card names start with an upper-case letter (or an all-caps promo label).
  if (!/^[A-Z]/.test(trimmed)) return false;

  // Reject lines that look like sentences (rules text).
  if (trimmed.split(/\s+/).length > 5) return false;
  if (/[.,;!?]$/.test(trimmed) && trimmed.split(/\s+/).length > 2) return false;
  // Rules text is written as a sentence; card names are not.
  if (/\b(this attack|your turn|each player|flip a coin|does \d)\b/i.test(trimmed)) return false;

  return true;
}

export interface NameCandidate {
  name: string;
  score: number;
}

/**
 * Extract likely card names from OCR text.
 *
 * Card names sit near the top of the card, so earlier lines score higher.
 * Tesseract often splits "Charizard ex" over one line and merges stray
 * glyphs; we normalise whitespace/punctuation and de-duplicate.
 */
export function extractNameCandidates(text: string, limit = 5): NameCandidate[] {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|_~`^<>[\]{}]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const scored = new Map<string, { name: string; score: number }>();
  lines.forEach((line, index) => {
    if (!isLikelyName(line)) return;
    const cleaned = line.replace(/[^A-Za-z0-9'’.\- ]/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const positionWeight = Math.max(0, 1 - index / Math.max(6, lines.length));
    const lengthWeight = cleaned.length >= 4 && cleaned.length <= 24 ? 0.35 : 0.15;
    const score = positionWeight + lengthWeight;
    const key = cleaned.toLowerCase();
    const previous = scored.get(key);
    if (!previous || score > previous.score) {
      scored.set(key, { name: cleaned, score });
    }
  });

  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Extract a collector number such as "136/201" or "TG05/TG30". */
export function extractCardNumber(text: string): { number: string; total?: string } | null {
  const match = text.match(/\b([A-Z]{0,2}\d{1,3})\s*\/\s*([A-Z]{0,2}\d{1,3})\b/i);
  if (!match) return null;
  return { number: match[1].toUpperCase(), total: match[2].toUpperCase() };
}

/** Normalise a name for comparison: lower-case, strip punctuation/spacing. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Rank likely matches: exact name beats a prefix/contains match, and a
 * matching collector number adds confidence.
 */
export function scoreMatch(
  candidateName: string,
  card: { name: string; localId?: string },
  detectedNumber?: string
): number {
  const a = normaliseName(candidateName);
  const b = normaliseName(card.name);
  if (!a || !b) return 0;

  let score = 0;
  if (a === b) score += 10;
  else if (b.startsWith(a) || a.startsWith(b)) score += 6;
  else if (b.includes(a) || a.includes(b)) score += 3;

  if (detectedNumber && card.localId) {
    // Collector numbers are zero-padded inconsistently ("006" vs "6").
    const a = detectedNumber.toUpperCase().replace(/^0+(?=\d)/, "");
    const b = card.localId.toUpperCase().replace(/^0+(?=\d)/, "");
    if (a === b) score += 5;
  }
  return score;
}
