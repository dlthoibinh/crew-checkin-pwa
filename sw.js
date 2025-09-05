/* sw.js – cache cơ bản + network-first cho API Apps Script */
const CACHE = 'evn-duty-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './evn_logo.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// API Apps Script -> network-first; còn lại -> stale-while-revalidate
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
    caches.match(e.request).then(cached => {
      const netFetch = fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      }).catch(() => cached || caches.match('./'));
      return cached || netFetch;
    })
  );
});
