const ASSET_VERSION = "20260514-1";
const CACHE_NAME = `pcc-tender-${ASSET_VERSION}`;
const APP_SHELL = [
  "/pcc/",
  "/pcc/settings.html",
  "/pcc/styles.css",
  `/pcc/pcc-overrides.css?v=${ASSET_VERSION}`,
  "/pcc/app.js",
  "/pcc/settings.js",
  "/pcc/manifest.webmanifest",
  "/pcc/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || !url.pathname.startsWith("/pcc/")) return;
  if (request.method !== "GET" || url.pathname.startsWith("/pcc/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/pcc/"));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || cache.match(fallbackUrl);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fresh;
}
