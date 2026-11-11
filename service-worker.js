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
  const url = event.request.url;

  // 🎯 1. ข้ามการทำ Cache สำหรับ API และ Google Drive ทันที (ให้ Browser วิ่งตรง)
  if (url.includes('api.openf1.org') || 
      url.includes('api.jolpi.ca') || 
      url.includes('script.google.com') ||
      url.includes('googleusercontent.com')) {
    return; // ปล่อยผ่าน ไม่ต้องใช้ event.respondWith
  }

  // 🎯 2. สำหรับรูปภาพ: โหลดจากแคชก่อน (ถ้าไม่มีโหลดจากเน็ตแล้วเซฟ)
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          // เช็คว่า Response สมบูรณ์และเป็นไฟล์จากโดเมนเดียวกันก่อนแคช
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        }).catch(() => {
          // กรณีโหลดรูปจากเน็ตไม่ได้และไม่มีในแคช ให้คืนค่า Response ปลอดภัยกลับไป
          return new Response('', { status: 404, statusText: 'Image Not Found' });
        });
      })
    );
  } else {
    // 🎯 3. สำหรับไฟล์อื่นๆ (HTML, JS, CSS): ดึงจากเน็ตก่อน ป้องกันติดแคชเก่า
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then(cacheRes => {
          // ถ้าหาในแคชเจอให้คืนค่าแคช ถ้าหาไม่เจอให้คืนค่า Response แจ้ง Error (แก้บัค TypeError)
          if (cacheRes) {
            return cacheRes;
          }
          return new Response('Network error and no cache available.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
  }
});
