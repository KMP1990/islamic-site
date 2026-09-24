/* ===== Service Worker - طريق الهدى (v5.0.0 - ntfy.sh) ===== */

const CACHE_NAME = 'tariq-alhuda-v5.0.0';
const RUNTIME_CACHE = 'tariq-alhuda-runtime-v5.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './manifest.json',
  './css/global.css',
  './css/landing.css',
  './css/quran.css',
  './css/listen.css',
  './css/stats.css',
  './css/prayer.css',
  './css/ziyarat.css',
  './css/qibla.css',
  './css/names.css',
  './css/home.css',
  './css/istikhara.css',
  './css/management.css',
  './css/features.css',
  './css/settings.css',
  './css/friends.css',
  './css/pwa.css',
  './js/health.js',
  './js/firebase-config.js',
  './js/firebase.js',
  './js/theme.js',
  './js/lang.js',
  './js/settings.js',
  './js/stats.js',
  './js/sync.js',
  './js/features.js',
  './js/home.js',
  './js/security.js',
  './js/developer.js',
  './js/qibla.js',
  './js/names.js',
  './js/auth.js',
  './js/quran.js',
  './js/listen.js',
  './js/share.js',
  './js/prayer.js',
  './js/ziyarat.js',
  './js/istikhara.js',
  './js/notifications.js',
  './js/friends.js',
  './js/pwa.js',
  './js/landing.js',
  './js/indexeddb.js',
  './js/analytics.js',
  './locales/ar.json',
  './locales/en.json',
  './data/ziyarat.json',
  './data/istikhara.json'
];

/* ===== تثبيت ===== */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v5.0.0...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS).catch((err) => {
          console.log('[SW] Some assets failed:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* ===== تنشيط ===== */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v5.0.0...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ============================================
   اعتراض الطلبات
   ============================================ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.protocol === 'chrome-extension:') return;

  if (request.method !== 'GET') return;

  /* Firebase — network-first */
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* ntfy.sh — تجاهل كامل (SSE + POST) */
  if (url.hostname === 'ntfy.sh') {
    return;
  }

  /* صفحات HTML — network-first */
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* APIs خارجية — network-first */
  if (url.hostname.includes('api.alquran.cloud') ||
      url.hostname.includes('api.aladhan.com') ||
      url.hostname.includes('mp3quran.net') ||
      url.hostname.includes('islamcan.com') ||
      url.hostname.includes('catbox.moe') ||
      url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* خطوط Google — cache-first */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* صوتيات — تجاهل */
  if (request.destination === 'audio' ||
      url.pathname.endsWith('.mp3') ||
      url.pathname.endsWith('.wav') ||
      url.pathname.endsWith('.ogg')) {
    return;
  }

  if (request.destination === 'video') return;

  /* الباقي — cache-first */
  event.respondWith(cacheFirst(request));
});

/* ============================================
   Cache First
   ============================================ */
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
  } catch (e) {}

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      } catch (e) {}
    }
    return response;
  } catch (err) {
    try {
      if (request.mode === 'navigate') {
        const cached = await caches.match('./index.html');
        if (cached) return cached;
      }
    } catch (e) {}
    throw err;
  }
}

/* ============================================
   Network First
   ============================================ */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && request.method === 'GET') {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone()).catch(() => {});
      } catch (e) {}
    }
    return response;
  } catch (err) {
    try {
      const cached = await caches.match(request);
      if (cached) return cached;
    } catch (e) {}
    throw err;
  }
}

/* ===== رسائل ===== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ===== Notification Click ===== */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || data.link || '/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('dashboard.html') && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: {
                chatId: data.chatId,
                type: data.type,
                link: data.link
              }
            });
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});