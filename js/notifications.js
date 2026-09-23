/* ============================================
   نظام الإشعارات — v5.0.0
   ============================================ */

const NOTIFICATION_CONFIG = {
  VAPID_KEY: 'BHnvPlMNZmAqtSLlLdbARaJK6kea3wVXSfRCH45Bxui4jzoE1poj0_G7Zcma4OLYijPgTJ48DcEvx5Li1Hfk554',
  PROJECT_ID: 'tariq-al-huda',
  SENDER_ID: '605516521745',
  TOKENS_COLLECTION: 'fcmTokens',
  ONESIGNAL_APP_ID: 'a666e4cb-b2ed-49aa-8dd9-46f0cf962e3a',
  PUSH_ENDPOINT: '/api/send-push',
  ORIGIN: 'https://dynamic-cactus-a5fb04.netlify.app',
  DEDUP_WINDOW: 5000
};

const notificationState = {
  initialized: false,
  permission: 'default',
  fcmToken: null,
  sentCache: new Map()
};

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

async function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('[Notif] SW not supported');
      return null;
    }
    const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    console.log('✅ SW registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[Notif] SW registration failed:', err);
    return null;
  }
}

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
    return { ok: false, error: 'الإشعارات محظورة' };
  }

  notificationState.permission = 'granted';

  const subscription = await createPushSubscription();
  if (!subscription) {
    return { ok: false, error: 'تعذر إنشاء اشتراك Push' };
  }

  await saveSubscription(subscription);
  notificationState.initialized = true;

  if (typeof trackEvent === 'function') {
    trackEvent('notification_permission_granted');
  }

  return { ok: true, subscription };
}

async function createPushSubscription() {
  try {
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await registerServiceWorker();
    }
    if (!registration) throw new Error('SW not registered');

    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('✅ Existing subscription found');
      notificationState.fcmToken = JSON.stringify(subscription);
      return subscription;
    }

    console.log('📤 Creating new push subscription...');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(NOTIFICATION_CONFIG.VAPID_KEY)
    });

    console.log('✅ Push subscription created');
    notificationState.fcmToken = JSON.stringify(subscription);
    return subscription;
  } catch (err) {
    console.error('[Notif] Create subscription failed:', err);
    return null;
  }
}

async function saveSubscription(subscription) {
  try {
    const user = window.authApi?.getCurrentUser?.();
    if (!user || !user.uid) {
      console.log('[Notif] No user — skip save');
      return false;
    }

    if (!window.firebaseHelpers) {
      console.warn('[Notif] Firebase not ready');
      return false;
    }

    const subJson = subscription.toJSON();

    await window.firebaseHelpers.fbSetDoc(
      NOTIFICATION_CONFIG.TOKENS_COLLECTION,
      user.uid,
      {
        uid: user.uid,
        subscription: subJson,
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        username: user.username || '',
        email: user.email || '',
        updatedAt: new Date().toISOString()
      }
    );

    console.log('✅ Subscription saved to Firestore');
    return true;
  } catch (err) {
    if (err.code !== 'permission-denied') {
      console.warn('[Notif] Save subscription skipped:', err.code || err.message);
    }
    return false;
  }
}

async function sendPushNotification(toUid, data = {}) {
  if (!toUid) return { ok: false, error: 'toUid missing' };

  const dedupKey = `${toUid}_${data.type || 'general'}_${data.chatId || ''}_${data.title || ''}`;
  const now = Date.now();
  if (notificationState.sentCache.has(dedupKey)) {
    const lastSent = notificationState.sentCache.get(dedupKey);
    if (now - lastSent < NOTIFICATION_CONFIG.DEDUP_WINDOW) {
      return { ok: false, error: 'duplicate' };
    }
  }
  notificationState.sentCache.set(dedupKey, now);

  if (notificationState.sentCache.size > 100) {
    const cutoff = now - 60000;
    for (const [key, time] of notificationState.sentCache.entries()) {
      if (time < cutoff) notificationState.sentCache.delete(key);
    }
  }

  try {
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
      createdAt: new Date().toISOString(),
      sent: false
    }).catch(() => {});
  } catch (e) {}

  try {
    const response = await fetch(NOTIFICATION_CONFIG.PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toUid,
        title: data.title || 'إشعار جديد',
        body: data.body || '',
        type: data.type || 'general',
        chatId: data.chatId || null,
        link: data.link || null,
        fromName: data.fromName || null
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[Notif] Backend push failed:', response.status, errorText);
      return { ok: false, error: 'backend-failed' };
    }

    const result = await response.json();
    console.log('✅ Push sent via backend:', result);
    return { ok: true, id: result.id };
  } catch (err) {
    console.warn('[Notif] Push error:', err.message);
    return { ok: false, error: err.message };
  }
}

