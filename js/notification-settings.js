/* ============================================
   Notification Settings — v1.0
   إعدادات الإشعارات + Quiet Hours + الأولويات
   ============================================
   ✅ Quiet Hours (ساعات الهدوء)
   ✅ أولويات الإشعارات
   ✅ المحادثات المكتومة
   ✅ إحصائيات الإشعارات
   ✅ حفظ في Firestore + localStorage
   ============================================ */

const NotificationSettings = (() => {
  'use strict';

  const STORAGE_KEY = 'tariq_notification_settings';
  const STATS_KEY = 'tariq_notification_stats';
  const FIRESTORE_COLLECTION = 'notificationSettings';

  /* ============================================
     الإعدادات الافتراضية
     ============================================ */
  const DEFAULT_SETTINGS = {
    // Quiet Hours
    quietHoursEnabled: true,
    quietHoursStart: '23:00',
    quietHoursEnd: '05:00',

    // الأصوات
    soundEnabled: true,
    vibrationEnabled: true,
    soundForMessages: true,
    soundForInteractions: false,
    soundForRequests: true,

    // المحادثات المكتومة (chatId list)
    mutedChats: [],

    // أنواع مكتومة مؤقتاً
    mutedTypes: [],

    // الحد اليومي
    maxPerDay: 50
  };

  /* ============================================
     الأولويات
     ============================================ */
  const PRIORITIES = {
    'chat_message':      'high',
    'friend_request':    'high',
    'friend_accepted':   'high',
    'group_invite':      'high',
    'prayer_time':       'medium',
    'prayer_adhan':      'high',
    'interaction':       'medium',
    'like':              'low',
    'comment':           'medium',
    'system':            'low',
    'test':              'low',
    'general':           'low'
  };

  /* ============================================
     الإحصائيات
     ============================================ */
  let stats = {
    today: 0,
    todayMuted: 0,
    todaySilent: 0,
    total: 0,
    lastReset: new Date().toDateString(),
    byType: {},
    byHour: {}
  };

  /* ============================================
     تحميل الإعدادات
     ============================================ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  /* ============================================
     حفظ الإعدادات
     ============================================ */
  async function save(settings) {
    try {
      // حفظ محلي
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // حفظ في Firestore
      const user = window.authApi?.getCurrentUser?.();
      if (user && user.uid && window.firebaseHelpers) {
        await window.firebaseHelpers.fbSetDoc(
          FIRESTORE_COLLECTION,
          user.uid,
          {
            ...settings,
            updatedAt: new Date().toISOString()
          }
        ).catch(() => {});
      }

      console.log('💾 Settings saved');
      return true;
    } catch (e) {
      console.error('Save settings failed:', e);
      return false;
    }
  }

  /* ============================================
     مزامنة من Firestore
     ============================================ */
  async function syncFromCloud() {
    try {
      const user = window.authApi?.getCurrentUser?.();
      if (!user || !user.uid || !window.firebaseHelpers) return;

      const cloud = await window.firebaseHelpers.fbGetDoc(FIRESTORE_COLLECTION, user.uid);
      if (cloud) {
        const merged = { ...DEFAULT_SETTINGS, ...cloud };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        console.log('☁️ Settings synced from cloud');
      }
    } catch (e) {}
  }

  /* ============================================
     ✅ فحص Quiet Hours
     ============================================ */
  function isQuietTime(settings = null) {
    const s = settings || load();
    if (!s.quietHoursEnabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startMinutes = parseTime(s.quietHoursStart);
    const endMinutes = parseTime(s.quietHoursEnd);

    // ✅ Quiet Hours تعبر منتصف الليل
    // مثال: 23:00 → 05:00
    if (startMinutes > endMinutes) {
      // الحالي بين start و 24:00 OR بين 00:00 و end
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // عادي: من 14:00 إلى 16:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  function parseTime(timeStr) {
    const [h, m] = String(timeStr || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /* ============================================
     ✅ فحص الأولوية
     ============================================ */
  function getPriority(type) {
    return PRIORITIES[type] || 'low';
  }

  /* ============================================
     ✅ تحديد طريقة العرض
     ============================================ */
  function shouldShow(data) {
    const settings = load();
    const result = {
      show: true,
      sound: true,
      vibration: true,
      reason: null
    };

    const type = data.type || 'general';
    const priority = getPriority(type);

    // 1. فحص الكتم الكامل
    if (settings.mutedTypes.includes(type)) {
      result.show = false;
      result.reason = 'muted-type';
      return result;
    }

    // 2. فحص المحادثة المكتومة
    if (data.chatId && settings.mutedChats.includes(data.chatId)) {
      result.show = false;
      result.reason = 'muted-chat';
      return result;
    }

    // 3. فحص Quiet Hours
    if (isQuietTime(settings)) {
      // ✅ الإشعارات العالية تخترق Quiet Hours
      if (priority === 'high') {
        // تظهر لكن بدون صوت
        result.sound = false;
        result.vibration = false;
        result.reason = 'quiet-hours-high-priority';
      } else {
        // متوسطة ومنخفضة → صامتة تماماً
        result.show = false;
        result.reason = 'quiet-hours';
        return result;
      }
    }

    // 4. الصوت حسب النوع
    if (!settings.soundEnabled) {
      result.sound = false;
    } else {
      if (type === 'chat_message' && !settings.soundForMessages) result.sound = false;
      if (type === 'friend_request' && !settings.soundForRequests) result.sound = false;
      if (priority === 'medium' && !settings.soundForInteractions) result.sound = false;
      if (priority === 'low') result.sound = false;
    }

    // 5. الاهتزاز
    if (!settings.vibrationEnabled) {
      result.vibration = false;
    }

    return result;
  }

  /* ============================================
     ✅ الإحصائيات
     ============================================ */
  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        // ✅ إعادة تعيين يومية
        if (loaded.lastReset !== new Date().toDateString()) {
          return {
            today: 0,
            todayMuted: 0,
            todaySilent: 0,
            total: loaded.total || 0,
            lastReset: new Date().toDateString(),
            byType: {},
            byHour: {}
          };
        }
        return loaded;
      }
    } catch (e) {}
    return { ...stats };
  }

  function saveStats(newStats) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(newStats));
    } catch (e) {}
  }

  function trackNotification(type, wasMuted, wasSilent) {
    stats = loadStats();

    stats.total++;
    if (!wasMuted) {
      stats.today++;
    } else {
      stats.todayMuted++;
    }
    if (wasSilent && !wasMuted) {
      stats.todaySilent++;
    }

    // حسب النوع
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // حسب الساعة
    const hour = new Date().getHours();
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;

    saveStats(stats);
  }

  function getStats() {
    return loadStats();
  }

  function resetStats() {
    stats = {
      today: 0,
      todayMuted: 0,
      todaySilent: 0,
      total: 0,
      lastReset: new Date().toDateString(),
      byType: {},
      byHour: {}
    };
    saveStats(stats);
  }

  /* ============================================
     دوال مساعدة
     ============================================ */
  function updateSetting(key, value) {
    const settings = load();
    settings[key] = value;
    save(settings);
    return settings;
  }

  function toggleMuteChat(chatId) {
    const settings = load();
    const index = settings.mutedChats.indexOf(chatId);

    if (index >= 0) {
      settings.mutedChats.splice(index, 1);
    } else {
      settings.mutedChats.push(chatId);
    }

    save(settings);
    return settings.mutedChats.includes(chatId);
  }

  function isChatMuted(chatId) {
    return load().mutedChats.includes(chatId);
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    load,
    save,
    syncFromCloud,
    isQuietTime,
    getPriority,
    shouldShow,
    updateSetting,
    toggleMuteChat,
    isChatMuted,
    trackNotification,
    getStats,
    resetStats,
    DEFAULT_SETTINGS,
    PRIORITIES
  };
})();

window.NotificationSettings = NotificationSettings;
console.log('✅ NotificationSettings v1.0 loaded');