/* ============================================
   Admin Tools — v1.1
   أدوات متقدمة للمطور
   ============================================
   ✅ Console لايف (تشغيل أوامر JS)
   ✅ Bulk Actions (إجراءات جماعية)
   ✅ Webhooks (ربط خارجي)
   ✅ System Info
   ============================================ */

const AdminTools = (() => {
  'use strict';

  let state = {
    consoleHistory: [],
    historyIndex: -1
  };

  /* ============================================
     ✅ Console — تشغيل الأوامر
     ============================================ */
  function runConsoleCommand() {
    const input = document.getElementById('adminConsoleInput');
    const output = document.getElementById('adminConsoleOutput');
    if (!input || !output) return;

    const command = input.value.trim();
    if (!command) return;

    // عرض الأمر
    appendConsoleLine(`> ${command}`, 'command');

    // حفظ في التاريخ
    if (state.consoleHistory[0] !== command) {
      state.consoleHistory.unshift(command);
      if (state.consoleHistory.length > 50) state.consoleHistory.pop();
    }
    state.historyIndex = -1;

    // تنفيذ
    try {
      let result;
      if (command.startsWith('await ')) {
        const expr = command.slice(6);
        result = eval(`(async () => { return await ${expr}; })()`);
        result.then(r => {
          appendConsoleLine(formatResult(r), 'result');
        }).catch(err => {
          appendConsoleLine(`❌ ${err.message}`, 'error');
        });
      } else {
        result = eval(command);
        appendConsoleLine(formatResult(result), 'result');
      }
    } catch (err) {
      appendConsoleLine(`❌ ${err.message}`, 'error');
    }

    input.value = '';
    output.scrollTop = output.scrollHeight;
  }

  function formatResult(result) {
    if (result === undefined) return 'undefined';
    if (result === null) return 'null';

    try {
      if (typeof result === 'object') {
        return JSON.stringify(result, null, 2);
      }
      return String(result);
    } catch (e) {
      return '[Object]';
    }
  }

  function appendConsoleLine(text, type = 'info') {
    const output = document.getElementById('adminConsoleOutput');
    if (!output) return;

    const line = document.createElement('div');
    line.className = `admin-console-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
  }

  function clearConsole() {
    const output = document.getElementById('adminConsoleOutput');
    if (output) output.innerHTML = '';
    appendConsoleLine('✅ Console cleared', 'info');
  }

  function navigateHistory(direction) {
    const input = document.getElementById('adminConsoleInput');
    if (!input || !state.consoleHistory.length) return;

    if (direction === 'up') {
      state.historyIndex = Math.min(state.historyIndex + 1, state.consoleHistory.length - 1);
    } else {
      state.historyIndex = Math.max(state.historyIndex - 1, -1);
    }

    input.value = state.historyIndex >= 0 ? state.consoleHistory[state.historyIndex] : '';
  }

  /* ============================================
     ✅ Bulk Actions
     ============================================ */
  let selectedUsers = new Set();

  function toggleBulkSelect(uid) {
    if (selectedUsers.has(uid)) {
      selectedUsers.delete(uid);
    } else {
      selectedUsers.add(uid);
    }
    updateBulkBar();
  }

  function selectAllBulk() {
    if (!window.AdminUsers) return;

    const state = window.AdminUsers.getState?.() || {};
    const users = state.filteredUsers || [];

    if (selectedUsers.size === users.length) {
      selectedUsers.clear();
    } else {
      selectedUsers.clear();
      users.forEach(u => selectedUsers.add(u.uid));
    }

    updateBulkBar();
    refreshUserCheckboxes();
  }

  function clearBulkSelection() {
    selectedUsers.clear();
    updateBulkBar();
    refreshUserCheckboxes();
  }

  function updateBulkBar() {
    let bar = document.getElementById('adminBulkBar');

    if (!selectedUsers.size) {
      if (bar) bar.remove();
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'adminBulkBar';
      bar.className = 'admin-bulk-bar';

      const grid = document.getElementById('adminUsersGrid');
      if (grid && grid.parentNode) {
        grid.parentNode.insertBefore(bar, grid);
      }
    }

    bar.innerHTML = `
      <div class="admin-bulk-info">✅ ${selectedUsers.size} محدد</div>
      <div class="admin-bulk-actions">
        <button class="admin-bulk-btn" onclick="AdminTools.bulkNotify()">📢 إشعار</button>
        <button class="admin-bulk-btn" onclick="AdminTools.bulkDisable()">⛔ إيقاف</button>
        <button class="admin-bulk-btn" onclick="AdminTools.bulkEnable()">✅ تفعيل</button>
        <button class="admin-bulk-btn" onclick="AdminTools.clearBulkSelection()">✕ إلغاء</button>
      </div>
    `;
  }

  function refreshUserCheckboxes() {
    document.querySelectorAll('.admin-user-card').forEach(card => {
      const checkbox = card.querySelector('.admin-user-checkbox');
      const uid = card.dataset.uid;
      if (checkbox && uid) {
        checkbox.checked = selectedUsers.has(uid);
      }
    });
  }

  async function bulkNotify() {
    if (!selectedUsers.size) return;

    const title = prompt('عنوان الإشعار:');
    if (!title) return;

    const body = prompt('نص الإشعار:');
    if (!body) return;

    if (!confirm(`إرسال إشعار لـ ${selectedUsers.size} مستخدم؟`)) return;

    let success = 0;
    let failed = 0;

    for (const uid of selectedUsers) {
      try {
        await sendBulkNotification(uid, { title, body, type: 'bulk' });
        success++;
      } catch (e) {
        failed++;
      }
    }

    if (typeof showToast === 'function') {
      showToast(`✅ نجح: ${success} · فشل: ${failed}`);
    }
    clearBulkSelection();
  }

  async function bulkDisable() {
    if (!selectedUsers.size) return;
    if (!confirm(`إيقاف ${selectedUsers.size} مستخدم؟`)) return;

    let success = 0;

    for (const uid of selectedUsers) {
      try {
        await window.firebaseHelpers.fbSetDoc('users', uid, { disabled: true });
        if (window.AdminAuditLog?.logAction) {
          await window.AdminAuditLog.logAction('bulk_disable', uid, {});
        }
        success++;
      } catch (e) {}
    }

    if (typeof showToast === 'function') showToast(`⛔ تم إيقاف ${success}`);
    clearBulkSelection();
    window.AdminUsers?.refresh();
  }

  async function bulkEnable() {
    if (!selectedUsers.size) return;
    if (!confirm(`تفعيل ${selectedUsers.size} مستخدم؟`)) return;

    let success = 0;

    for (const uid of selectedUsers) {
      try {
        await window.firebaseHelpers.fbSetDoc('users', uid, { disabled: false });
        if (window.AdminAuditLog?.logAction) {
          await window.AdminAuditLog.logAction('bulk_enable', uid, {});
        }
        success++;
      } catch (e) {}
    }

    if (typeof showToast === 'function') showToast(`✅ تم تفعيل ${success}`);
    clearBulkSelection();
    window.AdminUsers?.refresh();
  }

  async function sendBulkNotification(uid, data) {
    if (!window.firebaseHelpers) return;

    const notifId = 'bulk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    await window.firebaseHelpers.fbSetDoc('notifications', notifId, {
      id: notifId,
      toUid: uid,
      fromUid: 'admin',
      fromName: 'الإدارة',
      type: data.type || 'admin',
      title: data.title,
      body: data.body,
      read: false,
      isAdmin: true,
      createdAt: new Date().toISOString()
    });

    if (window.notificationSystem?.sendPush) {
      await window.notificationSystem.sendPush(uid, {
        type: data.type || 'admin',
        title: data.title,
        body: data.body,
        fromName: 'الإدارة'
      }).catch(() => {});
    }
  }

  /* ============================================
     ✅ Webhooks
     ============================================ */
  const WEBHOOKS_KEY = 'tariq_webhooks';

  function getWebhooks() {
    try {
      return JSON.parse(localStorage.getItem(WEBHOOKS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveWebhooks(hooks) {
    localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(hooks));
  }

  function addWebhook() {
    const name = prompt('اسم الـ Webhook:');
    if (!name) return;

    const url = prompt('الرابط (HTTPS):');
    if (!url) return;

    if (!/^https?:\/\//.test(url)) {
      alert('الرابط يجب أن يبدأ بـ http:// أو https://');
      return;
    }

    const event = prompt(
      'اختر الحدث:\n\n1. مستخدم جديد\n2. رسالة جديدة\n3. حظر مستخدم\n4. خبر جديد\n\nاكتب الرقم:',
      '1'
    );
    const events = ['new_user', 'new_message', 'ban_user', 'new_post'];
    const eventKey = events[parseInt(event) - 1] || 'new_user';

    const hooks = getWebhooks();
    hooks.push({
      id: 'wh_' + Date.now(),
      name,
      url,
      event: eventKey,
      active: true,
      createdAt: new Date().toISOString()
    });

    saveWebhooks(hooks);
    renderWebhooks();
    if (typeof showToast === 'function') showToast('✅ تم الإضافة');
  }

  function toggleWebhook(id) {
    const hooks = getWebhooks();
    const hook = hooks.find(h => h.id === id);
    if (hook) {
      hook.active = !hook.active;
      saveWebhooks(hooks);
      renderWebhooks();
    }
  }

  function deleteWebhook(id) {
    if (!confirm('حذف الـ Webhook؟')) return;
    const hooks = getWebhooks().filter(h => h.id !== id);
    saveWebhooks(hooks);
    renderWebhooks();
  }

  async function testWebhook(id) {
    const hooks = getWebhooks();
    const hook = hooks.find(h => h.id === id);
    if (!hook) return;

    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          source: 'tariq-alhuda'
        })
      });

      if (response.ok) {
        if (typeof showToast === 'function') showToast('✅ الـ Webhook يعمل');
      } else {
        if (typeof showToast === 'function') showToast(`⚠️ HTTP ${response.status}`);
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('❌ تعذر الاتصال');
    }
  }

  async function triggerWebhooks(event, data = {}) {
    const hooks = getWebhooks().filter(h => h.active && h.event === event);

    await Promise.all(
      hooks.map(hook =>
        fetch(hook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
            source: 'tariq-alhuda'
          })
        }).catch(() => null)
      )
    );
  }

  /* ============================================
     ✅ renderWebhooks — النسخة المصححة
     ============================================ */
  function renderWebhooks() {
    const container = document.getElementById('adminWebhooksContent');
    if (!container) {
      console.warn('[AdminTools] adminWebhooksContent not found');
      return;
    }

    console.log('[AdminTools] Rendering webhooks...');

    const hooks = getWebhooks();
    console.log('[AdminTools] Total hooks:', hooks.length);

    // ✅ استبدال المحتوى فوراً (حتى لو فارغ)
    if (!hooks.length) {
      container.innerHTML = `
        <div class="admin-users-empty" style="grid-column: 1 / -1;">
          <div class="admin-users-empty-icon">🔔</div>
          <div>لا توجد Webhooks بعد</div>
          <div style="font-size: 0.75rem; color: rgba(245, 241, 232, 0.5); margin-top: 8px;">
            اضغط "➕ إضافة Webhook" لإنشاء أول واحد
          </div>
        </div>
      `;
      console.log('✅ Webhooks UI rendered (empty state)');
      return;
    }

    container.innerHTML = `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 14px;">
        <button class="admin-action-btn" onclick="AdminTools.addWebhook()">➕ إضافة</button>
      </div>
      ${hooks.map(hook => `
        <div class="admin-webhook-row">
          <div class="admin-webhook-icon">${hook.active ? '🟢' : '🔴'}</div>
          <div class="admin-webhook-info">
            <div class="admin-webhook-name">${escapeHtml(hook.name)}</div>
            <div class="admin-webhook-url">${escapeHtml(hook.url)}</div>
            <div class="admin-top-meta" style="margin-top: 4px;">📌 ${hook.event}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="admin-action-btn" onclick="AdminTools.testWebhook('${hook.id}')" title="اختبار">🧪</button>
            <button class="admin-action-btn ${hook.active ? 'warning' : 'success'}" onclick="AdminTools.toggleWebhook('${hook.id}')" title="${hook.active ? 'إيقاف' : 'تفعيل'}">
              ${hook.active ? '⏸️' : '▶️'}
            </button>
            <button class="admin-action-btn danger" onclick="AdminTools.deleteWebhook('${hook.id}')" title="حذف">🗑️</button>
          </div>
        </div>
      `).join('')}
    `;

    console.log('✅ Webhooks UI rendered with', hooks.length, 'items');
  }

  /* ============================================
     ✅ System Info
     ============================================ */
  function getSystemInfo() {
    const user = window.authApi?.getCurrentUser?.();
    const memory = performance.memory;

    return {
      user: {
        uid: user?.uid,
        name: user?.fullName,
        email: user?.email
      },
      browser: {
        ua: navigator.userAgent.slice(0, 80),
        language: navigator.language,
        platform: navigator.platform,
        online: navigator.onLine
      },
      device: {
        screen: `${screen.width}x${screen.height}`,
        pixelRatio: window.devicePixelRatio,
        cores: navigator.hardwareConcurrency,
        memory: memory ? `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB` : 'N/A'
      },
      app: {
        version: 'v7.3',
        modules: {
          notifications: typeof window.notificationSystem,
          presence: typeof window.PresenceSystem,
          chat: typeof window.ChatFloatWindow,
          admin: typeof window.AdminUsers
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /* ============================================
     ✅ عند فتح تبويب الأدوات
     ============================================ */
  function onToolsOpen() {
    console.log('🧪 Opening Tools tab');

    setTimeout(() => {
      const input = document.getElementById('adminConsoleInput');
      if (input && !input._bound) {
        input._bound = true;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            runConsoleCommand();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateHistory('up');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateHistory('down');
          }
        });
      }
    }, 100);

    // ✅ عرض Webhooks إذا كانت الحاوية موجودة
    renderWebhooks();
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
     التصدير
     ============================================ */
  return {
    runConsoleCommand,
    clearConsole,
    navigateHistory,
    toggleBulkSelect,
    selectAllBulk,
    clearBulkSelection,
    bulkNotify,
    bulkDisable,
    bulkEnable,
    addWebhook,
    toggleWebhook,
    deleteWebhook,
    testWebhook,
    triggerWebhooks,
    renderWebhooks,
    getSystemInfo,
    onToolsOpen,
    getSelectedUsers: () => [...selectedUsers],
    getWebhooks
  };
})();

window.AdminTools = AdminTools;
console.log('✅ AdminTools v1.1 loaded');