/* ============================================
   Firebase Cloud Messaging — Service Worker
   يعمل عندما التطبيق مغلق أو في الخلفية
   ============================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCb_1c_LBMdpg_naVo90pKu0cOxxOsZbYo",
  authDomain: "tariq-al-huda.firebaseapp.com",
  projectId: "tariq-al-huda",
  storageBucket: "tariq-al-huda.firebasestorage.app",
  messagingSenderId: "605516521745",
  appId: "1:605516521745:web:4cc594d1d3eccd93312cb0"
});

const messaging = firebase.messaging();

/* ===== استقبال الرسائل في الخلفية ===== */
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Background message:', payload);

  const notificationTitle = payload.data?.title || payload.notification?.title || 'إشعار جديد';
  const notificationBody = payload.data?.body || payload.notification?.body || '';
  const icon = payload.data?.icon || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E';

  const options = {
    body: notificationBody,
    icon: icon,
    badge: icon,
    vibrate: [200, 100, 200],
    tag: payload.data?.chatId ? `chat_${payload.data.chatId}` : `notif_${Date.now()}`,
    data: {
      chatId: payload.data?.chatId || null,
      type: payload.data?.type || 'general',
      link: payload.data?.link || '/dashboard.html',
      url: payload.data?.link || '/dashboard.html'
    }
  };

  return self.registration.showNotification(notificationTitle, options);
});

/* ===== عند النقر على الإشعار ===== */
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification clicked:', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  const urlToOpen = data.url || '/dashboard.html';

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

/* ===== دعم SKIP_WAITING ===== */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});