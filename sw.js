// Xác định BASE động từ URL của chính SW (an toàn cho sub-path)
const BASE = new URL('./', self.location).pathname; // vd: "/crew-checkin-pwa/"
const CACHE = 'crew-pwa-v6';

// Precache các asset tĩnh trong scope
const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  BASE + 'evn_logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : 0)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Chỉ xử lý cùng origin & trong scope BASE
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Điều hướng: network-first, fallback index.html (offline)
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(BASE + 'index.html')) || Response.error();
      }
    })());
    return;
  }

  // Tài nguyên tĩnh: cache-first, update từ network khi cần
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreVary: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && req.method === 'GET') cache.put(req, res.clone());
    return res;
  })());
});
