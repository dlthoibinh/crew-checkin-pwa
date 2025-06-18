/* very tiny service-worker simply caches static assets */
const CACHE = 'checkin-v1';

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll([
    './','index.html','dashboard.html','style.css',
    'app.js?v=20250617','dash.js?v=20250617','evn_logo.png',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'
  ])));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||!req.url.startsWith(self.location.origin))return;
  e.respondWith(caches.match(req).then(res=>res||fetch(req)));
});
