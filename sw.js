/* Minimal SW cho GitHub Pages – network-first cho điều hướng, cache-first cho static */
const CACHE = 'crew-pwa-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './evn_logo.png'
];

// Cài đặt
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// Kích hoạt
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve()))))
  );
  self.clients.claim();
});

// Chiến lược fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Chỉ kiểm soát các request cùng origin (iframe Apps Script là cross-origin, SW không can thiệp)
  if (new URL(req.url).origin !== location.origin) return;

  // Điều hướng (HTML): network-first với fallback cache
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./')) || (await cache.match('/'));
      }
    })());
    return;
  }

  // Static: cache-first
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && req.method === 'GET') cache.put(req, res.clone());
      return res;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
