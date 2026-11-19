// ====================================================================
// 🏎️ F1 PREDICTOR 2026 - SERVICE WORKER (PWA ENGINE v5)
// ====================================================================

const APP_CACHE_NAME = 'f1-app-shell-v5';
const IMG_CACHE_NAME = 'f1-media-cache-v5';
const CDN_CACHE_NAME = 'f1-cdn-assets-v5';
const ACTIVE_CACHES = [APP_CACHE_NAME, IMG_CACHE_NAME, CDN_CACHE_NAME];
const MAX_IMAGE_CACHE_ITEMS = 120;

// ไฟล์โครงสร้างหลักของแอปที่ต้องการให้พร้อมใช้งานแม้เน็ตหลุด
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './data-config.js',
  './api-service.js',
  './app-ui.js',
  './manifest.json'
];

// โดเมน API ข้อมูลสดที่ห้ามแคชเด็ดขาด (ต้องดึงข้อมูลจริงเสมอ)
const BYPASS_DOMAINS = [
  'api.openf1.org',
  'api.jolpi.ca',
  'script.google.com',
  'script.googleusercontent.com',
  'api.rss2json.com',
  'onesignal.com'
];

// โดเมน CDN สำหรับฟอนต์ ไอคอน และไลบรารีคงที่
const STATIC_CDN_DOMAINS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ฟังก์ชันควบคุมจำนวนรูปในแคชไม่ให้กินพื้นที่เครื่องเกินลิมิต
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) {
    // ข้ามกรณีแคชถูกล็อกชั่วคราว
  }
}

// 1. INSTALL: เตรียมแคชไฟล์หลักของแอปและบังคับใช้เวอร์ชันใหม่ทันที
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then(cache => {
        // ใช้ Promise.allSettled ป้องกันกรณีไฟล์บางตัวโหลดไม่ทันแล้วทำให้ SW พังทั้งระบบ
        return Promise.allSettled(
          APP_SHELL_FILES.map(fileUrl => cache.add(fileUrl))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE: ล้างแคชเวอร์ชันเก่าทิ้งทั้งหมดอัตโนมัติ
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => {
          if (!ACTIVE_CACHES.includes(key)) {
            return caches.delete(key);
          }
        })
      ))
      .then(() => self.clients.claim())
  );
});

// 3. FETCH: จัดการกลยุทธ์การโหลดข้อมูลแยกตามประเภทไฟล์
self.addEventListener('fetch', event => {
  const req = event.request;

  // ข้ามคำสั่งที่ไม่ใช่ GET (เช่น POST ตอนส่งคำทายผล) และโปรโตคอลแปลกปลอม (เช่น chrome-extension)
  if (req.method !== 'GET' || !req.url.startsWith('http')) {
    return;
  }

  const urlObj = new URL(req.url);

  // 🎯 กฎที่ 1: ปล่อยผ่าน API สดทั้งหมด ไม่ยุ่งเกี่ยวกับระบบแคชของ SW
  if (BYPASS_DOMAINS.some(domain => urlObj.hostname.includes(domain))) {
    return;
  }

  // 🎯 กฎที่ 2: รูปภาพทั้งหมด (Google Drive, FlagCDN, โลโก้ทีม, รูปนักแข่ง)
  // ใช้กลยุทธ์ Cache-First + Background Refresh โหลดไวปานสายฟ้าและรองรับ CORS/Opaque
  const isImageRequest = req.destination === 'image' ||
    urlObj.hostname.includes('lh3.googleusercontent.com') ||
    urlObj.hostname.includes('flagcdn.com') ||
    urlObj.hostname.includes('postimg.cc') ||
    /\.(png|jpg|jpeg|webp|svg|gif)(\?.*)?$/i.test(urlObj.pathname);

  if (isImageRequest) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then(async cache => {
        const cachedRes = await cache.match(req);
        const networkFetch = fetch(req).then(fetchRes => {
          // รองรับทั้งรูปโดเมนเดียวกัน (basic), ข้ามโดเมน (cors) และแบบ opaque (status 0)
          if (fetchRes && (fetchRes.status === 200 || fetchRes.type === 'opaque')) {
            cache.put(req, fetchRes.clone()).then(() => trimCache(IMG_CACHE_NAME, MAX_IMAGE_CACHE_ITEMS));
          }
          return fetchRes;
        }).catch(() => null);

        // ถ้ามีในแคชให้ส่งออกแสดงผลทันที (พร้อมอัปเดตเบื้องหลัง) ถ้าไม่มีให้รอจากเน็ต
        if (cachedRes) return cachedRes;
        const freshRes = await networkFetch;
        return freshRes || new Response('', { status: 404, statusText: 'Image Offline' });
      })
    );
    return;
  }

  // 🎯 กฎที่ 3: ฟอนต์และไลบรารีจาก CDN (Bootstrap, FontAwesome, Chart.js, Google Fonts)
  // ใช้กลยุทธ์ Cache-First เพราะไฟล์พวกนี้เป็นเวอร์ชันคงที่ ไม่ค่อยเปลี่ยนแปลง
  if (STATIC_CDN_DOMAINS.some(domain => urlObj.hostname.includes(domain))) {
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(async cache => {
        const cachedRes = await cache.match(req);
        if (cachedRes) return cachedRes;

        try {
          const fetchRes = await fetch(req);
          if (fetchRes && (fetchRes.status === 200 || fetchRes.type === 'opaque')) {
            cache.put(req, fetchRes.clone());
          }
          return fetchRes;
        } catch (err) {
          return new Response('', { status: 503, statusText: 'CDN Offline' });
        }
      })
    );
    return;
  }

  // 🎯 กฎที่ 4: ไฟล์ระบบของคุณเอง (index.html, style.css, *.js, manifest.json)
  // ใช้กลยุทธ์ Network-First: ดึงโค้ดใหม่จาก GitHub Pages เสมอเมื่อมีเน็ต (ไม่ติดแคชเก่า) 
  // และอัปเดตลงแคชไว้เผื่อตอนผู้เล่นออฟไลน์
  event.respondWith(
    fetch(req)
      .then(networkRes => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resClone = networkRes.clone();
          caches.open(APP_CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(async () => {
        const cachedRes = await caches.match(req);
        if (cachedRes) return cachedRes;

        // กรณีผู้เล่นกดเข้าหน้าเว็บตอนออฟไลน์ ให้ส่งหน้าหลัก index.html กลับไปแทนหน้า Error
        if (req.mode === 'navigate') {
          const fallbackHtml = await caches.match('./index.html');
          if (fallbackHtml) return fallbackHtml;
        }

        return new Response('Offline - สัญญาณอินเทอร์เน็ตขาดหาย และไม่มีข้อมูลแคชในเครื่อง', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
