/* ===== PWA + OneSignal + Push Notifications — v4.0 ===== */

let deferredPrompt = null;
let swRegistration = null;
const ONESIGNAL_ORIGIN = 'https://dynamic-cactus-a5fb04.netlify.app';
const PWA_DISMISSED_KEY = 'tariq_pwa_dismissed';

/* ===== كشف الجهاز ===== */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

/* ===== تسجيل Service Worker ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try { await reg.update(); } catch (error) {}
      }
    } catch (error) {}

    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'activated' && !window.__tariqReloaded) {
              window.__tariqReloaded = true;
              window.location.reload();
            }
          });
        });
        console.log('✅ Service Worker مسجل:', reg.scope);
      })
      .catch((err) => console.log('❌ Service Worker فشل:', err));
  });
}

/* ===== التقاط حدث التثبيت ===== */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

/* ===== فحص إذا تم إغلاقه سابقاً ===== */
function isPwaDismissed() {
  try {
    const dismissed = localStorage.getItem(PWA_DISMISSED_KEY);
    if (!dismissed) return false;
    const data = JSON.parse(dismissed);
    return data.dismissed === true;
  } catch {
    return false;
  }
}

function dismissPwaInstall() {
  try {
    localStorage.setItem(PWA_DISMISSED_KEY, JSON.stringify({
      dismissed: true,
      at: Date.now()
    }));
  } catch (e) {}
  hideInstallButton();
}

/* ===== إظهار زر التثبيت ===== */
function showInstallButton() {
  if (isPwaDismissed()) {
    hideInstallButton();
    return;
  }

  if (isStandalone()) return;

  let btn = document.getElementById('pwaInstallBtn');

  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.className = 'pwa-install-btn';
    btn.innerHTML = `
      <button class="pwa-install-close" type="button" onclick="event.stopPropagation(); dismissPwaInstall()" aria-label="إغلاق">✕</button>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>تثبيت التطبيق</span>
    `;
    btn.onclick = (e) => {
      if (e.target.closest('.pwa-install-close')) return;
      installPWA();
    };
    document.body.appendChild(btn);
  }

  setTimeout(() => btn.classList.add('show'), 100);
}

/* ===== إخفاء زر التثبيت ===== */
function hideInstallButton() {
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) {
    btn.classList.remove('show');
    setTimeout(() => {
      if (!btn.classList.contains('show')) btn.remove();
    }, 400);
  }
}

/* ===== تثبيت PWA ===== */
async function installPWA() {
  if (isIOSSafari() && !isStandalone()) {
    showIOSInstallPrompt(true);
    return;
  }

  if (!deferredPrompt) {
    if (typeof showToast === 'function') {
      showToast('التطبيق مثبت أو غير مدعوم');
    }
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    if (typeof showToast === 'function') showToast('✅ تم تثبيت التطبيق');
    dismissPwaInstall();
    if (typeof trackEvent === 'function') trackEvent('pwa_installed');
  } else {
    if (typeof showToast === 'function') showToast('تم إلغاء التثبيت');
  }

  deferredPrompt = null;
  hideInstallButton();
}

/* ===== التطبيق مثبّت ===== */
window.addEventListener('appinstalled', () => {
  hideInstallButton();
  dismissPwaInstall();
  if (typeof showToast === 'function') showToast('🎉 التطبيق مثبت على جهازك');
});

/* ===== حالة الاتصال ===== */
window.addEventListener('online', () => {
  document.body.classList.remove('offline');
});

window.addEventListener('offline', () => {
  document.body.classList.add('offline');
  if (typeof showToast === 'function') {
    const lang = localStorage.getItem('lang') || 'ar';
    showToast(lang === 'ar' ? '📴 وضع بدون إنترنت' : '📴 Offline mode');
  }
});

/* ===== فحص الحالة عند التحميل ===== */
document.addEventListener('DOMContentLoaded', () => {
  if (!navigator.onLine) document.body.classList.add('offline');
  if (isStandalone()) document.body.classList.add('standalone');

  if (!isPwaDismissed() && !isStandalone()) {
    setTimeout(() => {
      if (deferredPrompt) showInstallButton();
    }, 3000);
  }
});

/* ===== رسالة تثبيت iOS ===== */
function showIOSInstallPrompt(force = false) {
  if (!force && localStorage.getItem('ios_prompt_shown')) return;

  const old = document.getElementById('iosInstallPrompt');
  if (old) old.remove();

  const lang = localStorage.getItem('lang') || 'ar';

  const prompt = document.createElement('div');
  prompt.className = 'ios-install-prompt';
  prompt.id = 'iosInstallPrompt';
  prompt.innerHTML = `
    <button class="ios-close" onclick="this.parentElement.remove()">✕</button>
    <div class="ios-content">
      <div class="ios-icon">📱</div>
      <div class="ios-text">
        <strong>${lang === 'ar' ? 'ثبّت التطبيق أولاً' : 'Install App First'}</strong>
        <p>${lang === 'ar'
          ? 'على iPhone/iPad، اضغط على زر المشاركة 📤 ثم "إضافة إلى الشاشة الرئيسية" ➕'
          : 'On iPhone/iPad, tap Share 📤 then "Add to Home Screen" ➕'
        }</p>
      </div>
    </div>
  `;
  document.body.appendChild(prompt);

  setTimeout(() => prompt.classList.add('show'), 100);
  if (!force) localStorage.setItem('ios_prompt_shown', '1');
}

