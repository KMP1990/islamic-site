/* ============================================
   Admin Analytics — v1.0
   تحليلات متقدمة للوحة المطور
   ============================================
   ✅ إحصائيات حية
   ✅ رسوم بيانية
   ✅ Top Lists (أكثر المستخدمين، المحتوى)
   ✅ فترات زمنية (يوم/أسبوع/شهر)
   ============================================ */

const AdminAnalytics = (() => {
  'use strict';

  let state = {
    range: '7d',       // 24h | 7d | 30d | all
    data: null,
    loading: false
  };

  /* ============================================
     تحميل كل البيانات
     ============================================ */
  async function loadData() {
    if (state.loading) return;

    state.loading = true;
    renderLoading();

    try {
      const [users, news, ads, chats, messages, notifications] = await Promise.all([
        window.firebaseHelpers.fbGetCollection('users').catch(() => []),
        window.firebaseHelpers.fbGetCollection('news').catch(() => []),
        window.firebaseHelpers.fbGetCollection('ads').catch(() => []),
        window.firebaseHelpers.fbGetCollection('chats').catch(() => []),
        window.firebaseHelpers.fbGetCollection('chatMessages').catch(() => []),
        window.firebaseHelpers.fbGetCollection('notifications').catch(() => [])
      ]);

      state.data = {
        users, news, ads, chats, messages, notifications
      };

      render();
    } catch (err) {
      console.error('[Analytics] Load failed:', err);
      renderError(err.message);
    } finally {
      state.loading = false;
    }
  }

  /* ============================================
     الفترة الزمنية
     ============================================ */
  function getRangeMs() {
    switch (state.range) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      case 'all': return Infinity;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  function filterByRange(items, dateField = 'createdAt') {
    const ms = getRangeMs();
    if (ms === Infinity) return items;

    const cutoff = Date.now() - ms;
    return items.filter(item => {
      const date = item[dateField];
      if (!date) return false;
      const ts = typeof date === 'object' && date.toMillis
        ? date.toMillis()
        : new Date(date).getTime();
      return ts >= cutoff;
    });
  }

  function setRange(range) {
    state.range = range;

    document.querySelectorAll('.admin-range-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === range);
    });

    render();
  }

  /* ============================================
     الحسابات
     ============================================ */
  function calculateStats() {
    if (!state.data) return null;

    const { users, news, ads, chats, messages } = state.data;

    // مستخدمون
    const now = Date.now();
    const usersLast24h = users.filter(u => {
      if (!u.lastLogin) return false;
      return (now - new Date(u.lastLogin).getTime()) < 24 * 60 * 60 * 1000;
    }).length;

    const usersLast7d = users.filter(u => {
      if (!u.lastLogin) return false;
      return (now - new Date(u.lastLogin).getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    const newUsers = users.filter(u => {
      if (!u.createdAt) return false;
      return (now - new Date(u.createdAt).getTime()) < getRangeMs();
    }).length;

    const activeUsers = users.filter(u => !u.disabled && !u.banned).length;
    const bannedUsers = users.filter(u => u.banned).length;
    const disabledUsers = users.filter(u => u.disabled).length;

    // رسائل
    const messagesInRange = filterByRange(messages);

    // إعلانات
    const adsActive = ads.filter(a => a.active !== false).length;
    const adsImpressions = ads.reduce((sum, a) => sum + Number(a.impressions || 0), 0);
    const adsClicks = ads.reduce((sum, a) => sum + Number(a.clicks || 0), 0);
    const adsCtr = adsImpressions > 0 ? ((adsClicks / adsImpressions) * 100).toFixed(2) : '0.00';

    // أخبار
    const newsActive = news.filter(n => n.active !== false).length;

    return {
      users: {
        total: users.length,
        active: activeUsers,
        banned: bannedUsers,
        disabled: disabledUsers,
        newInRange: newUsers,
        last24h: usersLast24h,
        last7d: usersLast7d
      },
      content: {
        news: news.length,
        newsActive,
        ads: ads.length,
        adsActive,
        adsImpressions,
        adsClicks,
        adsCtr
      },
      engagement: {
        chats: chats.length,
        messages: messages.length,
        messagesInRange: messagesInRange.length
      }
    };
  }

  /* ============================================
     بيانات الرسم البياني
     ============================================ */
  function getChartData() {
    if (!state.data) return [];

    const { users, messages } = state.data;
    const days = state.range === '24h' ? 24
      : state.range === '7d' ? 7
      : state.range === '30d' ? 30
      : 30;

    // تجميع
    const buckets = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      if (state.range === '24h') {
        date.setHours(date.getHours() - i);
      } else {
        date.setDate(date.getDate() - i);
      }

      const startOfBucket = new Date(date);
      if (state.range === '24h') {
        startOfBucket.setMinutes(0, 0, 0);
      } else {
        startOfBucket.setHours(0, 0, 0, 0);
      }

      const endOfBucket = new Date(startOfBucket);
      if (state.range === '24h') {
        endOfBucket.setHours(endOfBucket.getHours() + 1);
      } else {
        endOfBucket.setDate(endOfBucket.getDate() + 1);
      }

      const countUsers = users.filter(u => {
        if (!u.lastLogin) return false;
        const t = new Date(u.lastLogin).getTime();
        return t >= startOfBucket.getTime() && t < endOfBucket.getTime();
      }).length;

      const countMessages = messages.filter(m => {
        if (!m.createdAt) return false;
        const t = new Date(m.createdAt).getTime();
        return t >= startOfBucket.getTime() && t < endOfBucket.getTime();
      }).length;

      const label = state.range === '24h'
        ? String(startOfBucket.getHours()).padStart(2, '0') + ':00'
        : ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][startOfBucket.getDay()];

      buckets.push({
        label,
        users: countUsers,
        messages: countMessages,
        total: countUsers + countMessages
      });
    }

    return buckets;
  }

  /* ============================================
     Top Lists
     ============================================ */
  function getTopUsers() {
    if (!state.data) return [];

    return [...state.data.users]
      .filter(u => !u.banned && !u.disabled)
      .sort((a, b) => {
        // ترتيب حسب: النشاط الحديث
        const aT = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bT = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bT - aT;
      })
      .slice(0, 5)
      .map(u => ({
        name: u.fullName || u.username || 'مستخدم',
        meta: u.email || `@${u.username || 'بدون'}`,
        value: u.lastLogin ? formatTimeAgo(u.lastLogin) : 'لم يدخل',
        avatar: u.avatar
      }));
  }

  function getTopAds() {
    if (!state.data) return [];

    return [...state.data.ads]
      .sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0))
      .slice(0, 5)
      .map(ad => ({
        name: ad.title || 'إعلان',
        meta: `${Number(ad.clicks || 0)} نقرة · ${Number(ad.impressions || 0)} مشاهدة`,
        value: `${ad.impressions || 0}`,
        rank: true
      }));
  }

  function getTopSections() {
    if (!state.data) return [];

    // إحصائيات عامة
    const { chats, messages } = state.data;

    return [
      { name: 'المحادثات', meta: `${chats.length} محادثة`, value: chats.length, icon: '💬' },
      { name: 'الرسائل', meta: `${messages.length} رسالة`, value: messages.length, icon: '📨' },
      { name: 'الأخبار', meta: 'آخر التحديثات', value: state.data.news.length, icon: '📰' },
      { name: 'الإعلانات', meta: 'الحملات النشطة', value: state.data.ads.length, icon: '💰' }
    ].sort((a, b) => b.value - a.value);
  }

  /* ============================================
     العرض
     ============================================ */
  function renderLoading() {
    const container = document.getElementById('adminAnalyticsContent');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-users-loading">
        <div class="admin-users-spinner"></div>
        <div>جارٍ تحميل الإحصائيات...</div>
      </div>
    `;
  }

  function renderError(message) {
    const container = document.getElementById('adminAnalyticsContent');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-users-empty">
        <div class="admin-users-empty-icon">⚠️</div>
        <div>تعذر التحميل: ${escapeHtml(message)}</div>
      </div>
    `;
  }

  function render() {
    const container = document.getElementById('adminAnalyticsContent');
    if (!container) return;

    const stats = calculateStats();
    if (!stats) return;

    const chartData = getChartData();
    const topUsers = getTopUsers();
    const topAds = getTopAds();
    const topSections = getTopSections();

    container.innerHTML = `
      <!-- بطاقات الإحصائيات -->
      <div class="admin-analytics-stats">
        ${renderStatCard('👥', 'المستخدمون', stats.users.total, `${stats.users.active} نشط`, 'users')}
        ${renderStatCard('🆕', 'جدد', stats.users.newInRange, 'خلال الفترة', 'new')}
        ${renderStatCard('🟢', 'آخر 24 ساعة', stats.users.last24h, 'مستخدم نشط', 'active')}
        ${renderStatCard('🚫', 'المحظورون', stats.users.banned, `${stats.users.disabled} موقوف`, 'banned')}
      </div>

      <!-- الرسم البياني -->
      <div class="admin-chart-section">
        <div class="admin-chart-title">
          <h3>📈 النشاط خلال الفترة</h3>
        </div>
        <div class="admin-chart-canvas">
          <div class="admin-bar-chart">
            ${renderBarChart(chartData)}
          </div>
        </div>
      </div>

      <!-- Top Lists -->
      <div class="admin-top-grid">
        <div class="admin-top-card">
          <div class="admin-top-title">🏆 أكثر المستخدمين نشاطاً</div>
          <div class="admin-top-list">
            ${topUsers.length ? topUsers.map((u, i) => renderTopItem(u, i)).join('') : '<div class="admin-top-meta" style="text-align:center;padding:20px;">لا توجد بيانات</div>'}
          </div>
        </div>

        <div class="admin-top-card">
          <div class="admin-top-title">💰 أكثر الإعلانات مشاهدة</div>
          <div class="admin-top-list">
            ${topAds.length ? topAds.map((a, i) => renderTopItem(a, i)).join('') : '<div class="admin-top-meta" style="text-align:center;padding:20px;">لا توجد بيانات</div>'}
          </div>
        </div>

        <div class="admin-top-card">
          <div class="admin-top-title">📊 الأقسام الأكثر استخداماً</div>
          <div class="admin-top-list">
            ${topSections.map((s, i) => `
              <div class="admin-top-item">
                <div class="admin-top-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</div>
                <div class="admin-top-info">
                  <div class="admin-top-name">${s.icon || ''} ${escapeHtml(s.name)}</div>
                  <div class="admin-top-meta">${escapeHtml(s.meta)}</div>
                </div>
                <div class="admin-top-value">${formatNumber(s.value)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderStatCard(icon, label, value, sub, type) {
    return `
      <div class="admin-stat-card-v2">
        <div class="admin-stat-header">
          <div class="admin-stat-icon-v2">${icon}</div>
        </div>
        <div class="admin-stat-value-v2">${formatNumber(value)}</div>
        <div class="admin-stat-label-v2">${escapeHtml(label)}</div>
        <div class="admin-top-meta" style="margin-top:6px;">${escapeHtml(sub)}</div>
      </div>
    `;
  }

  function renderBarChart(data) {
    if (!data.length) return '<div class="admin-top-meta" style="text-align:center;padding:40px;color:rgba(245,241,232,0.4);">لا توجد بيانات</div>';

    const max = Math.max(...data.map(d => d.total), 1);

    return data.map(d => {
      const percent = (d.total / max) * 100;
      return `
        <div class="admin-bar-item">
          <div class="admin-bar-value">${d.total > 0 ? formatNumber(d.total) : ''}</div>
          <div class="admin-bar-wrapper">
            <div class="admin-bar-fill" style="height: ${Math.max(percent, 3)}%"></div>
          </div>
          <div class="admin-bar-label">${d.label}</div>
        </div>
      `;
    }).join('');
  }

  function renderTopItem(item, index) {
    return `
      <div class="admin-top-item">
        <div class="admin-top-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">${index + 1}</div>
        <div class="admin-top-info">
          <div class="admin-top-name">${escapeHtml(item.name)}</div>
          <div class="admin-top-meta">${escapeHtml(item.meta)}</div>
        </div>
        <div class="admin-top-value">${escapeHtml(String(item.value))}</div>
      </div>
    `;
  }

  /* ============================================
     أدوات
     ============================================ */
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n || 0);
  }

  function formatTimeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `قبل ${Math.floor(diff / 60000)} د`;
    if (diff < 86400000) return `قبل ${Math.floor(diff / 3600000)} س`;
    return `قبل ${Math.floor(diff / 86400000)} ي`;
  }

  /* ============================================
     عند فتح التبويب
     ============================================ */
  function onTabOpen() {
    loadData();
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    loadData,
    onTabOpen,
    setRange,
    calculateStats
  };
})();

window.AdminAnalytics = AdminAnalytics;
console.log('✅ AdminAnalytics v1.0 loaded');