/**
 * Sharing helpers for simulated pulls.
 *
 * Everything is generated in the browser from public card data — no account
 * identifiers, no analytics, no server. A replay link only carries the set id,
 * count and seed, all of which are already visible in the URL.
 */

import type { PackResult } from "../types/packs";
import { TIER_LABELS, tierRank } from "../data/packRules";

export function resultToText(result: PackResult): string {
  const lines = [
    `PokeGuru Pack Simulator — ${result.setName} (${result.setId})`,
    new Date(result.openedAt).toLocaleString("en-GB", { timeZone: "UTC" }),
    "",
  ];
  for (const card of result.cards) {
    const finish = card.treatment === "reverse" ? " (reverse)" : card.treatment === "holo" ? " (holo)" : "";
    lines.push(`• ${card.name} — ${card.setName} #${card.localId} · ${TIER_LABELS[card.tier]}${finish}`);
  }
  lines.push(
    "",
    "Simulated pulls only. No physical card or monetary value is supplied or implied.",
    "Pull odds are estimates unless the pack panel says otherwise."
  );
  return lines.join("\n");
}

export function batchToText(results: PackResult[]): string {
  if (!results.length) return "";
  const lines = [
    `PokeGuru Pack Simulator — ${results.length} pack${results.length === 1 ? "" : "s"} of ${results[0].setName}`,
    "",
  ];

  results.forEach((result, index) => {
    const best = bestPull(result);
    lines.push(
      `Pack ${index + 1} · ${best ? `best: ${best.name} (${TIER_LABELS[best.tier]})` : "no rare pull"}`
    );
    for (const card of result.cards) {
      lines.push(`   - ${card.name} · ${TIER_LABELS[card.tier]}${card.treatment === "reverse" ? " · reverse" : card.treatment === "holo" ? " · holo" : ""}`);
    }
  });

  lines.push(
    "",
    "Simulated pulls only. No physical card or monetary value is supplied or implied."
  );
  return lines.join("\n");
}

export function bestPull(result: PackResult) {
  return result.cards.reduce<PackResult["cards"][number] | null>((best, card) => {
    if (!best) return card;
    return tierRank(card.tier) >= tierRank(best.tier) ? card : best;
  }, null);
}

/** Trigger a client-side text download (no network, no tracking). */
export function downloadText(filename: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Absolute URL that replays a single seeded pack. */
export function buildReplayUrl(result: PackResult, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams({
    count: "1",
    seed: result.seed,
    replay: result.id,
  });
  return `${base}/packs/${encodeURIComponent(result.setId)}?${params.toString()}`;
}

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
