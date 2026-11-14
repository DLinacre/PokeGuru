import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { applyServiceWorkerUpdate, registerServiceWorker } from "../../services/pwa";

/** Prompts the collector when a newer app version has been downloaded. */
export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cleanup = registerServiceWorker(() => setReady(true));
    return cleanup;
  }, []);

  if (!ready || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-2xl sm:bottom-6 sm:left-auto sm:right-6"
    >
      <RefreshCw size={18} className="shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
      <p className="flex-1 text-sm text-[var(--text)]">A new PokeGuru version is ready.</p>
      <button
        type="button"
        onClick={() => void applyServiceWorkerUpdate()}
        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#dc2626]"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-[var(--muted)] hover:text-[var(--text)]"
        aria-label="Dismiss update notice"
      >
        <X size={14} />
      </button>
    </div>
  );
}
