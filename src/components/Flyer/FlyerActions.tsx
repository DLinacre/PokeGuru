import { useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Printer } from "lucide-react";
import { cn } from "../../utils/cn";
import { FlyerConfigurationError, downloadFlyer, printFlyer, resolveFlyerOrigin } from "../../services/flyer";

type Status = { tone: "ok" | "warn" | "error"; text: string } | null;

interface FlyerActionsProps {
  variant?: "full" | "compact";
  className?: string;
  /** Show the printer button (kept on for every surface by default). */
  showPrint?: boolean;
}

/**
 * Download / print controls for the 5 × 7 in promotional flyer.
 *
 * The PDF is generated in the browser on demand, so the button always hands
 * out the current design with a QR code for the live production address — there
 * is no stale static file to forget about, and no server work.
 */
export default function FlyerActions({ variant = "full", className, showPrint = true }: FlyerActionsProps) {
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const origin = useMemo(() => resolveFlyerOrigin(), []);
  const compact = variant === "compact";

  const handleDownload = async () => {
    if (busy) return;
    setBusy("download");
    setStatus(null);
    try {
      const file = await downloadFlyer();
      setStatus({
        tone: "ok",
        text: `Saved ${file.fileName} — ${file.millimetres.width} × ${file.millimetres.height} mm, print at 100%.`,
      });
    } catch (error) {
      setStatus({
        tone: error instanceof FlyerConfigurationError ? "warn" : "error",
        text:
          error instanceof FlyerConfigurationError
            ? error.message
            : "The flyer could not be generated in this browser. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    if (busy) return;
    setBusy("print");
    setStatus(null);
    try {
      const { printed, downloaded } = await printFlyer();
      setStatus({
        tone: printed || downloaded ? "ok" : "warn",
        text: printed
          ? "Print dialogue opened at 5 × 7 in — keep the scale at 100% / Actual size."
          : downloaded
            ? "Your browser blocked the print window, so the PDF was downloaded instead. Print it at 100%."
            : "The print window could not be opened. Use Download PokeGuru Flyer and print the PDF instead.",
      });
    } catch (error) {
      setStatus({
        tone: error instanceof FlyerConfigurationError ? "warn" : "error",
        text:
          error instanceof FlyerConfigurationError
            ? error.message
            : "The flyer could not be generated in this browser. Please try again.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy !== null}
          className={cn("btn btn-primary no-underline", compact ? "text-xs" : "")}
          aria-describedby="flyer-note"
        >
          {busy === "download" ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={15} aria-hidden="true" />
          )}
          <span aria-hidden="true">🎴</span> {busy === "download" ? "Generating…" : "Download PokeGuru Flyer"}
        </button>

        {showPrint && (
          <button type="button" onClick={handlePrint} disabled={busy !== null} className={cn("btn btn-secondary", compact ? "text-xs" : "")}>
            {busy === "print" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Printer size={14} aria-hidden="true" />}
            Print flyer
          </button>
        )}
      </div>

      {compact ? (
        <p id="flyer-note" className="text-[11px] text-[var(--muted)]">
          5 × 7 in print-ready PDF · QR links to{" "}
          <strong className="text-[var(--text-soft)]">{origin.origin ? origin.host : "the live site once configured"}</strong>
        </p>
      ) : (
        <p id="flyer-note" className="text-xs leading-relaxed text-[var(--muted)]">
          One-page, print-ready PDF · exactly 5 × 7 in (127 × 177.8 mm) · the QR code links to{" "}
          <strong className="text-[var(--text-soft)]">{origin.origin ? origin.host : "the live site once configured"}</strong>. Free to
          download, print and share — no account needed.
        </p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {status && (
          <p
            className={cn(
              "flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed",
              status.tone === "ok" && "border-[var(--success)]/35 bg-[var(--success-soft)] text-[var(--success)]",
              status.tone === "warn" && "border-[var(--accent-2)]/40 bg-[var(--warning-soft)] text-[var(--accent-2)]",
              status.tone === "error" && "border-[var(--accent)]/40 bg-[var(--bg-elevated)] text-[var(--accent-text)]"
            )}
          >
            {status.tone === "ok" ? (
              <Check size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{status.text}</span>
          </p>
        )}
      </div>

      {!origin.origin && (
        <p className="flex items-start gap-1.5 rounded-lg border border-[var(--accent-2)]/40 bg-[var(--warning-soft)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--accent-2)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Flyer not configured:</strong> set <code className="font-mono">VITE_PUBLIC_SITE_URL</code> to the live site address and
            rebuild, so the printed QR code can never point at a preview deployment.
          </span>
        </p>
      )}

      {!compact && (
        <p className="text-[10px] leading-relaxed text-[var(--muted-dim)]">
          Wrapper artwork and logo are original PokeGuru designs. Promotional flyer for an unofficial fan-made companion — no physical
          cards are supplied and there is no affiliation with The Pokémon Company.
        </p>
      )}
    </div>
  );
}
