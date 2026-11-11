const CACHE_NAME = 'f1-pwa-v4';

self.addEventListener('install', event => { 
  self.skipWaiting(); 
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { 
        if (key !== CACHE_NAME) return caches.delete(key); 
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // สำหรับรูปภาพ: โหลดจากแคชก่อนเพื่อความรวดเร็ว (ถ้ายังไม่มีค่อยโหลดจากเน็ตแล้วเซฟลงแคช)
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  } else {
    // สำหรับไฟล์อื่นๆ (HTML, JS, CSS, API): ดึงจากเน็ตก่อนเสมอ ป้องกันติดแคชเก่า
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
