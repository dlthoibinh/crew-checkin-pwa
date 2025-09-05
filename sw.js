// v1: tăng số này mỗi lần deploy để force update
const CACHE = "evn-duty-shell-v1";
const ASSETS = ["/","/index.html","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE && caches.delete(k)))));
  self.clients.claim();
});

// App là SPA + iframe, chỉ cache shell
self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r=> r || fetch(e.request).catch(()=>caches.match("/index.html")))
    );
  }
});
