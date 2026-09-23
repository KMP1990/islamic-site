/* ===== مواقيت الصلاة + الإشعارات (مع OneSignal) ===== */

const PRAYER_STORAGE_KEY = 'prayer_settings';
const ALADHAN_API = 'https://api.aladhan.com/v1';

/* ===== المؤذنين ===== */
const MUEZZINS = {
  makkah: {
    name: 'الحرم المكي',
    url: 'https://www.islamcan.com/audio/adhan/azan1.mp3'
  },
  madinah: {
    name: 'الحرم المدني',
    url: 'https://www.islamcan.com/audio/adhan/azan2.mp3'
  },
  karbala_hussain: {
    name: 'أذان كربلاء المقدسة',
    url: 'https://files.catbox.moe/cfsecz.mp3'
  },
  ali_mulla: {
    name: 'الشيخ علي ملا',
    url: 'https://www.islamcan.com/audio/adhan/azan8.mp3'
  },
  farooq: {
    name: 'الشيخ فاروق حضراوي',
    url: 'https://www.islamcan.com/audio/adhan/azan9.mp3'
  },
  egypt: {
    name: 'أذان مصري',
    url: 'https://www.islamcan.com/audio/adhan/azan10.mp3'
  },
  calm: {
    name: 'أذان هادئ',
    url: 'https://www.islamcan.com/audio/adhan/azan11.mp3'
  }
};

/* ===== الإعدادات ===== */
let prayerSettings = {
  city: 'كربلاء المقدسة',
  country: 'العراق',
  latitude: 32.6160,
  longitude: 44.0249,
  method: 4,
  muezzin: 'karbala_hussain',
  beforeAlert: 10,
  enabledPrayers: {
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true
  },
  notificationsEnabled: false,
  subscribedToTopic: false
};

let prayerTimes = {};
let nextPrayerInterval = null;
let notificationCheckInterval = null;
let alertSoundPlayed = {};

/* ===== تحميل ===== */
function loadPrayerSettings() {
  try {
    const saved = localStorage.getItem(PRAYER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      prayerSettings = { ...prayerSettings, ...parsed };
      if (!MUEZZINS[prayerSettings.muezzin]) {
        prayerSettings.muezzin = 'karbala_hussain';
      }
    }
  } catch (err) {
    console.error('خطأ في تحميل إعدادات الصلاة:', err);
  }
}

function savePrayerSettings() {
  try {
    localStorage.setItem(PRAYER_STORAGE_KEY, JSON.stringify(prayerSettings));
  } catch (err) {
    console.error('خطأ في حفظ إعدادات الصلاة:', err);
  }
}

/* ===== أسماء الصلوات ===== */
function getPrayerNameAr(key) {
  const names = {
    Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر',
    Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء'
  };
  return names[key] || key;
}

function getPrayerIcon(key) {
  const icons = {
    Fajr: '🌅', Sunrise: '🌄', Dhuhr: '☀️',
    Asr: '🌇', Maghrib: '🌆', Isha: '🌙'
  };
  return icons[key] || '🕐';
}

