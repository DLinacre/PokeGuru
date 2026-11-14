/*
 * PokeGuru service worker.
 *
 * Strategy
 *  - App shell: network-first so a new deployment is picked up immediately;
 *    cached shell + offline page are fallbacks when the network fails.
 *  - Hashed build assets: cache-first (immutable).
 *  - Third-party API/data: stale-while-revalidate, bounded cache.
 *  - Card artwork (assets.tcgdex.net): never intercepted. The browser talks
 *    to the CDN directly, so a cached or failed entry can never hand an <img>
 *    a non-image response (which renders as a broken card).
 *  - Every cache is versioned; old versions are deleted on activation.
 *
 * A waiting worker never takes over a live page on its own — the UI offers
 * an explicit "Refresh" action (postMessage SKIP_WAITING).
 */

const BASE = "/PokeGuru/";
const VERSION = "1794688369209";
const SHELL_CACHE = `pokeguru-shell-${VERSION}`;
const ASSET_CACHE = `pokeguru-assets-${VERSION}`;
const DATA_CACHE = `pokeguru-data-${VERSION}`;

const PRECACHE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}offline.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}favicon.svg`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

const DATA_HOSTS = new Set(["api.tcgdex.net", "api.frankfurter.dev", "cdn.jsdelivr.net", "tessdata.projectnaptha.com"]);

/** Hosts serving card artwork and other binary media — always straight to network. */
const MEDIA_HOSTS = new Set(["assets.tcgdex.net", "images.tcgdex.net"]);

/** Requests that must never receive a cached non-image body. */
function isMediaRequest(request, url) {
  if (MEDIA_HOSTS.has(url.hostname)) return true;
  return request.destination === "image" || request.destination === "font" || request.destination === "audio" || request.destination === "video";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: "reload" }));
            if (response.ok) await cache.put(url, response);
          } catch {
            /* a missing optional asset must not fail the install */
          }
        })
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("pokeguru-") && !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(`${BASE}index.html`, response.clone());
    }
    return response;
  } catch {
    const cachedShell = (await cache.match(`${BASE}index.html`)) || (await cache.match(BASE));
    if (cachedShell) return cachedShell;
    const offline = await cache.match(`${BASE}offline.html`);
    if (offline) return offline;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><p>You are offline and this page is not cached yet.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      // Only complete, cacheable responses are stored: opaque and error
      // responses used to end up in the cache and were later replayed to
      // callers (including <img>) as if they were content.
      if (response.ok && response.type === "basic") {
        try {
          await cache.put(request, response.clone());
          await trimCache(DATA_CACHE, 150);
        } catch {
          /* quota pressure must never break the response */
        }
      }
      return response;
    })
    .catch(() => null);
  if (cached) {
    // Refresh in the background; never block on the network.
    network.catch(() => {});
    return cached;
  }
  const response = await network;
  if (response) return response;
  return new Response(JSON.stringify({ error: "offline" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Artwork and other media bypass the worker entirely.
  if (isMediaRequest(request, url)) return;

  if (url.origin === self.location.origin) {
    // Never cache the service worker itself.
    if (url.pathname.endsWith("/sw.js") || url.pathname.startsWith(`${BASE}api/`)) return;
    const isHashedAsset = url.pathname.includes("/assets/");
    if (isHashedAsset) {
      event.respondWith(cacheFirst(request).catch(() => fetch(request)));
      return;
    }
    // Same-origin static files (icons, manifest, OCR fallback) use SWR.
    event.respondWith(
      staleWhileRevalidate(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || fetch(request);
      })
    );
    return;
  }

  if (DATA_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
