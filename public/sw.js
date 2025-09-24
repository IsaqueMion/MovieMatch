/* MovieMatch Service Worker (cache app-shell + assets) */
const CACHE_NAME = "mm-v1";

/** URLs essenciais do app-shell */
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/og-image-v2.png",
  "/offline.html"
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
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

/** Estratégias:
 * - HTML (mesmo domínio): Network-first com fallback ao cache e depois à home "/"
 * - Assets estáticos (mesmo domínio): Cache-first com atualização em background
 * - Imagens externas (TMDB/ytimg): Cache-first simples
 * - Demais requests: network direto
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const accept = req.headers.get("accept") || "";

  // HTML do app (rotas SPA)
  if (isSameOrigin && accept.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/offline.html")) || (await caches.match("/")))
    );
    return;
  }

  // Assets estáticos do app (scripts, styles, images, fonts)
  if (isSameOrigin && ["script", "style", "image", "font"].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchAndCache = () =>
          fetch(req)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
              return res;
            })
            .catch(() => cached);
        return cached || fetchAndCache();
      })
    );
    return;
  }

  // Imagens de terceiros (TMDB / YouTube thumbnails)
  if (/image\.tmdb\.org$/.test(url.host) || /^i\.ytimg\.com$/.test(url.host)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Demais: rede direta
});
