/* sw.js */
const CACHE = 'evn-duty-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './evn_logo.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// API (Apps Script) -> network-first; tài nguyên khác -> stale-while-revalidate
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isAPI = url.hostname.endsWith('script.google.com');

  if (isAPI) {
    e.respondWith(
      fetch(e.request).then(r => r).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((net) => {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return net;
      }).catch(() => cached || caches.match('./'));
      return cached || fetchPromise;
    })
  );
});
