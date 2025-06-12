// sw.js
const CACHE_NAME = 'crew-checkin-cache-v1';
const ASSETS = [
  '/',               // index.html
  '/index.html',
  '/app.js',
  '/sw.js',
  '/manifest.json',
  '/evn_logo.png'
];

// Khi cài đặt SW, cache trước các asset cần thiết
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Khi fetch, ưu tiên trả từ cache, nếu không có sẽ fetch mạng rồi cache tiếp
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Tuỳ chọn: cache các file mới
          if (event.request.method === 'GET') {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        });
      })
  );
});

// Khi activate (thường sau cập nhật), xoá cache cũ
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
});