function showLocalNotification(data = {}) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const now = Date.now();
  const dedupKey = `local_${data.chatId || ''}_${data.title || ''}_${data.body || ''}`;
  if (notificationState.sentCache.has(dedupKey)) {
    const lastSent = notificationState.sentCache.get(dedupKey);
    if (now - lastSent < NOTIFICATION_CONFIG.DEDUP_WINDOW) return;
  }
  notificationState.sentCache.set(dedupKey, now);

  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(data.title || 'إشعار جديد', {
          body: data.body || '',
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
          badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
          tag: data.chatId ? `chat_${data.chatId}` : `notif_${now}`,
          vibrate: [200, 100, 200],
          data: { chatId: data.chatId, type: data.type, link: data.link }
        });
      });
    }
  } catch (e) {}
}

function getNotificationStatus() {
  return {
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    initialized: notificationState.initialized,
    hasSubscription: !!notificationState.fcmToken,
    supported: 'Notification' in window,
    swSupported: 'serviceWorker' in navigator,
    pushSupported: 'PushManager' in window,
    currentOrigin: window.location.origin
  };
}

async function testNotification() {
  const status = getNotificationStatus();
  if (status.permission !== 'granted') {
    const result = await rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63();
    if (!result || !result.ok) {
      if (typeof showToast === 'function') showToast('❌ ' + (result?.error || 'فشل'));
      return { ok: false, error: result?.error };
    }
    await new Promise(r => setTimeout(r, 500));
  }

  showLocalNotification({
    title: '🔔 إشعار اختباري',
    body: 'إذا وصل، النظام يعمل',
    type: 'test'
  });

  if (typeof showToast === 'function') showToast('✅ تم إرسال الإشعار');
  return { ok: true };
}

async function diagnoseDomainIssue() {
  const status = getNotificationStatus();
  console.log('\n🔍 تشخيص نظام الإشعارات:\n');
  console.log('📍 الدومين:', status.currentOrigin);
  console.log('📍 الإذن:', status.permission);
  console.log('📍 Service Worker:', status.swSupported ? '✅' : '❌');
  console.log('📍 Push Manager:', status.pushSupported ? '✅' : '❌');
  console.log('📍 Subscription:', status.hasSubscription ? '✅' : '❌');

  if (status.permission === 'granted' && !status.hasSubscription) {
    console.log('\n📤 محاولة إنشاء subscription...');
    const sub = await createPushSubscription();
    if (sub) {
      console.log('✅ Subscription created!');
      await saveSubscription(sub);
    } else {
      console.log('❌ Failed to create subscription');
    }
  }

  return getNotificationStatus();
}

async function initNotifications() {
  console.log('[Notif] Initializing v5.0...');
  if (typeof Notification === 'undefined') return false;

  notificationState.permission = Notification.permission;

  if (Notification.permission === 'granted') {
    notificationState.initialized = true;
    notificationState.permission = 'granted';

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          notificationState.fcmToken = JSON.stringify(sub);
          console.log('✅ Existing subscription restored');
        }
      }
    } catch (e) {}
  }

  console.log('✅ Notifications ready');
  return true;
}

window.notificationSystem = {
  init: initNotifications,
  requestPermission: rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63,
  sendPush: sendPushNotification,
  showLocal: showLocalNotification,
  getStatus: getNotificationStatus,
  test: testNotification,
  diagnose: diagnoseDomainIssue,
  createSubscription: createPushSubscription,
  saveSubscription,
  config: NOTIFICATION_CONFIG
};

window.testNotification = testNotification;
window.diagnoseNotifications = diagnoseDomainIssue;
window.getNotificationStatus = getNotificationStatus;
window.sendPushNotification = sendPushNotification;
window.rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63 = rpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63;

document.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    await initNotifications();
  }, 1500);
});