function toArabicNum(num) {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/* ===== جلب المواقيت ===== */
async function fetchPrayerTimes() {
  const list = document.getElementById('prayerList');

  try {
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    const url = `${ALADHAN_API}/timings/${dateStr}?latitude=${prayerSettings.latitude}&longitude=${prayerSettings.longitude}&method=${prayerSettings.method}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 200 && data.data && data.data.timings) {
      prayerTimes = data.data.timings;
      renderPrayerTimes();
      updateNextPrayer();
      scheduleNotifications();
    }
  } catch (err) {
    console.error('خطأ في جلب المواقيت:', err);
    if (list) list.innerHTML = '<div class="loading">تعذر تحميل المواقيت. تحقق من الإنترنت.</div>';
  }
}

/* ===== عرض المواقيت ===== */
function renderPrayerTimes() {
  const list = document.getElementById('prayerList');
  if (!list) return;

  const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  list.innerHTML = prayers.map((key, i) => {
    const time = prayerTimes[key] || '—';
    const cleanTime = time.split(' ')[0];
    const enabled = prayerSettings.enabledPrayers[key];
    const icon = getPrayerIcon(key);
    const name = getPrayerNameAr(key);

    return `
      <div class="prayer-item ${enabled ? '' : 'disabled'}" style="animation-delay: ${i * 0.05}s">
        <div class="prayer-item-icon">${icon}</div>
        <div class="prayer-item-info">
          <div class="prayer-item-name">${name}</div>
          <div class="prayer-item-time">${cleanTime}</div>
        </div>
        <label class="prayer-toggle">
          <input type="checkbox" ${enabled ? 'checked' : ''} onchange="togglePrayer('${key}', this.checked)">
          <span class="prayer-toggle-slider"></span>
        </label>
      </div>
    `;
  }).join('');

  const cityEl = document.getElementById('prayerCity');
  if (cityEl) cityEl.textContent = `${prayerSettings.city}، ${prayerSettings.country}`;

  const dateEl = document.getElementById('prayerDate');
  if (dateEl) {
    const today = new Date();
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    dateEl.textContent = `${days[today.getDay()]}، ${toArabicNum(today.getDate())} ${months[today.getMonth()]} ${toArabicNum(today.getFullYear())}`;
  }

  const muezzinSelect = document.getElementById('muezzinSelect');
  if (muezzinSelect) muezzinSelect.value = prayerSettings.muezzin;

  const beforeSelect = document.getElementById('beforeAlertSelect');
  if (beforeSelect) beforeSelect.value = prayerSettings.beforeAlert;
}

/* ===== تفعيل/تعطيل صلاة ===== */
function togglePrayer(prayerKey, enabled) {
  prayerSettings.enabledPrayers[prayerKey] = enabled;
  savePrayerSettings();

  const items = document.querySelectorAll('.prayer-item');
  const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const index = prayers.indexOf(prayerKey);

  if (items[index]) items[index].classList.toggle('disabled', !enabled);

  scheduleNotifications();
}

/* ===== الصلاة الجاية ===== */
function getNextPrayer() {
  if (!prayerTimes || Object.keys(prayerTimes).length === 0) return null;

  const now = new Date();
  const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const key of prayers) {
    const time = prayerTimes[key];
    if (!time) continue;

    const cleanTime = time.split(' ')[0];
    const [hours, minutes] = cleanTime.split(':').map(Number);

    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);

    if (prayerDate > now) {
      return { key, time: prayerDate, displayTime: cleanTime };
    }
  }

  const fajrTime = prayerTimes.Fajr;
  if (fajrTime) {
    const cleanTime = fajrTime.split(' ')[0];
    const [hours, minutes] = cleanTime.split(':').map(Number);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    return { key: 'Fajr', time: tomorrow, displayTime: cleanTime };
  }

  return null;
}

function updateNextPrayer() {
  const next = getNextPrayer();
  if (!next) return;

  const nameEl = document.getElementById('nextPrayerName');
  const timeEl = document.getElementById('nextPrayerTime');

  if (nameEl) nameEl.textContent = `${getPrayerIcon(next.key)} ${getPrayerNameAr(next.key)}`;
  if (timeEl) timeEl.textContent = next.displayTime;

  updateRemaining(next.time);

  if (nextPrayerInterval) clearInterval(nextPrayerInterval);

  nextPrayerInterval = setInterval(() => {
    const current = getNextPrayer();
    if (current) {
      updateRemaining(current.time);
      if (nameEl) nameEl.textContent = `${getPrayerIcon(current.key)} ${getPrayerNameAr(current.key)}`;
      if (timeEl) timeEl.textContent = current.displayTime;
    }
  }, 1000);
}

function updateRemaining(targetTime) {
  const remainEl = document.getElementById('nextPrayerRemaining');
  if (!remainEl) return;

  const now = new Date();
  const diff = targetTime - now;

  if (diff <= 0) {
    remainEl.textContent = 'الآن';
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const lang = localStorage.getItem('lang') || 'ar';
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  if (lang === 'ar') {
    remainEl.textContent = `متبقي ${toArabicNum(timeStr)}`;
  } else {
    remainEl.textContent = `Remaining ${timeStr}`;
  }
}

/* ===== جدولة الإشعارات ===== */
function scheduleNotifications() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);

  notificationCheckInterval = setInterval(() => {
    checkForPrayerAlerts();
  }, 20000);

  checkForPrayerAlerts();
}

function checkForPrayerAlerts() {
  if (!prayerSettings.notificationsEnabled) return;
  if (!prayerTimes || Object.keys(prayerTimes).length === 0) return;

  const now = new Date();
  const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const beforeMinutes = parseInt(prayerSettings.beforeAlert) || 0;

  prayers.forEach(key => {
    if (!prayerSettings.enabledPrayers[key]) return;

    const time = prayerTimes[key];
    if (!time) return;

    const cleanTime = time.split(' ')[0];
    const [hours, minutes] = cleanTime.split(':').map(Number);

    const prayerDate = new Date();
    prayerDate.setHours(hours, minutes, 0, 0);

    if (beforeMinutes > 0) {
      const beforeTime = new Date(prayerDate.getTime() - beforeMinutes * 60 * 1000);
      const diffBefore = Math.abs(now - beforeTime);
      const beforeKey = `${key}_before_${todayKey()}`;

      if (diffBefore < 30000 && !alertSoundPlayed[beforeKey]) {
        alertSoundPlayed[beforeKey] = true;
        showPrayerNotification(
          `⏰ اقترب وقت ${getPrayerNameAr(key)}`,
          `باقي ${toArabicNum(beforeMinutes)} دقيقة على أذان ${getPrayerNameAr(key)}`,
          false
        );
      }
    }

    const diffNow = Math.abs(now - prayerDate);
    const adhanKey = `${key}_adhan_${todayKey()}`;

    if (diffNow < 30000 && !alertSoundPlayed[adhanKey]) {
      alertSoundPlayed[adhanKey] = true;
      showPrayerNotification(
        `🕌 حان وقت ${getPrayerNameAr(key)}`,
        `الله أكبر — حان وقت صلاة ${getPrayerNameAr(key)}`,
        true
      );
      playAdhan();
    }
  });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* ============================================
   ✅ إشعار الصلاة — مع Push حقيقي
   ============================================ */
async function showPrayerNotification(title, body, withSound) {
  if (!prayerSettings.notificationsEnabled) return;

  /* ✅ 1. إشعار محلي (يظهر داخل المتصفح) */
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
          body: body,
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E🕌%3C/text%3E%3C/svg%3E',
          badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E🕌%3C/text%3E%3C/svg%3E',
          tag: 'prayer_' + Date.now(),
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          silent: !withSound,
          data: {
            type: 'prayer',
            url: '/dashboard.html#prayer'
          }
        });
      } else {
        const notification = new Notification(title, {
          body: body,
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E🕌%3C/text%3E%3C/svg%3E',
          tag: 'prayer_' + Date.now(),
          data: { type: 'prayer', url: '/dashboard.html#prayer' }
        });
        notification.onclick = function() {
          window.focus();
          notification.close();
        };
        setTimeout(() => notification.close(), 30000);
      }
    } catch (err) {
      console.error('[Prayer] Local notification error:', err);
    }
  }

  /* ✅ 2. إرسال Push حقيقي للمستخدم نفسه */
  const user = window.authApi?.getCurrentUser?.();
  if (user && window.notificationSystem && window.notificationSystem.sendPush) {
    try {
      await window.notificationSystem.sendPush(user.uid, {
        type: 'prayer',
        title: title,
        body: body,
        fromUid: user.uid,
        link: 'prayer'
      });
    } catch (err) {
      console.warn('[Prayer] Push failed:', err);
    }
  }
}

/* ===== تشغيل الأذان ===== */
function playAdhan() {
  const muezzin = MUEZZINS[prayerSettings.muezzin];
  if (!muezzin) return;

  try {
    const existing = document.getElementById('adhanAudio');
    if (existing) {
      existing.pause();
      existing.currentTime = 0;
      existing.remove();
    }

    const audio = document.createElement('audio');
    audio.id = 'adhanAudio';
    audio.src = muezzin.url;
    audio.volume = 1;
    audio.preload = 'auto';
    audio.style.display = 'none';
    document.body.appendChild(audio);

    audio.addEventListener('ended', () => {
      updateAdhanButtons(false);
    });

    audio.play().catch(err => {
      console.log('تعذر تشغيل الأذان تلقائياً:', err);
      updateAdhanButtons(false);
    });
  } catch (err) {
    console.error('خطأ في تشغيل الأذان:', err);
    updateAdhanButtons(false);
  }
}

/* ============================================
   ✅ طلب الإذن + الاشتراك في Push
   ============================================ */
async function requestNotifications() {
  if (!('Notification' in window)) {
    if (typeof showToast === 'function') showToast('هذا المتصفح لا يدعم الإشعارات');
    return false;
  }

  if (Notification.permission === 'denied') {
    if (typeof showToast === 'function') {
      showToast('الإشعارات محظورة. افتح إعدادات الموقع واسمح بها');
    }
    return false;
  }

  /* ✅ استخدم نظام الإشعارات المركزي */
  if (window.notificationSystem && window.notificationSystem.requestPermission) {
    const result = await window.notificationSystem.requestPermission();

    if (!result.ok) {
      if (typeof showToast === 'function') showToast(result.error || 'لم يتم تفعيل الإشعارات');
      updateNotificationButtons();
      return false;
    }
  } else {
    /* ✅ fallback */
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') {
      if (typeof showToast === 'function') showToast('لم يتم السماح بالإشعارات');
      updateNotificationButtons();
      return false;
    }
  }

  localStorage.setItem('notifications_subscribed', 'true');
  prayerSettings.notificationsEnabled = true;
  savePrayerSettings();

  /* ✅ اشترك في topic الصلاة */
  await subscribeToPrayerTopic();

  updateNotificationButtons();
  scheduleNotifications();

  if (typeof showToast === 'function') showToast('✅ تم تفعيل الإشعارات');
  return true;
}

/* ============================================
   ✅ الاشتراك في Topic الصلاة
   ============================================ */
async function subscribeToPrayerTopic() {
  try {
    if (window.location.origin !== 'https://dynamic-cactus-a5fb04.netlify.app') return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        /* ✅ اشترك في topic الصلاة */
        await OneSignal.User.addTag('subscribed_prayer', 'true');
        prayerSettings.subscribedToTopic = true;
        savePrayerSettings();
        console.log('✅ Subscribed to prayer topic');
      } catch (e) {
        console.warn('[Prayer] Subscribe topic failed:', e);
      }
    });
  } catch (err) {
    console.warn('[Prayer] subscribeToPrayerTopic error:', err);
  }
}

/* ===== إلغاء الإشعارات ===== */
async function cancelNotifications() {
  const lang = localStorage.getItem('lang') || 'ar';

  const confirmed = confirm(
    lang === 'ar' ? 'هل أنت متأكد من إلغاء الإشعارات؟' : 'Are you sure you want to cancel notifications?'
  );

  if (!confirmed) return;

  if (window.notificationSystem && window.notificationSystem.unlinkUser) {
    await window.notificationSystem.unlinkUser();
  }

  prayerSettings.notificationsEnabled = false;
  prayerSettings.subscribedToTopic = false;
  savePrayerSettings();
  localStorage.removeItem('notifications_subscribed');

  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = null;
  }

  updateNotificationButtons();

  if (typeof showToast === 'function') {
    showToast(lang === 'ar' ? 'تم إلغاء الإشعارات' : 'Notifications cancelled');
  }
}

/* ===== تحديث أزرار الإشعارات ===== */
function updateNotificationButtons() {
  const btn = document.getElementById('prayerNotifyBtn');
  const btnText = document.getElementById('prayerNotifyText');
  const cancelBtn = document.getElementById('prayerCancelBtn');
  const status = document.getElementById('prayerNotifyStatus');

  if (!('Notification' in window)) {
    if (btn) { btn.style.display = 'block'; btn.disabled = true; }
    if (btnText) btnText.textContent = 'المتصفح لا يدعم الإشعارات';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (status) status.style.display = 'none';
    return;
  }

  const subscribed = localStorage.getItem('notifications_subscribed') === 'true';
  const granted = Notification.permission === 'granted';

  if (subscribed && granted) {
    if (btn) btn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'block';
    if (status) status.style.display = 'block';
  } else {
    if (btn) { btn.style.display = 'block'; btn.disabled = false; }
    if (btnText) btnText.textContent = Notification.permission === 'denied'
      ? 'السماح محظور من إعدادات الموقع'
      : 'تفعيل الإشعارات';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (status) status.style.display = 'none';
  }
}

/* ===== فتح صلاحية الصوت ===== */
function unlockAudio() {
  try {
    const silent = new Audio();
    silent.volume = 0;
    silent.play().catch(() => {});
  } catch (e) {}
}

function checkNotificationsStatus() {
  updateNotificationButtons();
}

/* ===== اختبار الأذان ===== */
function testAdhan() {
  unlockAudio();

  const muezzin = MUEZZINS[prayerSettings.muezzin];
  if (!muezzin) return;

  const lang = localStorage.getItem('lang') || 'ar';

  if (typeof showToast === 'function') {
    showToast(lang === 'ar' ? `جارٍ تشغيل ${muezzin.name}...` : `Playing ${muezzin.name}...`);
  }

  playAdhan();
  updateAdhanButtons(true);
}

/* ===== اختبار إشعار الأذان ===== */
async function testAdhanNotification() {
  const lang = localStorage.getItem('lang') || 'ar';

  if (Notification.permission !== 'granted') {
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? 'يجب تفعيل الإشعارات أولاً' : 'Enable notifications first');
    }
    return;
  }

  /* ✅ إرسال إشعار اختباري */
  await showPrayerNotification(
    lang === 'ar' ? '🕌 اختبار إشعار الأذان' : '🕌 Adhan notification test',
    lang === 'ar'
      ? 'هذا اختبار — سيعمل الإشعار الفعلي في وقت الأذان'
      : 'This is a test — the actual notification will work at prayer time',
    true
  );

  if (typeof showToast === 'function') {
    showToast(lang === 'ar' ? '✅ تم إرسال الإشعار' : '✅ Notification sent');
  }
}

/* ===== إيقاف اختبار الأذان ===== */
function stopTestAdhan() {
  const lang = localStorage.getItem('lang') || 'ar';

  try {
    const audio = document.getElementById('adhanAudio');
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.remove();
    }
  } catch (e) {}

  updateAdhanButtons(false);

  if (typeof showToast === 'function') {
    showToast(lang === 'ar' ? 'تم إيقاف الأذان' : 'Adhan stopped');
  }
}

function updateAdhanButtons(isPlaying) {
  const testBtn = document.getElementById('prayerTestBtn');
  const stopBtn = document.getElementById('prayerStopBtn');

  if (isPlaying) {
    if (testBtn) testBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
  } else {
    if (testBtn) testBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

/* ===== تغيير المؤذن ===== */
function changeMuezzin(value) {
  prayerSettings.muezzin = value;
  savePrayerSettings();

  if (typeof showToast === 'function' && MUEZZINS[value]) {
    showToast(`تم اختيار: ${MUEZZINS[value].name}`);
  }
}

function changeBeforeAlert(value) {
  prayerSettings.beforeAlert = parseInt(value);
  savePrayerSettings();
  scheduleNotifications();

  if (typeof showToast === 'function') {
    const text = value === '0' ? 'بدون إشعار مسبق' : `قبل ${toArabicNum(value)} دقيقة`;
    showToast(text);
  }
}

/* ===== تغيير الموقع ===== */
function changeLocation() {
  let modal = document.getElementById('locationModal');
  if (!modal) {
    createLocationModal();
    modal = document.getElementById('locationModal');
  }
  modal.classList.add('open');
}

function createLocationModal() {
  const modal = document.createElement('div');
  modal.className = 'location-modal';
  modal.id = 'locationModal';
  modal.innerHTML = `
    <div class="location-modal-content" style="position: relative;">
      <button class="location-close-btn" onclick="closeLocationModal()">✕</button>
      <h3 class="location-modal-title">📍 تغيير الموقع</h3>

      <button class="location-btn" onclick="useGPS()">
        <span class="location-btn-icon">🌍</span>
        <span>تحديد موقعي تلقائياً (GPS)</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('مكة المكرمة', 'السعودية', 21.4225, 39.8262)">
        <span class="location-btn-icon">🕋</span>
        <span>مكة المكرمة</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('المدينة المنورة', 'السعودية', 24.5247, 39.5692)">
        <span class="location-btn-icon">🕌</span>
        <span>المدينة المنورة</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('كربلاء المقدسة', 'العراق', 32.6160, 44.0249)">
        <span class="location-btn-icon">🕌</span>
        <span>كربلاء المقدسة</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('النجف الأشرف', 'العراق', 31.9891, 44.3148)">
        <span class="location-btn-icon">🕌</span>
        <span>النجف الأشرف</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('بغداد', 'العراق', 33.3152, 44.3661)">
        <span class="location-btn-icon">🏙️</span>
        <span>بغداد</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('الرياض', 'السعودية', 24.7136, 46.6753)">
        <span class="location-btn-icon">🏙️</span>
        <span>الرياض</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('القاهرة', 'مصر', 30.0444, 31.2357)">
        <span class="location-btn-icon">🏙️</span>
        <span>القاهرة</span>
      </button>

      <button class="location-btn" onclick="useDefaultLocation('دبي', 'الإمارات', 25.2048, 55.2708)">
        <span class="location-btn-icon">🏙️</span>
        <span>دبي</span>
      </button>

      <div class="location-manual-wrap">
        <label class="location-manual-label">أو أدخل الإحداثيات يدوياً:</label>
        <input type="text" class="location-manual-input" id="manualLat" placeholder="خط العرض (مثال: 21.4225)" />
        <input type="text" class="location-manual-input" id="manualLng" placeholder="خط الطول (مثال: 39.8262)" />
        <input type="text" class="location-manual-input" id="manualCity" placeholder="اسم المدينة" />
        <button class="location-save-btn" onclick="saveManualLocation()">حفظ</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target.id === 'locationModal') closeLocationModal();
  });
}

