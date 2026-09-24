/* ============================================
   Admin Audit Log — v1.0
   سجل كامل لنشاطات المطور والمستخدمين
   ============================================
   ✅ عرض آخر 200 إجراء
   ✅ فلترة حسب النوع والمطور
   ✅ بحث
   ✅ تفاصيل كل إجراء
   ✅ تصدير JSON
   ============================================ */

const AdminAuditLog = (() => {
  'use strict';

  const LOGS_COLLECTION = 'adminLogs';
  const MAX_LOGS = 200;

  let state = {
    logs: [],
    filteredLogs: [],
    loading: false,
    searchQuery: '',
    typeFilter: 'all',
    searchTimeout: null,
    unsubscribe: null
  };

  /* ============================================
     رموز الإجراءات
     ============================================ */
  const ACTION_META = {
    'ban': { icon: '🚫', label: 'حظر مستخدم', class: 'ban' },
    'unban': { icon: '✅', label: 'فك الحظر', class: 'unban' },
    'toggle_disable': { icon: '⛔', label: 'إيقاف/تفعيل حساب', class: 'update' },
    'delete_user': { icon: '🗑️', label: 'حذف مستخدم', class: 'delete' },
    'password_reset': { icon: '🔑', label: 'إعادة كلمة سر', class: 'update' },
    'send_notification': { icon: '📢', label: 'إرسال إشعار', class: 'create' },
    'create_news': { icon: '📰', label: 'نشر خبر', class: 'create' },
    'update_news': { icon: '✏️', label: 'تعديل خبر', class: 'update' },
    'delete_news': { icon: '🗑️', label: 'حذف خبر', class: 'delete' },
    'create_ad': { icon: '💰', label: 'إنشاء إعلان', class: 'create' },
    'update_ad': { icon: '✏️', label: 'تعديل إعلان', class: 'update' },
    'delete_ad': { icon: '🗑️', label: 'حذف إعلان', class: 'delete' },
    'update_settings': { icon: '⚙️', label: 'تحديث الإعدادات', class: 'update' },
    'toggle_feature': { icon: '🎛️', label: 'تفعيل/تعطيل ميزة', class: 'update' },
    'import_data': { icon: '📥', label: 'استيراد بيانات', class: 'create' },
    'export_data': { icon: '📤', label: 'تصدير بيانات', class: 'create' },
    'developer_unlock': { icon: '🔓', label: 'دخول المطور', class: 'create' },
    'clear_cache': { icon: '🧹', label: 'مسح الكاش', class: 'update' },
    'webhook_called': { icon: '🔔', label: 'Webhook', class: 'create' },
    'default': { icon: '📝', label: 'إجراء', class: 'update' }
  };

  /* ============================================
     تحميل السجل
     ============================================ */
  async function loadLogs() {
    if (state.loading) return;
    state.loading = true;
    renderLoading();

    try {
      if (!window.firebaseHelpers) throw new Error('Firebase غير محمّل');

      const logs = await window.firebaseHelpers.fbGetCollection(LOGS_COLLECTION);

      // ترتيب الأحدث أولاً
      state.logs = logs
        .sort((a, b) => {
          const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bT - aT;
        })
        .slice(0, MAX_LOGS);

      console.log(`✅ Loaded ${state.logs.length} logs`);
      applyFilters();
    } catch (err) {
      console.error('[AuditLog] Load failed:', err);
      renderError(err.message);
    } finally {
      state.loading = false;
    }
  }

  /* ============================================
     الاستماع الحي
     ============================================ */
  function listenToLogs() {
    if (state.unsubscribe) {
      try { state.unsubscribe(); } catch (e) {}
    }

    if (!window.firebaseHelpers) return;

    try {
      state.unsubscribe = window.firebaseHelpers.fbListenCollection(
        LOGS_COLLECTION,
        (logs) => {
          state.logs = logs
            .sort((a, b) => {
              const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bT - aT;
            })
            .slice(0, MAX_LOGS);

          applyFilters();
        }
      );
    } catch (e) {
      console.warn('[AuditLog] Listen failed:', e);
    }
  }

  /* ============================================
     البحث والفلترة
     ============================================ */
  function debouncedSearch(query) {
    state.searchQuery = String(query || '').trim().toLowerCase();

    if (state.searchTimeout) clearTimeout(state.searchTimeout);
    state.searchTimeout = setTimeout(() => applyFilters(), 300);
  }

  function applyFilters() {
    state.typeFilter = document.getElementById('adminAuditTypeFilter')?.value || 'all';

    let filtered = [...state.logs];

    // فلترة النوع
    if (state.typeFilter !== 'all') {
      filtered = filtered.filter(l => l.action === state.typeFilter);
    }

    // بحث
    if (state.searchQuery) {
      const q = state.searchQuery;
      filtered = filtered.filter(l => {
        return (l.adminName || '').toLowerCase().includes(q)
          || (l.action || '').toLowerCase().includes(q)
          || (l.targetUid || '').toLowerCase().includes(q)
          || JSON.stringify(l.details || {}).toLowerCase().includes(q);
      });
    }

    state.filteredLogs = filtered;
    render();
  }

  /* ============================================
     العرض
     ============================================ */
  function renderLoading() {
    const container = document.getElementById('adminAuditContent');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-users-loading">
        <div class="admin-users-spinner"></div>
        <div>جارٍ تحميل السجل...</div>
      </div>
    `;
  }

  function renderError(message) {
    const container = document.getElementById('adminAuditContent');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-users-empty">
        <div class="admin-users-empty-icon">⚠️</div>
        <div>تعذر التحميل: ${escapeHtml(message)}</div>
      </div>
    `;
  }

  function render() {
    const container = document.getElementById('adminAuditContent');
    if (!container) return;

    if (!state.filteredLogs.length) {
      container.innerHTML = `
        <div class="admin-users-empty">
          <div class="admin-users-empty-icon">📜</div>
          <div>${state.logs.length ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات بعد'}</div>
        </div>
      `;
      return;
    }

    // تحديث العدّاد
    const countEl = document.getElementById('adminAuditCount');
    if (countEl) countEl.textContent = `${state.filteredLogs.length} إجراء`;

    container.innerHTML = `
      <div class="admin-audit-timeline">
        ${state.filteredLogs.map((log, i) => renderLogItem(log, i)).join('')}
      </div>
    `;
  }

  function renderLogItem(log, index) {
    const meta = ACTION_META[log.action] || ACTION_META.default;
    const time = formatTimeAgo(log.createdAt);
    const fullDate = log.createdAt
      ? new Date(log.createdAt).toLocaleString('ar-IQ')
      : '';

    // تفاصيل
    let detailsText = '';
    if (log.details) {
      const parts = [];
      if (log.details.username) parts.push(`المستخدم: ${log.details.username}`);
      if (log.details.email) parts.push(`📧 ${log.details.email}`);
      if (log.details.reason) parts.push(`السبب: ${log.details.reason}`);
      if (log.details.title) parts.push(`العنوان: ${log.details.title}`);
      if (log.details.email && log.details.action) parts.push(log.details.action);

      detailsText = parts.join(' · ');
    }

    return `
      <div class="admin-audit-item" style="animation-delay: ${index * 0.02}s">
        <div class="admin-audit-icon ${meta.class}">${meta.icon}</div>
        <div class="admin-audit-content">
          <div class="admin-audit-title">${escapeHtml(meta.label)}</div>
          ${detailsText ? `<div class="admin-audit-details">${escapeHtml(detailsText)}</div>` : ''}
          <div class="admin-audit-meta">
            <span class="admin-audit-meta-item">👨‍💻 ${escapeHtml(log.adminName || 'المطور')}</span>
            <span class="admin-audit-meta-item">🕐 ${time}</span>
            ${log.targetUid ? `<span class="admin-audit-meta-item" style="font-family: monospace; font-size: 0.65rem;">${escapeHtml(String(log.targetUid).slice(0, 12))}...</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================
     تسجيل إجراء جديد
     ============================================ */
  async function logAction(action, targetUid = null, details = {}) {
    try {
      if (!window.firebaseHelpers) return false;

      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

      await window.firebaseHelpers.fbSetDoc(LOGS_COLLECTION, logId, {
        id: logId,
        action,
        targetUid,
        details,
        adminUid: window.authApi?.getCurrentUser?.()?.uid || 'developer',
        adminName: window.authApi?.getCurrentUser?.()?.fullName || 'المطور',
        createdAt: new Date().toISOString()
      });

      return true;
    } catch (e) {
      console.warn('[AuditLog] logAction failed:', e);
      return false;
    }
  }

  /* ============================================
     مسح السجل
     ============================================ */
  async function clearLogs() {
    if (!confirm('⚠️ حذف كل السجلات نهائياً؟')) return;
    if (!confirm('تأكيد نهائي؟')) return;

    try {
      const deleted = await Promise.all(
        state.logs.map(l => window.firebaseHelpers.fbDeleteDoc(LOGS_COLLECTION, l.id).catch(() => null))
      );

      if (typeof showToast === 'function') showToast('✅ تم مسح السجل');
      loadLogs();
    } catch (err) {
      console.error('[AuditLog] Clear failed:', err);
      if (typeof showToast === 'function') showToast('تعذر المسح');
    }
  }

  /* ============================================
     تصدير السجل
     ============================================ */
  function exportLogs() {
    if (!state.logs.length) {
      if (typeof showToast === 'function') showToast('لا توجد سجلات');
      return;
    }

    try {
      const data = JSON.stringify({
        exportedAt: new Date().toISOString(),
        total: state.logs.length,
        logs: state.logs
      }, null, 2);

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      if (typeof showToast === 'function') showToast('✅ تم التصدير');
    } catch (err) {
      console.error('[AuditLog] Export failed:', err);
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

  function formatTimeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `قبل ${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return `قبل ${Math.floor(diff / 3600000)} س`;
    if (diff < 604800000) return `قبل ${Math.floor(diff / 86400000)} ي`;
    return new Date(iso).toLocaleDateString('ar-IQ');
  }

  /* ============================================
     عند فتح التبويب
     ============================================ */
  function onTabOpen() {
    loadLogs();
    listenToLogs();
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    loadLogs,
    onTabOpen,
    applyFilters,
    debouncedSearch,
    logAction,
    clearLogs,
    exportLogs
  };
})();

window.AdminAuditLog = AdminAuditLog;
console.log('✅ AdminAuditLog v1.0 loaded');