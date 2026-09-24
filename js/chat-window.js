/* ============================================
   Chat Float Window — v1.0
   نافذة دردشة عائمة مثل WhatsApp Web
   ============================================ */

const ChatFloatWindow = (() => {
  'use strict';

  let activeChat = null;
  let isOpen = false;
  let isMinimized = false;
  let messageUnsubscribe = null;
  let typingUnsubscribe = null;

  /* ============================================
     العناصر
     ============================================ */
  function getElements() {
    return {
      window: document.getElementById('chatFloatWindow'),
      launcher: document.getElementById('chatFloatLauncher'),
      avatar: document.getElementById('chatFloatAvatar'),
      name: document.getElementById('chatFloatName'),
      substatus: document.getElementById('chatFloatSubstatus'),
      body: document.getElementById('chatFloatBody'),
      input: document.getElementById('chatFloatInput'),
      send: document.getElementById('chatFloatSend'),
      minimize: document.getElementById('chatFloatMinimize'),
      close: document.getElementById('chatFloatClose'),
      header: document.getElementById('chatFloatHeader')
    };
  }

  /* ============================================
     فتح الدردشة
     ============================================ */
  async function openChat(chat) {
    if (!chat) return;

    activeChat = chat;
    isOpen = true;
    isMinimized = false;

    const els = getElements();
    if (!els.window) {
      console.warn('⚠️ chat float window not in HTML');
      return;
    }

    // تحديث الرأس
    updateHeader(chat);

    // إظهار النافذة
    els.window.classList.add('open');
    els.window.classList.remove('minimized');

    // إخفاء زر التشغيل
    if (els.launcher) els.launcher.classList.remove('show');

    // تحميل الرسائل
    await loadMessages(chat.id);

    // الاستماع للرسائل الجديدة
    listenToMessages(chat.id);

    // الاستماع لمؤشر الكتابة
    listenToTyping(chat.id);

    // تحديث حالة الاتصال
    updatePresenceStatus(chat);

    // تركيز الإدخال
    setTimeout(() => els.input?.focus(), 300);

    console.log('✅ Chat window opened:', chat.id);
  }

  /* ============================================
     تحديث الرأس
     ============================================ */
  function updateHeader(chat) {
    const els = getElements();
    if (!els.name) return;

    const displayName = chat.displayName || chat.name || 'محادثة';
    const initial = displayName.charAt(0).toUpperCase();

    // الاسم
    els.name.textContent = displayName;

    // الصورة
    if (els.avatar) {
      if (chat.displayAvatar) {
        els.avatar.innerHTML = `<img src="${escapeHtml(chat.displayAvatar)}" alt="">`;
      } else {
        els.avatar.innerHTML = escapeHtml(initial);
      }

      // نقطة الحالة
      const statusDot = document.createElement('span');
      statusDot.className = 'chat-float-status-dot';
      const status = getCachedUserStatus(chat.otherUser?.uid);
      statusDot.classList.add(status);
      els.avatar.appendChild(statusDot);
    }

    // الحالة النصية
    updateSubstatus(chat);
  }

  /* ============================================
     تحديث الحالة النصية
     ============================================ */
    function updateSubstatus(chat) {
    const els = getElements();
    if (!els.substatus) return;

    if (chat.type === 'group') {
      els.substatus.textContent = `${chat.members?.length || 0} أعضاء`;
      els.substatus.className = 'chat-float-substatus';
      return;
    }

    const uid = chat.otherUser?.uid;
    if (!uid) return;

    // استخدام PresenceSystem إذا متاح
    if (window.PresenceSystem) {
      const data = window.PresenceSystem.getStatus(uid);
      updateSubstatusWithData(chat, data);
      return;
    }

    // Fallback: من cache
    const status = getCachedUserStatus(uid);
    const lastSeen = getCachedLastSeen(uid);

    if (status === 'online') {
      els.substatus.textContent = 'متصل الآن';
      els.substatus.className = 'chat-float-substatus online';
    } else if (status === 'away') {
      els.substatus.textContent = 'بعيد';
      els.substatus.className = 'chat-float-substatus';
    } else if (lastSeen) {
      els.substatus.textContent = `آخر ظهور: ${formatLastSeen(lastSeen)}`;
      els.substatus.className = 'chat-float-substatus';
    } else {
      els.substatus.textContent = 'غير متصل';
      els.substatus.className = 'chat-float-substatus';
    }
  }
  /* ============================================
     حالة الاتصال
     ============================================ */
  function getCachedUserStatus(uid) {
    try {
      const cached = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');
      return cached[uid]?.status || 'offline';
    } catch { return 'offline'; }
  }

  function getCachedLastSeen(uid) {
    try {
      const cached = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');
      return cached[uid]?.lastSeen || null;
    } catch { return null; }
  }

    function formatLastSeen(iso) {
    if (!iso) return 'غير معروف';

    const date = new Date(iso);
    const now = new Date();
    const diff = (now - date) / 1000;

    // أقل من دقيقة
    if (diff < 60) return 'الآن';

    // أقل من ساعة
    if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      if (mins === 1) return 'قبل دقيقة';
      if (mins === 2) return 'قبل دقيقتين';
      if (mins < 11) return `قبل ${mins} دقائق`;
      return `قبل ${mins} دقيقة`;
    }

    // أقل من يوم
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      if (hours === 1) return 'قبل ساعة';
      if (hours === 2) return 'قبل ساعتين';
      if (hours < 11) return `قبل ${hours} ساعات`;
      return `قبل ${hours} ساعة`;
    }

    // أمس
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      const time = date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      return `أمس ${time}`;
    }

    // خلال هذا الأسبوع
    if (diff < 604800) {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[date.getDay()];
    }

    // أقدم
    return date.toLocaleDateString('ar-IQ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  /* ============================================
     إغلاق الدردشة
     ============================================ */
  function closeChat() {
    const els = getElements();
    if (!els.window) return;

    els.window.classList.remove('open');
    els.window.classList.remove('minimized');

    isOpen = false;
    isMinimized = false;

    // إلغاء الاشتراكات
    if (messageUnsubscribe) {
      try { messageUnsubscribe(); } catch (e) {}
      messageUnsubscribe = null;
    }
    if (typingUnsubscribe) {
      try { typingUnsubscribe(); } catch (e) {}
      typingUnsubscribe = null;
    }

    // إظهار زر التشغيل
    if (els.launcher) els.launcher.classList.add('show');

    activeChat = null;
    console.log('❌ Chat window closed');
  }

  /* ============================================
     تصغير / تكبير
     ============================================ */
  function toggleMinimize() {
    const els = getElements();
    if (!els.window) return;

    isMinimized = !isMinimized;
    els.window.classList.toggle('minimized', isMinimized);
  }

  /* ============================================
     تحميل الرسائل
     ============================================ */
  async function loadMessages(chatId) {
    const els = getElements();
    if (!els.body) return;

    els.body.innerHTML = `
      <div class="chat-float-empty">
        <span class="chat-float-empty-icon">⏳</span>
        جارٍ التحميل...
      </div>
    `;

    try {
      const all = await window.firebaseHelpers.fbGetCollection('chatMessages');
      const messages = all
        .filter(m => m.chatId === chatId)
        .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));

      if (!messages.length) {
        els.body.innerHTML = `
          <div class="chat-float-empty">
            <span class="chat-float-empty-icon">👋</span>
            ابدأ المحادثة الآن
          </div>
        `;
        return;
      }

      renderMessages(messages);
    } catch (err) {
      console.error('Load messages error:', err);
      els.body.innerHTML = `
        <div class="chat-float-empty">
          <span class="chat-float-empty-icon">❌</span>
          تعذر تحميل الرسائل
        </div>
      `;
    }
  }

  /* ============================================
     عرض الرسائل
     ============================================ */
  function renderMessages(messages) {
    const els = getElements();
    if (!els.body) return;

    const myUid = window.authApi?.getCurrentUser?.()?.uid;
    const groups = groupByDay(messages);

    const html = groups.map(group => {
      const dayHtml = `
        <div class="chat-float-day-divider">
          <span>${group.dayLabel}</span>
        </div>
      `;

      const messagesHtml = group.messages.map(msg => {
        const isSent = msg.fromUid === myUid;
        const time = formatTime(msg.createdAt);

        return `
          <div class="chat-float-msg ${isSent ? 'sent' : 'received'}">
            <div class="chat-float-msg-bubble">
              <div class="chat-float-msg-text">${escapeHtml(msg.text || '')}</div>
              <div class="chat-float-msg-meta">
                <span>${time}</span>
                ${isSent ? '<span>✓✓</span>' : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      return dayHtml + messagesHtml;
    }).join('');

    els.body.innerHTML = html;

    // النزول للأسفل
    requestAnimationFrame(() => {
      els.body.scrollTop = els.body.scrollHeight;
    });
  }

  function groupByDay(messages) {
    const groups = [];
    let currentDay = null;
    let currentGroup = null;

    messages.forEach(msg => {
      const ts = toTimestamp(msg.createdAt);
      if (!ts) return;

      const date = new Date(ts);
      const dayKey = date.toDateString();

      if (dayKey !== currentDay) {
        currentDay = dayKey;
        currentGroup = {
          dayLabel: formatDayLabel(date),
          messages: []
        };
        groups.push(currentGroup);
      }

      currentGroup.messages.push({ ...msg, _date: date });
    });

    return groups;
  }

  function formatDayLabel(date) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today) return 'اليوم';
    if (date.toDateString() === yesterday.toDateString()) return 'أمس';

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    return `${days[date.getDay()]}، ${date.getDate()} ${months[date.getMonth()]}`;
  }

  function formatTime(iso) {
    if (!iso) return '';
    const ts = toTimestamp(iso);
    if (!ts) return '';
    const date = new Date(ts);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function toTimestamp(value) {
    if (!value) return 0;
    if (typeof value === 'object') {
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (typeof value.seconds === 'number') return value.seconds * 1000;
      if (value._seconds !== undefined) return value._seconds * 1000;
      if (typeof value.toDate === 'function') return value.toDate().getTime();
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  /* ============================================
     الاستماع للرسائل الجديدة
     ============================================ */
  function listenToMessages(chatId) {
    if (messageUnsubscribe) {
      try { messageUnsubscribe(); } catch (e) {}
    }

    if (!window.firebaseHelpers) return;

    messageUnsubscribe = window.firebaseHelpers.fbListenCollection(
      'chatMessages',
      (all) => {
        const messages = all
          .filter(m => m.chatId === chatId)
          .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));

        renderMessages(messages);
      }
    );
  }

  /* ============================================
     الاستماع لمؤشر الكتابة
     ============================================ */
  function listenToTyping(chatId) {
    if (typingUnsubscribe) {
      try { typingUnsubscribe(); } catch (e) {}
    }

    if (!window.firebaseHelpers) return;

    typingUnsubscribe = window.firebaseHelpers.fbListenCollection(
      'typing',
      (all) => {
        const myUid = window.authApi?.getCurrentUser?.()?.uid;
        const peer = all.find(t =>
          t.chatId === chatId &&
          t.uid !== myUid &&
          t.typing === true &&
          Date.now() - toTimestamp(t.updatedAt) < 5000
        );

        updateSubstatus(activeChat);
        if (peer) {
          const els = getElements();
          if (els.substatus) {
            els.substatus.textContent = 'يكتب الآن...';
            els.substatus.className = 'chat-float-substatus typing';
          }
        }
      }
    );
  }

  /* ============================================
     إرسال رسالة
     ============================================ */
  async function sendMessage() {
    const els = getElements();
    if (!els.input || !activeChat) return;

    const text = els.input.value.trim();
    if (!text) return;

    const myUid = window.authApi?.getCurrentUser?.()?.uid;
    if (!myUid) return;

    if (els.send) els.send.disabled = true;

    try {
      await window.firebaseHelpers.fbAddDoc('chatMessages', {
        chatId: activeChat.id,
        fromUid: myUid,
        fromName: window.authApi?.getCurrentUser?.()?.fullName || 'مستخدم',
        text,
        createdAt: new Date().toISOString()
      });

      // تحديث آخر رسالة
      await window.firebaseHelpers.fbSetDoc('chats', activeChat.id, {
        lastMessage: {
          text,
          fromUid: myUid,
          at: new Date().toISOString()
        },
        lastMessageAt: new Date().toISOString()
      });

      // إرسال إشعار Push
      if (activeChat.type === 'private' && activeChat.otherUser?.uid) {
        if (window.notificationSystem?.sendPush) {
          await window.notificationSystem.sendPush(activeChat.otherUser.uid, {
            type: 'chat_message',
            title: `💬 رسالة من ${window.authApi?.getCurrentUser?.()?.fullName || 'مستخدم'}`,
            body: text.slice(0, 100),
            fromUid: myUid,
            chatId: activeChat.id,
            link: 'chat'
          }).catch(() => {});
        }
      }

      // تفريغ
      els.input.value = '';
      els.input.style.height = 'auto';
      els.input.focus();

      if (typeof trackEvent === 'function') {
        trackEvent('chat_message_sent');
      }
    } catch (err) {
      console.error('Send error:', err);
      if (typeof showToast === 'function') showToast('تعذر الإرسال');
    } finally {
      if (els.send) els.send.disabled = false;
    }
  }

  /* ============================================
     تحديث حالة الاتصال
     ============================================ */
    function updatePresenceStatus(chat) {
    if (!chat || chat.type !== 'private') return;

    const otherUid = chat.otherUser?.uid;
    if (!otherUid) return;

    // ✅ استخدام نظام Presence الجديد
    if (window.PresenceSystem) {
      window.PresenceSystem.listenToUser(otherUid, (data) => {
        updateSubstatusWithData(chat, data);

        // تحديث النقطة
        const els = getElements();
        const dot = els.avatar?.querySelector('.chat-float-status-dot');
        if (dot) {
          dot.className = 'chat-float-status-dot ' + data.status;
        }
      });
    } else {
      // Fallback
      if (!window.firebaseHelpers) return;

      window.firebaseHelpers.fbListenDoc('userStatus', otherUid, (data) => {
        if (!data) return;

        try {
          const cached = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');
          cached[otherUid] = {
            status: data.status || 'offline',
            lastSeen: data.lastSeen || null
          };
          localStorage.setItem('tariq_user_status', JSON.stringify(cached));
        } catch (e) {}

        updateSubstatus(chat);

        const els = getElements();
        const dot = els.avatar?.querySelector('.chat-float-status-dot');
        if (dot) {
          dot.className = 'chat-float-status-dot ' + (data.status || 'offline');
        }
      });
    }
  }

  /* ============================================
     تحديث الحالة النصية من البيانات
     ============================================ */
  function updateSubstatusWithData(chat, data) {
    const els = getElements();
    if (!els.substatus) return;

    if (chat.type === 'group') {
      els.substatus.textContent = `${chat.members?.length || 0} أعضاء`;
      els.substatus.className = 'chat-float-substatus';
      return;
    }

    const { status, lastSeen } = data;

    if (status === 'online') {
      els.substatus.textContent = 'متصل الآن';
      els.substatus.className = 'chat-float-substatus online';
    } else if (status === 'away') {
      els.substatus.textContent = 'بعيد';
      els.substatus.className = 'chat-float-substatus';
    } else if (lastSeen) {
      const formatted = formatLastSeen(lastSeen);
      els.substatus.textContent = `آخر ظهور: ${formatted}`;
      els.substatus.className = 'chat-float-substatus';
      els.substatus.title = new Date(lastSeen).toLocaleString('ar-IQ');
    } else {
      els.substatus.textContent = 'غير متصل';
      els.substatus.className = 'chat-float-substatus';
    }
  }
  /* ============================================
     أدوات
     ============================================ */
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  /* ============================================
     ربط الأحداث
     ============================================ */
    function bindEvents() {
    const els = getElements();
    if (!els.window) return;

    // زر الإرسال
    els.send?.addEventListener('click', sendMessage);

    // زر الإيموجي
    document.getElementById('chatFloatEmojiBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.ChatEmojiPicker) {
        window.ChatEmojiPicker.toggle((emoji) => {
          const input = document.getElementById('chatFloatInput');
          if (!input) return;

          // إدراج الإيموجي عند موقع المؤشر
          const start = input.selectionStart;
          const end = input.selectionEnd;
          const text = input.value;

          input.value = text.substring(0, start) + emoji + text.substring(end);
          input.selectionStart = input.selectionEnd = start + emoji.length;
          input.focus();

          // Auto-resize
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
      }
    });

    // Enter للإرسال
    els.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize
    els.input?.addEventListener('input', () => {
      els.input.style.height = 'auto';
      els.input.style.height = Math.min(els.input.scrollHeight, 100) + 'px';
    });

    // التصغير
    els.minimize?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    // الإغلاق
    els.close?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChat();
    });

    // النقر على الرأس → تصغير
    els.header?.addEventListener('click', (e) => {
      if (e.target.closest('.chat-float-btn')) return;
      toggleMinimize();
    });

    // زر التشغيل
    els.launcher?.addEventListener('click', () => {
      const lastChat = window.friendsState?.chats?.[0];
      if (lastChat) openChat(lastChat);
    });
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    open: openChat,
    close: closeChat,
    toggleMinimize,
    isOpen: () => isOpen,
    getActiveChat: () => activeChat,
    init: bindEvents
  };
})();

window.ChatFloatWindow = ChatFloatWindow;

// تهيئة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    ChatFloatWindow.init();
    console.log('✅ ChatFloatWindow ready');
  }, 1000);
});