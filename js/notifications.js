/* ============================================
   نظام الإشعارات — FCM (v6.0.0)
   ============================================
   ✅ Firebase Cloud Messaging مباشرة
   ✅ يعمل عندما التطبيق مغلق
   ✅ بدون OneSignal
   ============================================ */

const NOTIFICATION_CONFIG = {
  VAPID_KEY: 'ضع_مفتاح_VAPID_هنا',
  SERVICE_WORKER_PATH: '/firebase-messaging-sw.js',
  TOKENS_COLLECTION: 'fcmTokens',
  DEDUP_WINDOW: 5000
};

const notificationState = {
  initialized: false,
  permission: 'default',
  fcmToken: null,
  messaging: null,
  sentCache: new Map()
};

/* ===== تحويل VAPID Key ===== */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* ===== تهيئة FCM ===== */
async function initFCM() {
  try {
    if (!window.firebaseHelpers) {
      console.warn('[FCM] Firebase not loaded');
      return null;
    }

    const { auth } = await window.firebaseHelpers.whenFirebaseReady();
    if (!auth) return null;

    // تحميل Firebase Messaging SDK
    const { getMessaging, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');

    const app = getApp();
    const messaging = getMessaging(app);

    notificationState.messaging = messaging;

    // استقبال الرسائل عندما التطبيق مفتوح
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message:', payload);
      handleForegroundMessage(payload);
    });

    console.log('✅ FCM initialized');
    return messaging;
  } catch (err) {
    console.error('[FCM] Init failed:', err);
    return null;
  }
}

/* ===== معالجة الرسالة في الواجهة ===== */
function handleForegroundMessage(payload) {
  const title = payload.data?.title || payload.notification?.title || 'إشعار جديد';
  const body = payload.data?.body || payload.notification?.body || '';
  const icon = payload.data?.icon || '📢';
  const color = payload.data?.color || 'gold';
  const link = payload.data?.link || null;
  const chatId = payload.data?.chatId || null;

  if (typeof showInAppNotification === 'function') {
    showInAppNotification({
      title,
      body,
      icon,
      color,
      link,
      chatId
    });
  }

  // إشعار محلي أيضاً
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
        tag: chatId ? `chat_${chatId}` : `notif_${Date.now()}`
      });
    } catch (e) {}
  }
}

/* ===== طلب الإذن + الحصول على Token ===== */
async function rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63() {
  if (!('Notification' in window)) {
    return { ok: false, error: 'المتصفح لا يدعم الإشعارات' };
  }

  if (Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      notificationState.permission = permission;
      if (permission !== 'granted') {
        return { ok: false, error: 'لم يتم منح الإذن' };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (Notification.permission === 'denied') {
    return { ok: false, error: 'الإشعارات محظورة — فعّلها من إعدادات المتصفح' };
  }

  notificationState.permission = 'granted';

  // الحصول على FCM Token
  const token = await getFCMToken();
  if (!token) {
    return { ok: false, error: 'تعذر الحصول على FCM Token' };
  }

  // حفظ Token في Firestore
  await saveFCMToken(token);

  notificationState.initialized = true;

  if (typeof trackEvent === 'function') {
    trackEvent('notification_permission_granted');
  }

  return { ok: true, token };
}

/* ===== الحصول على FCM Token ===== */
async function getFCMToken() {
  try {
    if (!notificationState.messaging) {
      const messaging = await initFCM();
      if (!messaging) throw new Error('FCM not initialized');
    }

    const { getToken } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

    // تسجيل Service Worker
    await navigator.serviceWorker.register(NOTIFICATION_CONFIG.SERVICE_WORKER_PATH, {
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    const token = await getToken(notificationState.messaging, {
      vapidKey: NOTIFICATION_CONFIG.VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/')
    });

    if (token) {
      console.log('✅ FCM Token:', token.substring(0, 20) + '...');
      notificationState.fcmToken = token;
      return token;
    }

    console.warn('[FCM] No token returned');
    return null;
  } catch (err) {
    console.error('[FCM] getToken failed:', err);
    return null;
  }
}

/* ===== حفظ Token في Firestore ===== */
async function saveFCMToken(token) {
  try {
    const user = window.authApi?.getCurrentUser?.();
    if (!user || !user.uid) {
      console.log('[FCM] No user — skip save');
      return false;
    }

    if (!window.firebaseHelpers) return false;

    await window.firebaseHelpers.fbSetDoc(
      NOTIFICATION_CONFIG.TOKENS_COLLECTION,
      user.uid,
      {
        uid: user.uid,
        token: token,
        username: user.username || '',
        email: user.email || '',
        platform: 'web',
        updatedAt: new Date().toISOString()
      }
    );

    console.log('✅ FCM Token saved to Firestore');
    return true;
  } catch (err) {
    console.warn('[FCM] Save token failed:', err.code || err.message);
    return false;
  }
}

/* ===== إرسال إشعار لمستخدم آخر (عبر Firestore) ===== */
async function sendPushNotification(toUid, data = {}) {
  if (!toUid) return { ok: false, error: 'toUid missing' };

  // منع التكرار
  const dedupKey = `${toUid}_${data.type || 'general'}_${data.chatId || ''}_${data.title || ''}`;
  const now = Date.now();
  if (notificationState.sentCache.has(dedupKey)) {
    const lastSent = notificationState.sentCache.get(dedupKey);
    if (now - lastSent < NOTIFICATION_CONFIG.DEDUP_WINDOW) {
      return { ok: false, error: 'duplicate' };
    }
  }
  notificationState.sentCache.set(dedupKey, now);

  try {
    // حفظ الإشعار في Firestore — Cloud Function تقرأه وترسله
    const notificationId = 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    await window.firebaseHelpers.fbSetDoc('pushQueue', notificationId, {
      id: notificationId,
      toUid,
      type: data.type || 'general',
      title: data.title || '',
      body: data.body || '',
      link: data.link || '',
      chatId: data.chatId || null,
      fromUid: data.fromUid || null,
      fromName: data.fromName || null,
      sent: false,
      createdAt: new Date().toISOString()
    });

    console.log('✅ Push queued:', notificationId);
    return { ok: true, id: notificationId };
  } catch (err) {
    console.warn('[FCM] Push queue error:', err.message);
    return { ok: false, error: err.message };
  }
}

/* ===== حالة النظام ===== */
function getNotificationStatus() {
  return {
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    initialized: notificationState.initialized,
    hasToken: !!notificationState.fcmToken,
    supported: 'Notification' in window,
    swSupported: 'serviceWorker' in navigator,
    fcmSupported: 'FirebaseMessaging' in window || true
  };
}

/* ===== اختبار ===== */
async function testNotification() {
  const status = getNotificationStatus();
  if (status.permission !== 'granted') {
    const result = await rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63();
    if (!result || !result.ok) {
      if (typeof showToast === 'function') showToast('❌ ' + (result?.error || 'فشل'));
      return { ok: false, error: result?.error };
    }
  }

  if (typeof showToast === 'function') showToast('✅ تم تفعيل الإشعارات بنجاح');
  return { ok: true };
}

/* ===== التصدير ===== */
window.notificationSystem = {
  init: initFCM,
  requestPermission: rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63,
  sendPush: sendPushNotification,
  getStatus: getNotificationStatus,
  test: testNotification,
  getToken: getFCMToken,
  config: NOTIFICATION_CONFIG
};

window.testNotification = testNotification;
window.getNotificationStatus = getNotificationStatus;
window.sendPushNotification = sendPushNotification;
window.rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63 = rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63;

/* ===== بدء تلقائي ===== */
document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    await initFCM();
  }, 2000);
});