/* ============================================
   OneSignal - الاشتراك
   ============================================ */
async function subscribeOneSignal() {
  if (isIOSSafari() && !isStandalone()) {
    const lang = localStorage.getItem('lang') || 'ar';
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? '📱 ثبّت التطبيق أولاً' : '📱 Install the app first');
    }
    showIOSInstallPrompt(true);
    return;
  }

  if (!('Notification' in window)) {
    if (typeof showToast === 'function') {
      const lang = localStorage.getItem('lang') || 'ar';
      showToast(lang === 'ar' ? 'المتصفح لا يدعم الإشعارات' : "Browser doesn't support notifications");
    }
    return;
  }

  try {
    // ✅ استخدام النظام المركزي
    if (window.notificationSystem && window.notificationSystem.requestPermission) {
      const result = await window.notificationSystem.requestPermission();
      if (!result.ok) {
        if (typeof showToast === 'function') showToast(result.error || 'لم يتم تفعيل الإشعارات');
        return;
      }
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (typeof showToast === 'function') showToast('لم يتم تفعيل الإشعارات');
        return;
      }
    }

    localStorage.setItem('notifications_subscribed', 'true');
    // ✅ الدالة updateNotificationButtons موجودة في prayer.js فقط
    if (typeof updateNotificationButtons === 'function') updateNotificationButtons();

    if (window.location.origin === ONESIGNAL_ORIGIN) {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        try { await OneSignal.User.PushSubscription.optIn(); } catch (e) {}
      });
    }

    if (typeof showToast === 'function') {
      const lang = localStorage.getItem('lang') || 'ar';
      showToast(lang === 'ar' ? '✅ تم تفعيل الإشعارات' : '✅ Notifications enabled');
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      const lang = localStorage.getItem('lang') || 'ar';
      showToast(lang === 'ar' ? 'تعذر تفعيل الإشعارات' : 'Failed to enable notifications');
    }
  }
}

async function unsubscribeOneSignal() {
  try {
    localStorage.removeItem('notifications_subscribed');
    // ✅ الدالة updateNotificationButtons موجودة في prayer.js فقط
    if (typeof updateNotificationButtons === 'function') updateNotificationButtons();

    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        try { await OneSignal.User.PushSubscription.optOut(); } catch (e) {}
      });
    } catch (e) {}

    if (typeof showToast === 'function') {
      const lang = localStorage.getItem('lang') || 'ar';
      showToast(lang === 'ar' ? 'تم إلغاء الإشعارات' : 'Notifications disabled');
    }
  } catch (err) {
    if (typeof updateNotificationButtons === 'function') updateNotificationButtons();
  }
}

/* ============================================
   إشعارات محلية عند إغلاق التطبيق
   ============================================ */
async function sendLocalPush(data) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if (document.hidden || document.visibilityState !== 'visible') {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(data.title || '💬 رسالة جديدة', {
          body: data.body || '',
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
          badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
          tag: data.chatId ? `chat-${data.chatId}` : `notif-${Date.now()}`,
          requireInteraction: false,
          vibrate: [200, 100, 200],
          data: {
            chatId: data.chatId,
            type: data.type,
            url: '/dashboard.html#friends'
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Push] Failed to show notification:', err);
  }
}

/* ===== معالجة النقر على الإشعار ===== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
      const data = event.data.data;
      if (data && data.chatId) {
        if (typeof showFriends === 'function') {
          showFriends();
          setTimeout(() => {
            if (typeof openChat === 'function') openChat(data.chatId);
          }, 500);
        }
      } else if (data && data.type === 'friend_request') {
        if (typeof showFriends === 'function') {
          showFriends();
          setTimeout(() => {
            if (typeof switchFriendsTab === 'function') switchFriendsTab('requests');
          }, 500);
        }
      }
    }
  });
}

/* ===== تصدير عام ===== */
window.dismissPwaInstall = dismissPwaInstall;
window.installPWA = installPWA;
window.showInstallButton = showInstallButton;
window.hideInstallButton = hideInstallButton;
window.sendLocalPush = sendLocalPush;
window.subscribeOneSignal = subscribeOneSignal;
window.unsubscribeOneSignal = unsubscribeOneSignal;

// ⚠️ ملاحظة: updateNotificationButtons() معرّفة في js/prayer.js فقط