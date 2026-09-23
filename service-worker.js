/* ===== Service Worker - طريق الهدى + Firebase Cloud Messaging ===== */

const CACHE_NAME = 'tariq-alhuda-v4.0.0';
const RUNTIME_CACHE = 'tariq-alhuda-runtime-v4.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './manifest.json',
  './firebase-messaging-sw.js',
  // CSS
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
  // JS Core
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
  // Data
  './locales/ar.json',
  './locales/en.json',
  './data/ziyarat.json',
  './data/istikhara.json'
];

/* ===== تثبيت ===== */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v4.0.0...');
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
  console.log('[SW] Activating v4.0.0...');
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

  /* تجاهل الإضافات */
  if (url.protocol === 'chrome-extension:') return;

  /* firebase-messaging-sw.js — لا نعترضه */
  if (url.pathname === '/firebase-messaging-sw.js') {
    return;
  }

  /* تجاهل طلبات POST */
  if (request.method !== 'GET') {
    return;
  }

  /* Firebase — network-first */
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(networkFirst(request));
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

  /* صوتيات — تجاهل كامل */
  if (request.destination === 'audio' ||
      url.pathname.endsWith('.mp3') ||
      url.pathname.endsWith('.wav') ||
      url.pathname.endsWith('.ogg')) {
    return;
  }

  /* فيديو — تجاهل */
  if (request.destination === 'video') {
    return;
  }

  /* الباقي — cache-first */
  event.respondWith(cacheFirst(request));
});

/* ============================================
   Cache First — آمن
   ============================================ */
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
  } catch (e) {
    console.warn('[SW] Cache match error:', e);
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      } catch (e) {
        console.warn('[SW] Cache put error:', e);
      }
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
   Network First — آمن
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

/* ============================================
   Notification Click Handler
   يعمل مع FCM Service Worker
   ============================================ */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);

  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || data.link || '/dashboard.html#friends';

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

/* ============================================
   Web Push Handler (احتياطي)
   ملاحظة: FCM الرئيسي يعمل عبر firebase-messaging-sw.js
   ============================================ */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received!');

  let data = {
    title: 'إشعار جديد',
    body: '',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
    data: {}
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);

      if (payload.notification) {
        data.title = payload.notification.title || data.title;
        data.body = payload.notification.body || data.body;
      }

      if (payload.data) {
        data.data = payload.data;
        if (payload.data.title) data.title = payload.data.title;
        if (payload.data.body) data.body = payload.data.body;
      }
    }
  } catch (e) {
    console.warn('[SW] Push parse error:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.icon,
    vibrate: [200, 100, 200, 100, 200],
    tag: data.data.chatId ? `chat_${data.data.chatId}` : `notif_${Date.now()}`,
    requireInteraction: false,
    data: data.data
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});