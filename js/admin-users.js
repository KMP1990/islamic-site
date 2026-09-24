/* ============================================
   Admin Users System — v1.0
   نظام إدارة المستخدمين الاحترافي
   ============================================
   ✅ بحث ذكي (يوزر / إيميل / اسم / UID)
   ✅ Modal تفاصيل كاملة
   ✅ إيقاف / حظر / فك حظر
   ✅ إعادة كلمة السر
   ✅ إرسال إشعارات فردية/جماعية
   ✅ إرسال تحذيرات
   ✅ إحصائيات المستخدم
   ✅ حذف الحساب
   ✅ سجل الإجراءات
   ============================================ */

const AdminUsers = (() => {
  'use strict';

  /* ============================================
     الحالة
     ============================================ */
  let state = {
    users: [],
    filteredUsers: [],
    currentUser: null,       // المستخدم المفتوح في Modal
    searchQuery: '',
    statusFilter: 'all',
    sortFilter: 'recent',
    loading: false,
    searchTimeout: null,
    unsubscribeUsers: null
  };

  const USERS_COLLECTION = 'users';
  const ADMIN_LOGS_COLLECTION = 'adminLogs';
  const ADMIN_MESSAGES_COLLECTION = 'adminMessages';
  const NOTIFICATIONS_COLLECTION = 'notifications';

  /* ============================================
     تحميل المستخدمين
     ============================================ */
  async function loadUsers() {
    if (state.loading) return;

    state.loading = true;
    renderLoading();

    try {
      if (!window.firebaseHelpers) {
        throw new Error('Firebase غير محمّل');
      }

      const users = await window.firebaseHelpers.fbGetCollection(USERS_COLLECTION);

      // ✅ دمج حالة الاتصال
      const statuses = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');

      state.users = users.map(u => ({
        ...u,
        _status: statuses[u.uid]?.status || 'offline',
        _lastSeen: statuses[u.uid]?.lastSeen || u.lastLogin || null
      }));

      console.log(`✅ Loaded ${state.users.length} users`);
      applyFilters();
    } catch (err) {
      console.error('[AdminUsers] Load failed:', err);
      renderError(err.message);
    } finally {
      state.loading = false;
    }
  }

  /* ============================================
     ✅ الاستماع الحيّ للمستخدمين
     ============================================ */
  function listenToUsers() {
    if (state.unsubscribeUsers) {
      try { state.unsubscribeUsers(); } catch (e) {}
    }

    if (!window.firebaseHelpers) return;

    try {
      state.unsubscribeUsers = window.firebaseHelpers.fbListenCollection(
        USERS_COLLECTION,
        (users) => {
          const statuses = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');

          state.users = users.map(u => ({
            ...u,
            _status: statuses[u.uid]?.status || 'offline',
            _lastSeen: statuses[u.uid]?.lastSeen || u.lastLogin || null
          }));

          applyFilters();
        }
      );
    } catch (e) {
      console.warn('[AdminUsers] Listen failed:', e);
    }
  }

  /* ============================================
     ✅ البحث الذكي (Debounced)
     ============================================ */
  function debouncedSearch(query) {
    state.searchQuery = String(query || '').trim().toLowerCase();

    if (state.searchTimeout) clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => {
      applyFilters();
    }, 300);
  }

  /* ============================================
     ✅ الفلاتر والترتيب
     ============================================ */
  function applyFilters() {
    state.statusFilter = document.getElementById('adminUsersStatusFilter')?.value || 'all';
    state.sortFilter = document.getElementById('adminUsersSortFilter')?.value || 'recent';

    let filtered = [...state.users];

    // 1. بحث
    if (state.searchQuery) {
      const q = state.searchQuery;
      filtered = filtered.filter(u => {
        return (u.username || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q)
          || (u.fullName || '').toLowerCase().includes(q)
          || (u.uid || '').toLowerCase().includes(q);
      });
    }

    // 2. فلتر الحالة
    const now = Date.now();
    switch (state.statusFilter) {
      case 'active':
        filtered = filtered.filter(u => !u.disabled && !u.banned);
        break;
      case 'disabled':
        filtered = filtered.filter(u => u.disabled);
        break;
      case 'banned':
        filtered = filtered.filter(u => u.banned);
        break;
      case 'online':
        filtered = filtered.filter(u => u._status === 'online');
        break;
      case 'recent':
        filtered = filtered.filter(u => {
          if (!u._lastSeen) return false;
          return (now - new Date(u._lastSeen).getTime()) < 24 * 60 * 60 * 1000;
        });
        break;
    }

    // 3. الترتيب
    switch (state.sortFilter) {
      case 'recent':
        filtered.sort((a, b) => {
          const aT = a._lastSeen ? new Date(a._lastSeen).getTime() : 0;
          const bT = b._lastSeen ? new Date(b._lastSeen).getTime() : 0;
          return bT - aT;
        });
        break;
      case 'created':
        filtered.sort((a, b) => {
          const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bT - aT;
        });
        break;
      case 'name':
        filtered.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));
        break;
      case 'username':
        filtered.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        break;
    }

    state.filteredUsers = filtered;

    // تحديث العدّاد
    const countEl = document.getElementById('adminUsersCount');
    if (countEl) {
      countEl.textContent = `${filtered.length} / ${state.users.length} مستخدم`;
    }

    renderUsers();
  }

  /* ============================================
     عرض المستخدمين
     ============================================ */
  function renderUsers() {
    const grid = document.getElementById('adminUsersGrid');
    if (!grid) return;

    if (state.loading) {
      renderLoading();
      return;
    }

    if (!state.filteredUsers.length) {
      grid.innerHTML = `
        <div class="admin-users-empty">
          <div class="admin-users-empty-icon">🔍</div>
          <div>${state.users.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد مستخدمون بعد'}</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = state.filteredUsers.map(user => renderUserCard(user)).join('');
  }

  function renderUserCard(user) {
    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    // الشارات
    const badges = [];
    if (user.banned) {
      badges.push('<span class="admin-badge banned">🚫 محظور</span>');
    } else if (user.disabled) {
      badges.push('<span class="admin-badge disabled">⛔ موقوف</span>');
    } else {
      badges.push('<span class="admin-badge active">✅ نشط</span>');
    }

    if (user.role === 'developer' || user.uid === getDeveloperUid()) {
      badges.push('<span class="admin-badge developer">👨‍💻 مطور</span>');
    }

    if (user.verified) {
      badges.push('<span class="admin-badge verified">✓ موثّق</span>');
    }

    // حالة الاتصال
    const statusText = user._status === 'online' ? '🟢 متصل الآن'
      : user._status === 'away' ? '🟡 بعيد'
      : user._lastSeen ? `🕐 ${formatTimeAgo(user._lastSeen)}`
      : '⚫ لم يدخل بعد';

    const cardClass = [
      'admin-user-card',
      user.banned ? 'banned' : '',
      user.disabled ? 'disabled' : '',
      user._status === 'online' ? 'online' : ''
    ].filter(Boolean).join(' ');

    return `
            <div class="${cardClass}" data-uid="${user.uid}" onclick="AdminUsers.openUser('${user.uid}')">
        <div class="admin-user-header">
          <input
            type="checkbox"
            class="admin-user-checkbox"
            onclick="event.stopPropagation(); AdminTools.toggleBulkSelect('${user.uid}');"
            style="margin-inline-end: 8px;"
          />
          <div class="admin-user-avatar">
            ${avatar}
            <span class="admin-user-status-dot ${user._status}"></span>
          </div>
          <div class="admin-user-info">
            <div class="admin-user-name">${escapeHtml(user.fullName || user.username || 'مستخدم')}</div>
            <div class="admin-user-username">@${escapeHtml(user.username || 'بدون يوزر')}</div>
          </div>
        </div>

        <div class="admin-user-badges">
          ${badges.join('')}
        </div>

        <div class="admin-user-preview">
          <div class="admin-user-preview-row">
            <span class="admin-user-preview-label">📧 البريد:</span>
            <span class="admin-user-preview-value">${escapeHtml(user.email || '—')}</span>
          </div>
          <div class="admin-user-preview-row">
            <span class="admin-user-preview-label">🕐 آخر نشاط:</span>
            <span class="admin-user-preview-value">${statusText}</span>
          </div>
        </div>

        <div class="admin-user-actions" onclick="event.stopPropagation()">
          <button class="admin-action-btn" onclick="AdminUsers.openUser('${user.uid}')" title="عرض التفاصيل">
            👁️ عرض
          </button>
          <button class="admin-action-btn ${user.banned ? 'success' : 'warning'}" 
                  onclick="AdminUsers.toggleBan('${user.uid}')"
                  title="${user.banned ? 'فك الحظر' : 'حظر'}">
            ${user.banned ? '✅ فك' : '🚫 حظر'}
          </button>
          <button class="admin-action-btn danger"
                  onclick="AdminUsers.quickNotify('${user.uid}')"
                  title="إرسال إشعار">
            📢
          </button>
        </div>
      </div>
    `;
  }

  function renderLoading() {
    const grid = document.getElementById('adminUsersGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="admin-users-loading">
        <div class="admin-users-spinner"></div>
        <div>جارٍ التحميل...</div>
      </div>
    `;
  }

  function renderError(message) {
    const grid = document.getElementById('adminUsersGrid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="admin-users-empty">
        <div class="admin-users-empty-icon">⚠️</div>
        <div>تعذر التحميل: ${escapeHtml(message)}</div>
      </div>
    `;
  }

  /* ============================================
     ✅ فتح Modal المستخدم
     ============================================ */
  function openUser(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    state.currentUser = user;

    // إنشاء Modal إذا لم يكن موجوداً
    let modal = document.getElementById('adminUserModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminUserModal';
      modal.className = 'admin-user-modal';
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeUser();
      });
    }

    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    // حالة الاتصال
    const statusText = user._status === 'online' ? '🟢 متصل الآن'
      : user._status === 'away' ? '🟡 بعيد'
      : user._lastSeen ? `🕐 ${formatTimeAgo(user._lastSeen)}`
      : '⚫ لم يدخل بعد';

    // حالة الحساب
    let accountStatus;
    if (user.banned) accountStatus = '🚫 محظور';
    else if (user.disabled) accountStatus = '⛔ موقوف';
    else accountStatus = '✅ نشط';

    // زر الحظر
    const banBtn = user.banned
      ? `<button class="admin-modal-action success" onclick="AdminUsers.toggleBan('${user.uid}')">
           <span>✅</span><span>فك الحظر</span>
         </button>`
      : `<button class="admin-modal-action danger" onclick="AdminUsers.toggleBan('${user.uid}')">
           <span>🚫</span><span>حظر الحساب</span>
         </button>`;

    // زر الإيقاف
    const disableBtn = user.disabled
      ? `<button class="admin-modal-action success" onclick="AdminUsers.toggleDisable('${user.uid}')">
           <span>✅</span><span>تفعيل الحساب</span>
         </button>`
      : `<button class="admin-modal-action warning" onclick="AdminUsers.toggleDisable('${user.uid}')">
           <span>⛔</span><span>إيقاف مؤقت</span>
         </button>`;

    modal.innerHTML = `
      <div class="admin-user-modal-card">
        <div class="admin-modal-header">
          <div class="admin-modal-user-info">
            <div class="admin-modal-avatar">${avatar}</div>
            <div>
              <h3 class="admin-modal-name">${escapeHtml(user.fullName || user.username || 'مستخدم')}</h3>
              <p class="admin-modal-username">@${escapeHtml(user.username || 'بدون يوزر')}</p>
            </div>
          </div>
          <button class="admin-modal-close" onclick="AdminUsers.closeUser()">✕</button>
        </div>

        <!-- معلومات الحساب -->
        <div class="admin-modal-section">
          <div class="admin-modal-section-title">👤 معلومات الحساب</div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">UID</span>
            <span class="admin-modal-row-value ltr" style="font-family: monospace; font-size: 0.75rem;">${escapeHtml(user.uid)}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">📧 البريد</span>
            <span class="admin-modal-row-value ltr">${escapeHtml(user.email || '—')}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">🕐 آخر نشاط</span>
            <span class="admin-modal-row-value">${statusText}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">📅 تاريخ التسجيل</span>
            <span class="admin-modal-row-value">${user.createdAt ? formatDate(user.createdAt) : '—'}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">🎂 تاريخ الميلاد</span>
            <span class="admin-modal-row-value">${escapeHtml(user.birthDate || '—')}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">⚧ الجنس</span>
            <span class="admin-modal-row-value">${user.gender === 'female' ? 'أنثى' : user.gender === 'male' ? 'ذكر' : '—'}</span>
          </div>
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">📊 الحالة</span>
            <span class="admin-modal-row-value">${accountStatus}</span>
          </div>
          ${user.banReason ? `
          <div class="admin-modal-row">
            <span class="admin-modal-row-label">📝 سبب الحظر</span>
            <span class="admin-modal-row-value" style="color: #ff8a7a;">${escapeHtml(user.banReason)}</span>
          </div>` : ''}
        </div>

        <!-- الإجراءات الرئيسية -->
        <div class="admin-modal-section">
          <div class="admin-modal-section-title">⚡ الإجراءات</div>
          <div class="admin-modal-actions">
            <button class="admin-modal-action info" onclick="AdminUsers.sendPasswordReset('${user.uid}')">
              <span>🔑</span><span>إعادة كلمة السر</span>
            </button>
            <button class="admin-modal-action primary" onclick="AdminUsers.openNotifyModal('${user.uid}')">
              <span>📢</span><span>إرسال إشعار</span>
            </button>
            ${disableBtn}
            ${banBtn}
            <button class="admin-modal-action warning" onclick="AdminUsers.viewUserActivity('${user.uid}')">
              <span>📜</span><span>سجل النشاط</span>
            </button>
            <button class="admin-modal-action danger" onclick="AdminUsers.deleteUser('${user.uid}')">
              <span>🗑️</span><span>حذف الحساب</span>
            </button>
          </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

  function closeUser() {
    const modal = document.getElementById('adminUserModal');
    if (modal) modal.classList.remove('show');
    state.currentUser = null;
  }

  /* ============================================
     ✅ إيقاف / تفعيل الحساب
     ============================================ */
  async function toggleDisable(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    const newState = !user.disabled;
    const action = newState ? 'إيقاف' : 'تفعيل';

    if (!confirm(`${action} حساب ${user.fullName || user.username}؟`)) return;

    try {
      await window.firebaseHelpers.fbSetDoc(USERS_COLLECTION, uid, {
        disabled: newState,
        disabledAt: newState ? new Date().toISOString() : null
      });

      await logAdminAction('toggle_disable', uid, { disabled: newState });

      if (typeof showToast === 'function') {
        showToast(newState ? '⛔ تم الإيقاف' : '✅ تم التفعيل');
      }

      closeUser();
      refresh();
    } catch (err) {
      console.error('[AdminUsers] toggleDisable failed:', err);
      if (typeof showToast === 'function') showToast('تعذر التحديث');
    }
  }

  /* ============================================
     ✅ حظر / فك الحظر
     ============================================ */
  async function toggleBan(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    const newState = !user.banned;

    if (newState) {
      // ✅ حظر — اطلب السبب
      const reason = await promptBanReason(user);
      if (!reason) return;

      try {
        await window.firebaseHelpers.fbSetDoc(USERS_COLLECTION, uid, {
          banned: true,
          banReason: reason,
          bannedAt: new Date().toISOString()
        });

        // ✅ إرسال إشعار تحذيري
        await sendAdminNotification(uid, {
          type: 'warning',
          title: '🚫 تم حظر حسابك',
          body: `السبب: ${reason}\nتواصل مع الإدارة لمراجعة الحساب.`
        });

        await logAdminAction('ban', uid, { reason });

        if (typeof showToast === 'function') showToast('🚫 تم الحظر');
        closeUser();
        refresh();
      } catch (err) {
        console.error('[AdminUsers] ban failed:', err);
        if (typeof showToast === 'function') showToast('تعذر الحظر');
      }
    } else {
      // ✅ فك الحظر
      if (!confirm(`فك حظر ${user.fullName || user.username}؟`)) return;

      try {
        await window.firebaseHelpers.fbSetDoc(USERS_COLLECTION, uid, {
          banned: false,
          banReason: '',
          unbannedAt: new Date().toISOString()
        });

        await sendAdminNotification(uid, {
          type: 'success',
          title: '✅ تم فك الحظر عن حسابك',
          body: 'مرحباً بك مجدداً في طريق الهدى.'
        });

        await logAdminAction('unban', uid, {});

        if (typeof showToast === 'function') showToast('✅ تم فك الحظر');
        closeUser();
        refresh();
      } catch (err) {
        console.error('[AdminUsers] unban failed:', err);
        if (typeof showToast === 'function') showToast('تعذر فك الحظر');
      }
    }
  }

  function promptBanReason(user) {
    return new Promise((resolve) => {
      let modal = document.getElementById('adminConfirmModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'adminConfirmModal';
        modal.className = 'admin-confirm-modal';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="admin-confirm-card">
          <div class="admin-confirm-icon">🚫</div>
          <h3 class="admin-confirm-title">حظر الحساب</h3>
          <p class="admin-confirm-message">
            سيتم حظر <strong>${escapeHtml(user.fullName || user.username)}</strong> من استخدام التطبيق.
            <br>اكتب سبب الحظر (سيظهر للمستخدم):
          </p>
          <textarea id="adminBanReasonInput" class="admin-confirm-reason" placeholder="مثال: انتهاك قوانين الاستخدام..."></textarea>
          <div class="admin-confirm-actions">
            <button class="cancel" id="adminBanCancel">إلغاء</button>
            <button class="danger" id="adminBanConfirm">تأكيد الحظر</button>
          </div>
        </div>
      `;

      requestAnimationFrame(() => modal.classList.add('show'));

      const cleanup = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.innerHTML = ''; }, 300);
      };

      document.getElementById('adminBanCancel').onclick = () => {
        cleanup();
        resolve(null);
      };

      document.getElementById('adminBanConfirm').onclick = () => {
        const reason = document.getElementById('adminBanReasonInput').value.trim();
        if (!reason || reason.length < 3) {
          alert('اكتب سبب الحظر (3 أحرف على الأقل)');
          return;
        }
        cleanup();
        resolve(reason);
      };

      setTimeout(() => document.getElementById('adminBanReasonInput')?.focus(), 300);
    });
  }

  /* ============================================
     ✅ إعادة كلمة السر
     ============================================ */
  async function sendPasswordReset(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    if (!user.email) {
      if (typeof showToast === 'function') showToast('❌ لا يوجد بريد لهذا الحساب');
      return;
    }

    // ✅ إذا البريد وهمي (ينتهي بـ @tariq-alhuda.local)
    if (user.email.endsWith('@tariq-alhuda.local')) {
      if (typeof showToast === 'function') {
        showToast('❌ بريد وهمي — لا يمكن إرسال رابط');
      }
      return;
    }

    if (!confirm(`إرسال رابط إعادة كلمة السر إلى:\n${user.email}؟`)) return;

    try {
      await window.firebaseHelpers.fbSendPasswordReset(user.email);

      await logAdminAction('password_reset', uid, { email: user.email });

      if (typeof showToast === 'function') {
        showToast('✅ تم إرسال رابط إعادة التعيين');
      }

      // إشعار للمستخدم
      await sendAdminNotification(uid, {
        type: 'info',
        title: '🔑 إعادة تعيين كلمة السر',
        body: 'أُرسل إليك رابط إعادة تعيين كلمة السر على بريدك الإلكتروني.'
      });
    } catch (err) {
      console.error('[AdminUsers] reset failed:', err);
      if (typeof showToast === 'function') {
        const msg = err.code === 'auth/user-not-found'
          ? 'المستخدم غير موجود'
          : 'تعذر الإرسال';
        showToast('❌ ' + msg);
      }
    }
  }

  /* ============================================
     ✅ إرسال إشعار خاص
     ============================================ */
  function quickNotify(uid) {
    openNotifyModal(uid);
  }

  function openNotifyModal(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    let modal = document.getElementById('adminNotifyModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'adminNotifyModal';
      modal.className = 'admin-notify-modal';
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeNotifyModal();
      });
    }

    modal.dataset.targetUid = uid;

    modal.innerHTML = `
      <div class="admin-notify-card">
        <h3 class="admin-notify-title">📢 إرسال إشعار</h3>
        <p class="admin-notify-subtitle">إلى: ${escapeHtml(user.fullName || user.username)}</p>

        <div class="admin-notify-form">
          <label>نوع الإشعار</label>
          <div class="admin-notify-type-grid" id="adminNotifyTypeGrid">
            <button type="button" class="admin-notify-type-btn active" data-type="info" onclick="AdminUsers.selectNotifyType('info', this)">
              ℹ️ معلومة
            </button>
            <button type="button" class="admin-notify-type-btn" data-type="success" onclick="AdminUsers.selectNotifyType('success', this)">
              ✅ نجاح
            </button>
            <button type="button" class="admin-notify-type-btn" data-type="warning" onclick="AdminUsers.selectNotifyType('warning', this)">
              ⚠️ تحذير
            </button>
            <button type="button" class="admin-notify-type-btn" data-type="danger" onclick="AdminUsers.selectNotifyType('danger', this)">
              🚫 خطأ
            </button>
            <button type="button" class="admin-notify-type-btn" data-type="message" onclick="AdminUsers.selectNotifyType('message', this)">
              💬 رسالة
            </button>
            <button type="button" class="admin-notify-type-btn" data-type="announcement" onclick="AdminUsers.selectNotifyType('announcement', this)">
              📣 إعلان
            </button>
          </div>

          <label>العنوان</label>
          <input type="text" id="adminNotifyTitle" placeholder="عنوان الإشعار..." maxlength="80" />

          <label>النص</label>
          <textarea id="adminNotifyBody" placeholder="نص الإشعار..." maxlength="500"></textarea>

          <label>الإجراء (اختياري)</label>
          <select id="adminNotifyAction">
            <option value="">بدون إجراء</option>
            <option value="open_profile">فتح الملف الشخصي</option>
            <option value="open_chat">فتح المحادثات</option>
            <option value="open_home">الصفحة الرئيسية</option>
          </select>
        </div>

        <div class="admin-notify-actions">
          <button class="cancel" onclick="AdminUsers.closeNotifyModal()">إلغاء</button>
          <button class="send" id="adminNotifySendBtn" onclick="AdminUsers.sendNotify()">
            📤 إرسال
          </button>
        </div>
      </div>
    `;

    modal.dataset.notifyType = 'info';

    requestAnimationFrame(() => modal.classList.add('show'));
    setTimeout(() => document.getElementById('adminNotifyTitle')?.focus(), 300);
  }

  function closeNotifyModal() {
    const modal = document.getElementById('adminNotifyModal');
    if (modal) modal.classList.remove('show');
  }

  function selectNotifyType(type, btn) {
    const modal = document.getElementById('adminNotifyModal');
    if (modal) modal.dataset.notifyType = type;

    document.querySelectorAll('.admin-notify-type-btn').forEach(b => {
      b.classList.remove('active', 'warning', 'danger', 'success');
    });

    btn.classList.add('active');
    if (type === 'warning') btn.classList.add('warning');
    if (type === 'danger') btn.classList.add('danger');
    if (type === 'success') btn.classList.add('success');
  }

  async function sendNotify() {
    const modal = document.getElementById('adminNotifyModal');
    if (!modal) return;

    const uid = modal.dataset.targetUid;
    const type = modal.dataset.notifyType || 'info';
    const title = document.getElementById('adminNotifyTitle')?.value.trim();
    const body = document.getElementById('adminNotifyBody')?.value.trim();
    const action = document.getElementById('adminNotifyAction')?.value;

    if (!title || !body) {
      alert('املأ العنوان والنص');
      return;
    }

    const sendBtn = document.getElementById('adminNotifySendBtn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '⏳ جارٍ الإرسال...'; }

    try {
      await sendAdminNotification(uid, {
        type,
        title,
        body,
        link: action || null
      });

      await logAdminAction('send_notification', uid, { type, title });

      if (typeof showToast === 'function') showToast('✅ تم إرسال الإشعار');
      closeNotifyModal();
    } catch (err) {
      console.error('[AdminUsers] send notify failed:', err);
      if (typeof showToast === 'function') showToast('تعذر الإرسال');
    } finally {
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📤 إرسال'; }
    }
  }

  /* ============================================
     ✅ إرسال إشعار إداري (Firestore + Push)
     ============================================ */
  async function sendAdminNotification(uid, data) {
    try {
      const notifId = 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

      // 1. حفظ في Firestore
      await window.firebaseHelpers.fbSetDoc(NOTIFICATIONS_COLLECTION, notifId, {
        id: notifId,
        toUid: uid,
        fromUid: 'admin',
        fromName: 'الإدارة',
        type: data.type || 'admin',
        title: data.title,
        body: data.body,
        link: data.link || null,
        read: false,
        isAdmin: true,
        createdAt: new Date().toISOString()
      });

      // 2. Push (ntfy)
      if (window.notificationSystem?.sendPush) {
        await window.notificationSystem.sendPush(uid, {
          type: data.type || 'admin',
          title: data.title,
          body: data.body,
          fromName: 'الإدارة',
          link: data.link || null
        }).catch(() => {});
      }

      return true;
    } catch (err) {
      console.error('[AdminUsers] sendAdminNotification failed:', err);
      throw err;
    }
  }

  /* ============================================
     ✅ سجل النشاط
     ============================================ */
  async function viewUserActivity(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    try {
      const logs = await window.firebaseHelpers.fbGetCollection(ADMIN_LOGS_COLLECTION);
      const userLogs = logs
        .filter(l => l.targetUid === uid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (!userLogs.length) {
        alert(`لا توجد سجلات لهذا المستخدم`);
        return;
      }

      const text = userLogs.slice(0, 20).map(l => {
        const date = new Date(l.createdAt).toLocaleString('ar-IQ');
        return `[${date}]\n${l.action}\n${l.details ? JSON.stringify(l.details) : ''}`;
      }).join('\n\n---\n\n');

      alert(`📜 سجل نشاط ${user.fullName || user.username}\n\n${text}`);
    } catch (err) {
      console.error('[AdminUsers] view activity failed:', err);
      alert('تعذر تحميل السجل');
    }
  }

  /* ============================================
     ✅ حذف المستخدم
     ============================================ */
  async function deleteUser(uid) {
    const user = state.users.find(u => u.uid === uid);
    if (!user) return;

    if (!confirm(`🗑️ حذف حساب ${user.fullName || user.username}؟\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!`)) return;
    if (!confirm('تأكيد نهائي؟')) return;

    try {
      // حذف من Firestore
      await window.firebaseHelpers.fbDeleteDoc(USERS_COLLECTION, uid);

      await logAdminAction('delete_user', uid, {
        username: user.username,
        email: user.email
      });

      if (typeof showToast === 'function') showToast('🗑️ تم حذف الحساب');
      closeUser();
      refresh();
    } catch (err) {
      console.error('[AdminUsers] delete failed:', err);
      if (typeof showToast === 'function') showToast('تعذر الحذف');
    }
  }

  /* ============================================
     ✅ تسجيل إجراء المطور
     ============================================ */
  async function logAdminAction(action, targetUid, details = {}) {
    try {
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      await window.firebaseHelpers.fbSetDoc(ADMIN_LOGS_COLLECTION, logId, {
        id: logId,
        action,
        targetUid,
        details,
        adminUid: window.authApi?.getCurrentUser?.()?.uid || 'developer',
        adminName: window.authApi?.getCurrentUser?.()?.fullName || 'المطور',
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[AdminUsers] log failed:', e);
    }
  }

  /* ============================================
     ✅ التحديث
     ============================================ */
  function refresh() {
    loadUsers();
  }

  /* ============================================
     أدوات
     ============================================ */
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function formatTimeAgo(iso) {
    if (!iso) return 'لم يدخل بعد';
    const now = Date.now();
    const diff = now - new Date(iso).getTime();

    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `قبل ${Math.floor(diff / 60000)} دقيقة`;
    if (diff < 86400000) return `قبل ${Math.floor(diff / 3600000)} ساعة`;
    if (diff < 172800000) return 'أمس';
    if (diff < 604800000) return `قبل ${Math.floor(diff / 86400000)} أيام`;

    return new Date(iso).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit' });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-IQ', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch { return iso; }
  }

  function getDeveloperUid() {
    // يمكن تعديله لاحقاً
    return null;
  }

  /* ============================================
     عند فتح تبويب المستخدمين
     ============================================ */
  function onTabOpen() {
    loadUsers();
    listenToUsers();
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    loadUsers,
    refresh,
    debouncedSearch,
    applyFilters,
    openUser,
    closeUser,
    toggleDisable,
    toggleBan,
    sendPasswordReset,
    openNotifyModal,
    closeNotifyModal,
    selectNotifyType,
    sendNotify,
    quickNotify,
    viewUserActivity,
    deleteUser,
    onTabOpen,
    logAdminAction
  };
})();

window.AdminUsers = AdminUsers;
console.log('✅ AdminUsers v1.0 loaded');