function closeLocationModal() {
  const modal = document.getElementById('locationModal');
  if (modal) modal.classList.remove('open');
}

function useGPS() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast('المتصفح لا يدعم GPS');
    return;
  }

  if (typeof showToast === 'function') showToast('جارٍ تحديد موقعك...');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      let cityName = 'موقعك';
      let countryName = '';

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
        const data = await res.json();
        if (data.address) {
          cityName = data.address.city || data.address.town || data.address.village || data.address.state || 'موقعك';
          countryName = data.address.country || '';
        }
      } catch (err) {
        console.log('تعذر جلب اسم المدينة:', err);
      }

      useDefaultLocation(cityName, countryName, lat, lng);
    },
    (err) => {
      console.error('خطأ GPS:', err);
      if (typeof showToast === 'function') showToast('تعذر تحديد الموقع');
    }
  );
}

function useDefaultLocation(city, country, lat, lng) {
  prayerSettings.city = city;
  prayerSettings.country = country;
  prayerSettings.latitude = lat;
  prayerSettings.longitude = lng;

  savePrayerSettings();
  closeLocationModal();

  if (typeof showToast === 'function') showToast(`تم اختيار: ${city}`);

  fetchPrayerTimes();
}

function saveManualLocation() {
  const lat = parseFloat(document.getElementById('manualLat').value);
  const lng = parseFloat(document.getElementById('manualLng').value);
  const city = document.getElementById('manualCity').value.trim() || 'موقعي';

  if (isNaN(lat) || isNaN(lng)) {
    if (typeof showToast === 'function') showToast('أدخل إحداثيات صحيحة');
    return;
  }

  useDefaultLocation(city, '', lat, lng);
}

/* ===== عرض صفحة المواقيت ===== */
function showPrayer() {
  if (typeof stopAutoScroll === 'function') stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('prayerView').classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  if (items[2]) items[2].classList.add('active');

  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  loadPrayerSettings();
  checkNotificationsStatus();
  fetchPrayerTimes();
}

/* ===== تشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadPrayerSettings();

  if (prayerSettings.notificationsEnabled) {
    scheduleNotifications();
  }

  if (document.getElementById('prayerView')) {
    setInterval(() => {
      checkForPrayerAlerts();
    }, 60000);
  }
});