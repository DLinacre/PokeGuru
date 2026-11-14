import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "pokeguru_install_prompt_v1";
/** Ignore repeat dismissals for this long; the reminder is opt-out, not nagware. */
const DISMISS_DAYS = 60;
/** Wait for the page to be usable before inviting anyone to install. */
const SHOW_DELAY_MS = 7000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "native" | "ios" | "unsupported";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

function detectPlatform(hasNativePrompt: boolean): Platform {
  if (hasNativePrompt) return "native";
  if (typeof navigator === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Safari on iOS never fires beforeinstallprompt; adding to the home screen is
  // still possible through the share sheet, so we can explain that honestly.
  if (ios) return "ios";
  return "unsupported";
}

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode — the prompt simply shows again next visit */
  }
}

/**
 * Optional, dismissible invitation to install PokeGuru.
 *
 * Only the native `beforeinstallprompt` event proves a browser can install the
 * app, so the invitation stays hidden when that event never fires — except on
 * iOS, where we show the share-sheet instructions instead of pretending a
 * one-tap prompt exists.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onBeforeInstall = (event: Event) => {
      // Chrome only allows prompt() to be called later if the default is
      // prevented, so keep the event and show our own invitation instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const platform = detectPlatform(Boolean(deferredPrompt));

  if (installed || !visible || platform === "unsupported") return null;

  const dismiss = () => {
    setVisible(false);
    rememberDismissal();
  };

  const install = async () => {
    if (!deferredPrompt) {
      setShowIosSteps(true);
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      setVisible(false);
      return;
    }
    // The visitor said no in the browser's own dialogue: stop asking.
    dismiss();
    setDeferredPrompt(null);
  };

  return (
    <aside
      aria-labelledby="install-heading"
      className="fixed bottom-20 left-3 right-3 z-[65] mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[rgba(16,19,25,0.97)] shadow-2xl backdrop-blur-xl sm:bottom-6 sm:left-auto sm:right-6"
    >
      <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-[var(--accent-2)] to-[var(--link)]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)]">
            <Smartphone size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="install-heading" className="text-sm font-black uppercase tracking-wide">
              Take PokeGuru with you!
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Install PokeGuru for quick access to your collection, card searches and free virtual pack openings.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            aria-label="Dismiss install invitation"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {showIosSteps && platform === "ios" && (
          <ol className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-inset)] p-3 text-[11px] leading-relaxed text-[var(--text-soft)]">
            <li className="flex items-start gap-2">
              <span className="font-black text-[var(--accent-text)]">1.</span>
              <span>
                Tap the <Share size={11} className="inline" aria-hidden="true" /> Share button in Safari.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-black text-[var(--accent-text)]">2.</span>
              <span>Choose “Add to Home Screen”.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-black text-[var(--accent-text)]">3.</span>
              <span>Tap “Add” — PokeGuru opens like an app from your home screen.</span>
            </li>
          </ol>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void install()} className="btn btn-primary px-3.5 py-2 text-xs">
            <Download size={13} aria-hidden="true" />
            Install PokeGuru
          </button>
          <button type="button" onClick={dismiss} className="btn btn-ghost px-3.5 py-2 text-xs">
            Maybe later
          </button>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
          {platform === "native"
            ? "Optional — your browser will ask before anything is installed."
            : "Optional — iOS installs apps from the Safari share sheet, so there is no automatic prompt to show."}
        </p>
      </div>
    </aside>
  );
}
