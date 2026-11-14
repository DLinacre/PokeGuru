/**
 * Service worker registration and update plumbing.
 *
 * Cache safety: a new worker never activates until the user accepts the
 * update, and stale app-shell caches are removed on activation, so a new
 * deployment is never blocked by cached HTML.
 */

export interface ServiceWorkerHandles {
  updateReady: boolean;
  applyUpdate: () => Promise<void>;
  dispose: () => void;
}

export function registerServiceWorker(onUpdateReady: () => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};
  if (import.meta.env.DEV) return () => {};

  let disposed = false;

  const base = import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/" ? import.meta.env.BASE_URL : "/";

  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
    .then((registration) => {
      if (disposed) return;

      const checkWaiting = () => {
        if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady();
      };
      checkWaiting();

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            onUpdateReady();
          }
        });
      });

      // Periodic + visibility-based update checks so long-lived tabs pick up
      // new deployments instead of serving week-old HTML.
      const interval = window.setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      const onVisibility = () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    })
    .catch((err) => {
      console.warn("PokeGuru: service worker registration failed", err);
    });

  return () => {
    disposed = true;
  };
}

export async function applyServiceWorkerUpdate(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  await new Promise<void>((resolve) => {
    const onChange = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    waiting.postMessage({ type: "SKIP_WAITING" });
    // Safety net: never leave the UI hanging.
    window.setTimeout(() => resolve(), 2500);
  });
  window.location.reload();
}
