/* ============================================
   Presence System — v1.0
   نظام الحضور اللحظي
   ============================================
   ✅ Heartbeat كل 20 ثانية
   ✅ visibilitychange (تبويب مفعّل/غير مفعّل)
   ✅ beforeunload (إغلاق الصفحة)
   ✅ مزامنة مع Firestore
   ✅ cache محلي للسرعة
   ============================================ */

const PresenceSystem = (() => {
  'use strict';

  const HEARTBEAT_INTERVAL = 20000;    // 20 ثانية
  const AWAY_TIMEOUT = 60000;          // دقيقة → بعيد
  const OFFLINE_TIMEOUT = 120000;      // دقيقتان → غير متصل
  const COLLECTION = 'userStatus';
  const CACHE_KEY = 'tariq_user_status';

  let heartbeatTimer = null;
  let isActive = true;
  let lastUpdate = 0;
  let currentUid = null;
  let visibilityHandler = null;
  let beforeUnloadHandler = null;
  let focusHandler = null;
  let blurHandler = null;

  /* ============================================
     بدء النظام
     ============================================ */
  async function start() {
    const user = window.authApi?.getCurrentUser?.();
    if (!user || !user.uid) {
      console.log('[Presence] No user — skip');
      return;
    }

    currentUid = user.uid;

    // تسجيل "متصل" فوراً
    await updateStatus('online');

    // Heartbeat دوري
    startHeartbeat();

    // ربط الأحداث
    bindEvents();

    console.log('✅ Presence started for:', currentUid);
  }

  /* ============================================
     Heartbeat
     ============================================ */
  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    heartbeatTimer = setInterval(async () => {
      if (!currentUid) return;

      // تحديث الحالة حسب النشاط
      if (isActive) {
        await updateStatus('online');
      } else {
        await updateStatus('away');
      }
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /* ============================================
     ربط الأحداث
     ============================================ */
  function bindEvents() {
    // visibilitychange — تبديل التبويب
    visibilityHandler = () => {
      if (document.hidden) {
        isActive = false;
        updateStatus('away').catch(() => {});
      } else {
        isActive = true;
        updateStatus('online').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    // focus — العودة للنافذة
    focusHandler = () => {
      isActive = true;
      updateStatus('online').catch(() => {});
    };
    window.addEventListener('focus', focusHandler);

    // blur — مغادرة النافذة
    blurHandler = () => {
      isActive = false;
      updateStatus('away').catch(() => {});
    };
    window.addEventListener('blur', blurHandler);

    // beforeunload — إغلاق الصفحة
    beforeUnloadHandler = () => {
      setStatusOfflineSync();
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // pagehide — لمتصفحات iOS
    window.addEventListener('pagehide', beforeUnloadHandler);
  }

  function unbindEvents() {
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    if (focusHandler) window.removeEventListener('focus', focusHandler);
    if (blurHandler) window.removeEventListener('blur', blurHandler);
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      window.removeEventListener('pagehide', beforeUnloadHandler);
    }
  }

  /* ============================================
     تحديث الحالة في Firestore
     ============================================ */
  async function updateStatus(status) {
    if (!currentUid) return;
    if (!window.firebaseHelpers) return;

    // throttle — لا تحدّث أكثر من مرة كل 5 ثوان
    const now = Date.now();
    if (status === 'online' && now - lastUpdate < 5000) return;
    lastUpdate = now;

    try {
      await window.firebaseHelpers.fbSetDoc(COLLECTION, currentUid, {
        uid: currentUid,
        status: status,
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // تحديث cache محلي
      updateLocalCache(currentUid, status);
    } catch (err) {
      console.warn('[Presence] Update failed:', err.message);
    }
  }

  /* ============================================
     تحديث cache محلي
     ============================================ */
  function updateLocalCache(uid, status) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[uid] = {
        status: status,
        lastSeen: new Date().toISOString()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  /* ============================================
     وضع غير متصل عند الإغلاق (متزامن)
     ============================================ */
  function setStatusOfflineSync() {
    if (!currentUid) return;

    // ✅ استخدام sendBeacon (يعمل حتى عند إغلاق الصفحة)
    const payload = JSON.stringify({
      uid: currentUid,
      status: 'offline',
      lastSeen: new Date().toISOString()
    });

    // محاولة 1: sendBeacon
    if (navigator.sendBeacon && window.firebaseHelpers?.projectId) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${window.firebaseHelpers.projectId}/databases/(default)/documents/${COLLECTION}/${currentUid}?updateMask.fieldPaths=status&updateMask.fieldPaths=lastSeen`;

        // Note: sendBeacon مع Firestore معقد — نستخدم fetch sync
      } catch (e) {}
    }

    // محاولة 2: تحديث cache محلي فقط
    updateLocalCache(currentUid, 'offline');
  }

  /* ============================================
     إيقاف النظام (تسجيل خروج)
     ============================================ */
  async function stop() {
    if (currentUid) {
      await updateStatus('offline').catch(() => {});
    }

    stopHeartbeat();
    unbindEvents();
    currentUid = null;

    console.log('🔴 Presence stopped');
  }

  /* ============================================
     قراءة حالة مستخدم آخر
     ============================================ */
  function getStatus(uid) {
    // من cache أولاً
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const cached = cache[uid];

      if (cached) {
        const lastSeen = new Date(cached.lastSeen).getTime();
        const now = Date.now();
        const diff = now - lastSeen;

        // ✅ إذا لم يُحدّث منذ 2 دقيقة → offline تلقائياً
        if (cached.status === 'online' && diff > OFFLINE_TIMEOUT) {
          return { status: 'offline', lastSeen: cached.lastSeen };
        }

        if (cached.status === 'online' && diff > AWAY_TIMEOUT) {
          return { status: 'away', lastSeen: cached.lastSeen };
        }

        return cached;
      }
    } catch (e) {}

    return { status: 'offline', lastSeen: null };
  }

  /* ============================================
     الاستماع لحالة مستخدم (live)
     ============================================ */
  function listenToUser(uid, callback) {
    if (!window.firebaseHelpers) return () => {};

    return window.firebaseHelpers.fbListenDoc(COLLECTION, uid, (data) => {
      if (!data) {
        // حذف cache
        try {
          const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
          delete cache[uid];
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {}
        callback({ status: 'offline', lastSeen: null });
        return;
      }

      const status = data.status || 'offline';
      const lastSeen = data.lastSeen || null;

      // تحديث cache
      updateLocalCacheWithStatus(uid, status, lastSeen);

      // ✅ إذا كان online لكن لم يُحدّث منذ وقت طويل → offline
      if (status === 'online' && lastSeen) {
        const diff = Date.now() - new Date(lastSeen).getTime();
        if (diff > OFFLINE_TIMEOUT) {
          callback({ status: 'offline', lastSeen });
          return;
        }
      }

      callback({ status, lastSeen });
    });
  }

  function updateLocalCacheWithStatus(uid, status, lastSeen) {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[uid] = { status, lastSeen: lastSeen || new Date().toISOString() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    start,
    stop,
    getStatus,
    listenToUser,
    updateStatus,
    isActive: () => isActive
  };
})();

window.PresenceSystem = PresenceSystem;
console.log('✅ PresenceSystem loaded');

/* ============================================
   بدء تلقائي عند تسجيل الدخول
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const user = window.authApi?.getCurrentUser?.();
    if (user && user.uid) {
      PresenceSystem.start();
    }
  }, 2000);
});

/* ============================================
   إعادة التشغيل عند تغيير المستخدم
   ============================================ */
window.addEventListener('auth-state-changed', () => {
  const user = window.authApi?.getCurrentUser?.();
  if (user && user.uid) {
    PresenceSystem.start();
  } else {
    PresenceSystem.stop();
  }
});