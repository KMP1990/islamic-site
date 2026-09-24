/* ============================================
   Notification Manager — v1.1
   نظام إشعارات موحّد ذكي
   ============================================
   ✅ إشعار واحد لكل محادثة (لا تراكم)
   ✅ Grouping ذكي ("5 رسائل جديدة")
   ✅ Auto-clear بعد 6 ثوانٍ
   ✅ Deduplication (لا تكرار)
   ✅ إزالة عند فتح المحادثة
   ✅ عربي نظيف (بدون URL encoding)
   ✅ Quiet Hours (ساعات الهدوء)
   ✅ أولويات الإشعارات (high/medium/low)
   ✅ إحصائيات الإشعارات
   ============================================ */

const NotificationManager = (() => {
  'use strict';

  /* ===== الإعدادات ===== */
  const CONFIG = {
    autoDismissMs: 6000,           // 6 ثوانٍ
    dedupWindowMs: 30000,          // 30 ثانية
    maxVisible: 3,                 // 3 إشعارات كحد أقصى
    stackThreshold: 2              // 2+ رسائل → grouping
  };

  /* ===== الحالة ===== */
  const activeNotifications = new Map();    // id → { element, data, count }
  const sentHistory = new Map();            // hash → timestamp
  const dismissedThisSession = new Set();   // id → dismissed

  /* ============================================
     تهيئة الحاوية
     ============================================ */
  function getContainer() {
    let container = document.getElementById('notification-manager-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-manager-container';
      container.className = 'notif-manager-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /* ============================================
     إصلاح الترميز
     ============================================ */
  function cleanText(text) {
    if (!text) return '';

    let cleaned = String(text);

    // ✅ محاولة فك URL encoding
    try {
      if (/%[0-9A-Fa-f]{2}/.test(cleaned)) {
        cleaned = decodeURIComponent(cleaned);
      }
    } catch (e) {}

    // ✅ إزالة + استبدال الرموز الزائدة
    cleaned = cleaned
      .replace(/\+/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/%/g, '')
      .trim();

    return cleaned;
  }

  /* ============================================
     توليد ID فريد للإشعار
     ============================================ */
  function generateId(data) {
    if (data.chatId) return `chat_${data.chatId}`;
    if (data.notifId) return `notif_${data.notifId}`;
    if (data.type === 'friend_request') return `friend_req`;
    if (data.type === 'friend_accepted') return `friend_acc`;
    return `general_${Date.now()}`;
  }

  /* ============================================
     Hash للتكرار
     ============================================ */
  function hashNotification(data) {
    const str = `${data.type || ''}_${data.chatId || ''}_${cleanText(data.title)}_${cleanText(data.body || '').slice(0, 50)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /* ============================================
     فحص التكرار
     ============================================ */
  function isDuplicate(data) {
    const hash = hashNotification(data);
    const now = Date.now();

    // تنظيف القديم
    for (const [h, time] of sentHistory) {
      if (now - time > CONFIG.dedupWindowMs) sentHistory.delete(h);
    }

    if (sentHistory.has(hash)) {
      return true;
    }

    sentHistory.set(hash, now);
    return false;
  }

  /* ============================================
     ✅ عرض إشعار — مع Quiet Hours والأولويات
     ============================================ */
  function show(data) {
    // ✅ 1. فحص الإعدادات (Quiet Hours + الأولويات + الكتم)
    if (window.NotificationSettings) {
      const check = window.NotificationSettings.shouldShow(data);

      // إذا مكتوم تماماً
      if (!check.show) {
        console.log('🔇 Notification muted:', check.reason, '—', data.title);
        window.NotificationSettings.trackNotification(
          data.type || 'general',
          true, // muted
          false
        );
        return null;
      }

      // تتبع الإحصائيات
      window.NotificationSettings.trackNotification(
        data.type || 'general',
        false,
        !check.sound
      );

      // إرفاق flags الصوت
      data._allowSound = check.sound;
      data._allowVibration = check.vibration;
    } else {
      data._allowSound = true;
      data._allowVibration = true;
    }

    // ✅ 2. فحص التكرار
    if (isDuplicate(data)) {
      console.log('⏭️ Duplicate notification skipped');
      return null;
    }

    const id = generateId(data);

    // ✅ إذا موجود إشعار لنفس المحادثة → تحديثه
    if (activeNotifications.has(id)) {
      return updateExisting(id, data);
    }

    // ✅ الحد الأقصى
    if (activeNotifications.size >= CONFIG.maxVisible) {
      const oldest = activeNotifications.keys().next().value;
      dismiss(oldest);
    }

    // ✅ تنظيف النصوص
    const cleanTitle = cleanText(data.title || 'إشعار جديد');
    const cleanBody = cleanText(data.body || '');

    // ✅ تحديد الأولوية
    const priority = window.NotificationSettings?.getPriority(data.type) || 'medium';
    data._priority = priority;

    // ✅ إنشاء العنصر
    const element = createNotificationElement({
      ...data,
      title: cleanTitle,
      body: cleanBody,
      count: 1
    }, id);

    // ✅ إضافة للحاوية
    const container = getContainer();
    container.appendChild(element);

    // ✅ إظهار
    requestAnimationFrame(() => {
      element.classList.add('show');
    });

    // ✅ حفظ
    activeNotifications.set(id, {
      element,
      data: { ...data, title: cleanTitle, body: cleanBody, count: 1 },
      createdAt: Date.now()
    });

    // ✅ Auto-dismiss
    const timer = setTimeout(() => {
      dismiss(id);
    }, CONFIG.autoDismissMs);

    // ✅ تخزين الـ timer
    const record = activeNotifications.get(id);
    if (record) record.timer = timer;

    // ✅ صوت (حسب الإعدادات والأولوية)
    if (data._allowSound) {
      playSound(priority === 'high');
    }

    // ✅ اهتزاز (حسب الإعدادات والأولوية)
    if (data._allowVibration && navigator.vibrate) {
      navigator.vibrate(priority === 'high' ? [100, 50, 100] : [80, 40, 80]);
    }

    // ✅ Analytics
    if (typeof trackEvent === 'function') {
      trackEvent('notification_shown', {
        type: data.type || 'general',
        priority
      });
    }

    console.log('✅ Notification shown:', cleanTitle, `(${priority})`);
    return element;
  }

  /* ============================================
     إنشاء عنصر الإشعار
     ============================================ */
  function createNotificationElement(data, id) {
    const el = document.createElement('div');
    el.className = `notif-manager-item notif-${data.type || 'general'}`;
    el.dataset.id = id;
    el.dataset.color = data.color || 'gold';
    if (data._priority) {
      el.dataset.priority = data._priority;
    }

    // أيقونة
    const icon = data.icon || getDefaultIcon(data.type);

    // نص الجسم (Grouping)
    const bodyText = data.count > 1
      ? `${data.count} رسائل جديدة${data.body ? ': ' + data.body : ''}`
      : (data.body || '');

    // زر الرابط (إذا فيه)
    const hasAction = data.link && data.link !== 'chat';

    el.innerHTML = `
      <button class="notif-manager-close" aria-label="إغلاق">✕</button>
      <div class="notif-manager-icon">${icon}</div>
      <div class="notif-manager-content">
        <strong class="notif-manager-title">${escapeHtml(data.title)}</strong>
        ${bodyText ? `<p class="notif-manager-body">${escapeHtml(bodyText)}</p>` : ''}
        ${hasAction ? `<button class="notif-manager-action" data-link="${escapeHtml(data.link)}">فتح</button>` : ''}
      </div>
      ${data.count > 1 ? `<span class="notif-manager-badge">${data.count}</span>` : ''}
    `;

    // ✅ أحداث
    el.querySelector('.notif-manager-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss(id);
    });

    el.addEventListener('click', (e) => {
      if (e.target.closest('.notif-manager-close')) return;
      handleClick(data, id);
    });

    el.querySelector('.notif-manager-action')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const link = e.target.dataset.link;
      if (link && typeof window.location !== 'undefined') {
        window.location.hash = link;
      }
      dismiss(id);
    });

    return el;
  }

  /* ============================================
     تحديث إشعار موجود (Grouping)
     ============================================ */
  function updateExisting(id, data) {
    const record = activeNotifications.get(id);
    if (!record) return null;

    const newCount = (record.data.count || 1) + 1;
    const cleanBody = cleanText(data.body || '');

    // تحديث البيانات
    record.data.count = newCount;
    record.data.title = cleanText(data.title || record.data.title);
    record.data.body = cleanBody;

    // تحديث العنصر
    const el = record.element;
    const bodyEl = el.querySelector('.notif-manager-body');
    const badgeEl = el.querySelector('.notif-manager-badge');

    if (bodyEl) {
      bodyEl.textContent = `${newCount} رسائل جديدة: ${cleanBody}`;
    }

    if (badgeEl) {
      badgeEl.textContent = newCount;
    } else {
      const badge = document.createElement('span');
      badge.className = 'notif-manager-badge';
      badge.textContent = newCount;
      el.appendChild(badge);
    }

    // ✅ إعادة Animation
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');

    // ✅ إعادة ضبط Auto-dismiss
    if (record.timer) clearTimeout(record.timer);
    record.timer = setTimeout(() => dismiss(id), CONFIG.autoDismissMs);

    console.log('🔄 Notification updated:', id, '→', newCount);

    // ✅ صوت خفيف (فقط إذا مسموح)
    if (data._allowSound !== false) {
      playSound(false);
    }

    return el;
  }

  /* ============================================
     إغلاق إشعار
     ============================================ */
  function dismiss(id) {
    const record = activeNotifications.get(id);
    if (!record) return;

    // إزالة الـ timer
    if (record.timer) clearTimeout(record.timer);

    const el = record.element;

    // Animation إغلاق
    el.classList.remove('show');
    el.classList.add('hide');

    setTimeout(() => {
      el.remove();
    }, 400);

    // إزالة من الخريطة
    activeNotifications.delete(id);

    // إضافة للـ dismissed
    dismissedThisSession.add(id);

    console.log('❌ Dismissed:', id);
  }

  /* ============================================
     إزالة كل الإشعارات لمحادثة
     ============================================ */
  function clearByChat(chatId) {
    const id = `chat_${chatId}`;
    if (activeNotifications.has(id)) {
      dismiss(id);
      console.log('🧹 Cleared notifications for chat:', chatId);
    }
  }

  /* ============================================
     إزالة كل الإشعارات
     ============================================ */
  function clearAll() {
    for (const id of activeNotifications.keys()) {
      dismiss(id);
    }
    console.log('🧹 Cleared all notifications');
  }

  /* ============================================
     معالجة النقر
     ============================================ */
  function handleClick(data, id) {
    dismiss(id);

    // الأحداث
    if (data.link === 'friends_requests') {
      if (typeof showFriends === 'function') {
        showFriends();
        setTimeout(() => {
          if (typeof switchFriendsTab === 'function') switchFriendsTab('requests');
        }, 500);
      }
    } else if (data.link === 'friends') {
      if (typeof showFriends === 'function') {
        showFriends();
        setTimeout(() => {
          if (typeof switchFriendsTab === 'function') switchFriendsTab('friends');
        }, 500);
      }
    } else if (data.link === 'chat' && data.chatId) {
      // ✅ فتح الدردشة في نافذة عائمة
      if (window.showFriends) showFriends();

      setTimeout(() => {
        const chat = window.friendsState?.chats?.find(c => c.id === data.chatId);
        if (chat && window.ChatFloatWindow) {
          window.ChatFloatWindow.open(chat);
        } else if (typeof openChat === 'function') {
          openChat(data.chatId);
        }
      }, 500);
    }

    // ✅ تحديث حالة القراءة
    if (data.notifId && typeof markNotificationRead === 'function') {
      markNotificationRead(data.notifId).catch(() => {});
    }
  }

  /* ============================================
     مساعدات
     ============================================ */
  function getDefaultIcon(type) {
    const icons = {
      chat_message: '💬',
      friend_request: '👥',
      friend_accepted: '✅',
      group_invite: '👨‍👩‍👦',
      prayer_time: '🕌',
      prayer_adhan: '🕌',
      test: '🔔',
      general: '🔔'
    };
    return icons[type] || '🔔';
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  /* ============================================
     ✅ الصوت حسب الأولوية
     ============================================ */
  function playSound(isHighPriority = false) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // ✅ نغمة مختلفة حسب الأولوية
      if (isHighPriority) {
        // عالية: نغمة مزدوجة
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
      } else {
        // عادية: نغمة بسيطة
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);

      setTimeout(() => ctx.close(), 500);
    } catch (e) {}
  }

  /* ============================================
     واجهة API
     ============================================ */
  function getActiveCount() {
    return activeNotifications.size;
  }

  function getActiveIds() {
    return [...activeNotifications.keys()];
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    show,
    dismiss,
    clearByChat,
    clearAll,
    cleanText,
    getActiveCount,
    getActiveIds,
    CONFIG
  };
})();

window.NotificationManager = NotificationManager;
console.log('✅ NotificationManager v1.1 loaded');