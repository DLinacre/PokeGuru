/*
 * PokeGuru — early PWA install capture.
 *
 * Loaded as a plain (non-module, non-deferred) script in <head>, before the
 * React bundle, so it runs during HTML parsing. Chrome fires
 * `beforeinstallprompt` exactly once when the app becomes installable; if no
 * listener calls preventDefault() at that moment the event is lost forever
 * and the in-app "Install PokeGuru" invitation can never appear (the browser
 * then only offers its own install icon, or reports "no installable PWA").
 *
 * This script captures the event the moment it fires, stashes it on window,
 * and re-broadcasts it as `pokeguru:beforeinstallprompt` so the React
 * InstallPrompt component can pick it up whenever it mounts — including when
 * the event fired before React had even loaded.
 *
 * It is an external file (not inline) so the strict Content-Security-Policy
 * (`script-src 'self'`) allows it on every host.
 */
(function () {
  window.__pokeguruInstallPrompt = null;
  window.__pokeguruInstalled = false;

  window.addEventListener("beforeinstallprompt", function (event) {
    // Keep the event so prompt() can be called later from the UI.
    event.preventDefault();
    window.__pokeguruInstallPrompt = event;
    window.dispatchEvent(new Event("pokeguru:beforeinstallprompt"));
  });

  window.addEventListener("appinstalled", function () {
    window.__pokeguruInstalled = true;
    window.__pokeguruInstallPrompt = null;
    window.dispatchEvent(new Event("pokeguru:appinstalled"));
  });
})();
