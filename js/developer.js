/* ===== لوحة المطور — Firebase + Cloud Sync (v7.0) ===== */

const DEV_SETTINGS_KEY = 'tariq_dev_settings';
const DEV_DISMISSED_ADS_KEY = 'tariq_dismissed_ads_v1';
const DEV_ACTIVITY_KEY = 'tariq_dev_activity';
const DEV_LOCK_KEY = 'tariq_dev_lock';
const DEV_MESSAGES_KEY = 'tariq_dev_messages_v1';
const DEV_BANNED_DEVICES_KEY = 'tariq_banned_devices_v1';

let developerUnlocked = false;
let developerImageData = '';
let developerAdImageData = '';
let editingEventId = '';
let editingAdId = '';
let versionTapCount = 0;
let versionTapTimer = null;
let developerLastActive = 0;
let changingDeveloperPassword = false;
let homeNewsRefreshTimer = null;
let adObserver = null;

const viewedAds = new Set(getStoredJson('tariq_viewed_ads', [], sessionStorage));

const DEFAULT_DEV_SETTINGS = {
  maxHomeNews: 6,
  autoRefreshMinutes: 5,
  showActiveOnly: true,
  ayahMarkerMode: 'balanced',
  ayahTolerance: 1.2,
  enableDebugLogs: false,
  enableHomeNews: true,
  enableAds: true,
  enablePopupAds: true,
  interleaveAds: true,
  requireLogin: false,
  maintenanceMode: false,
  maintenanceMessage: 'الموقع تحت الصيانة مؤقتًا. نعود قريبًا إن شاء الله.',
  siteBannerEnabled: false,
  siteBanner: '',
  allowGuestStats: true,
  allowRegistration: true,
  maxAdsPerSlot: 2,
  popupOnce: true,
  performanceMode: 'balanced'
};

/* ===== أدوات ===== */
function developerEscape(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function getStoredJson(key, fallback, storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(key) || JSON.stringify(fallback)) ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

/* ===== الإعدادات ===== */
function getDeveloperSettings() {
  try {
    const raw = localStorage.getItem(DEV_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_DEV_SETTINGS };
    return { ...DEFAULT_DEV_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    return { ...DEFAULT_DEV_SETTINGS };
  }
}

function persistDeveloperSettings(settings) {
  localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify({ ...DEFAULT_DEV_SETTINGS, ...settings }));
}

/* ===== Firebase Helpers ===== */
async function getNewsFromFirebase() {
  if (!window.firebaseHelpers) return [];
  try {
    return await window.firebaseHelpers.fbGetCollection('news');
  } catch (err) {
    console.error('[Developer] Firestore news error:', err);
    return [];
  }
}

async function getAdsFromFirebase() {
  if (!window.firebaseHelpers) return [];
  try {
    return await window.firebaseHelpers.fbGetCollection('ads');
  } catch (err) {
    console.error('[Developer] Firestore ads error:', err);
    return [];
  }
}

async function getUsersFromFirebase() {
  if (!window.firebaseHelpers) return [];
  try {
    return await window.firebaseHelpers.fbGetCollection('users');
  } catch (err) {
    console.error('[Developer] Firestore users error:', err);
    return [];
  }
}

/* ===== الحالة النشطة ===== */
function isScheduleActive(item, now = Date.now()) {
  const starts = item.startsAt ? new Date(item.startsAt).getTime() : 0;
  const ends = item.endsAt ? new Date(item.endsAt).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(starts) && starts <= now && ends > now && item.active !== false;
}

function contentStatus(item) {
  if (item.active === false) return 'draft';
  if (item.endsAt && Date.parse(item.endsAt) <= Date.now()) return 'expired';
  if (item.startsAt && Date.parse(item.startsAt) > Date.now()) return 'scheduled';
  return 'published';
}

function contentStatusLabel(item) {
  return {
    draft: '📝 مسودة',
    scheduled: '⏰ مجدول',
    expired: '⌛ منتهي',
    published: '✅ منشور'
  }[contentStatus(item)];
}

/* ===== التحقق ===== */
function validateContentInput({ title, link, image, startsAt, endsAt }, notify = true) {
  let error = '';
  if (!title || title.length > 80) error = 'اكتب عنوانًا من 1 إلى 80 حرفًا';
  else if ((link && !LocalSecurity.safeUrl(link)) || (image && !LocalSecurity.safeUrl(image))) error = 'الروابط يجب أن تبدأ بـ https:// أو http://';
  else if ((startsAt && !Number.isFinite(Date.parse(startsAt))) || (endsAt && !Number.isFinite(Date.parse(endsAt)))) error = 'التاريخ غير صحيح';
  else if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) error = 'تاريخ النهاية يجب أن يكون بعد البداية';
  if (error && notify) showToast(error);
  return !error;
}

/* ===== الإعدادات ===== */
async function saveDeveloperSettings() {
  if (!requireDeveloper()) return;
  const settings = getDeveloperSettings();
  const form = document.getElementById('developerSettingsForm');
  if (!form) return;

  settings.maxHomeNews = Number(document.getElementById('developerMaxNews').value || settings.maxHomeNews);
  settings.autoRefreshMinutes = Number(document.getElementById('developerRefresh').value || settings.autoRefreshMinutes);
  settings.enableHomeNews = document.getElementById('developerEnableHomeNews').checked;
  settings.enableAds = document.getElementById('developerEnableAds').checked;
  settings.enablePopupAds = document.getElementById('developerEnablePopupAds').checked;
  settings.interleaveAds = document.getElementById('developerInterleaveAds').checked;
  settings.requireLogin = document.getElementById('developerRequireLogin').checked;
  settings.maintenanceMode = document.getElementById('developerMaintenance').checked;
  settings.maintenanceMessage = document.getElementById('developerMaintenanceMessage').value.trim() || DEFAULT_DEV_SETTINGS.maintenanceMessage;
  settings.siteBannerEnabled = document.getElementById('developerBannerEnabled').checked;
  settings.siteBanner = document.getElementById('developerBannerText').value.trim();
  settings.ayahMarkerMode = document.getElementById('developerAyahMode').value;
  settings.ayahTolerance = Number(document.getElementById('developerAyahTolerance').value || settings.ayahTolerance);
  settings.enableDebugLogs = document.getElementById('developerDebugLogs').checked;
  settings.allowRegistration = document.getElementById('developerAllowRegistration').checked;
  settings.maxAdsPerSlot = Number(document.getElementById('developerMaxAds').value);
  settings.popupOnce = document.getElementById('developerPopupOnce').checked;

  const perfEl = document.getElementById('developerPerformanceMode');
  if (perfEl) settings.performanceMode = perfEl.value;

  persistDeveloperSettings(settings);

  if (window.cloudSync) {
    const success = await window.cloudSync.saveDevSettings(settings);
    if (success) {
      showToast('✅ تم الحفظ لجميع الزوار');
    } else {
      showToast('⚠️ تم الحفظ محلياً فقط');
    }
  } else {
    showToast('✅ تم الحفظ محلياً');
  }

  recordDeveloperActivity('تحديث إعدادات الموقع');
  refreshPublicSurfaces();
}

function renderDeveloperSettings() {
  const form = document.getElementById('developerSettingsForm');
  if (!form) return;
  const settings = getDeveloperSettings();
  const values = {
    developerMaxNews: settings.maxHomeNews,
    developerRefresh: settings.autoRefreshMinutes,
    developerEnableHomeNews: settings.enableHomeNews,
    developerEnableAds: settings.enableAds,
    developerEnablePopupAds: settings.enablePopupAds,
    developerInterleaveAds: settings.interleaveAds,
    developerRequireLogin: settings.requireLogin,
    developerMaintenance: settings.maintenanceMode,
    developerMaintenanceMessage: settings.maintenanceMessage,
    developerBannerEnabled: settings.siteBannerEnabled,
    developerBannerText: settings.siteBanner,
    developerAyahMode: settings.ayahMarkerMode,
    developerAyahTolerance: settings.ayahTolerance,
    developerDebugLogs: settings.enableDebugLogs,
    developerAllowRegistration: settings.allowRegistration,
    developerMaxAds: settings.maxAdsPerSlot,
    developerPopupOnce: settings.popupOnce,
    developerPerformanceMode: settings.performanceMode
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value;
  });
}

/* ===== التبويبات ===== */
function switchDeveloperTab(tab) {
  document.querySelectorAll('[data-dev-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.devTab === tab);
  });
  document.querySelectorAll('[data-dev-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.devPanel !== tab);
  });

  const actions = {
    overview: renderDeveloperOverview,
    news: renderDeveloperEvents,
    ads: renderDeveloperAds,
    users: renderRegisteredUsers,
    settings: renderDeveloperSettings,
    stats: renderAdvancedStats,
    features: renderFeaturesGrid,
    messages: renderDevMessagesList,
    banned: renderBannedDevices,
    tools: renderDevTools
  };

  if (actions[tab]) actions[tab]();
}

/* ===== دخول المطور ===== */
function openDeveloperLoginModal() {
  const modal = document.getElementById('developerLoginModal');
  if (!modal) return;
  const input = document.getElementById('developerLoginPassword');
  const confirm = document.getElementById('developerLoginConfirm');
  const confirmLabel = document.getElementById('developerConfirmLabel');

  document.getElementById('developerLoginTitle').textContent = 'دخول لوحة المطور';
  document.getElementById('developerLoginHint').textContent = 'أدخل كلمة مرور المطور';
  if (input) input.value = '';
  if (confirm) { confirm.value = ''; confirm.classList.add('hidden'); confirm.required = false; }
  if (confirmLabel) confirmLabel.classList.add('hidden');
  document.getElementById('developerLoginError').textContent = '';
  modal.classList.add('show');
  setTimeout(() => input?.focus(), 50);
}

function closeDeveloperLoginModal() {
  document.getElementById('developerLoginModal')?.classList.remove('show');
}

async function attemptDeveloperUnlock(password) {
  const lock = getStoredJson(DEV_LOCK_KEY, { attempts: 0, until: 0 });
  if (lock.until > Date.now()) throw new Error('محاولات كثيرة. انتظر دقيقتين');
  if (!password) return false;
  if (!window.firebaseHelpers) throw new Error('Firebase لم يتم تحميله');

  const isValid = await window.firebaseHelpers.verifyDevPassword(password);
  if (!isValid) {
    const attempts = (lock.until && lock.until <= Date.now() ? 0 : lock.attempts) + 1;
    localStorage.setItem(DEV_LOCK_KEY, JSON.stringify({
      attempts,
      until: attempts >= 5 ? Date.now() + 120000 : 0
    }));
    throw new Error('كلمة المرور غير صحيحة');
  }

  localStorage.removeItem(DEV_LOCK_KEY);
  developerUnlocked = true;
  developerLastActive = Date.now();
  localStorage.setItem('developerUnlocked', 'true');

  if (window.cloudSync) {
    await window.cloudSync.init();
  }

  closeDeveloperLoginModal();
  recordDeveloperActivity('دخول لوحة المطور');
  showDeveloperView();
  refreshPublicSurfaces();
  document.getElementById('authModal')?.classList.remove('show');

  if (typeof trackEvent === 'function') trackEvent('developer_unlock');

  return true;
}

async function handleDeveloperLoginSubmit(event) {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  const password = document.getElementById('developerLoginPassword')?.value || '';
  try {
    await attemptDeveloperUnlock(password);
    event.target.reset();
  } catch (error) {
    document.getElementById('developerLoginError').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function openDeveloperPanel() {
  if (developerUnlocked) { showDeveloperView(); return; }
  openDeveloperLoginModal();
}

function showDeveloperView() {
  if (!requireDeveloper()) return;
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.getElementById('developerView')?.classList.add('active');
  closeSidebarIfOpen();
  renderDeveloperDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (typeof updateGlobalBackBtn === 'function') updateGlobalBackBtn();
}

function lockDeveloperPanel() {
  developerUnlocked = false;
  localStorage.removeItem('developerUnlocked');
  resetNewsForm();
  resetAdForm();
  showHome();
  refreshPublicSurfaces();
}

async function renderDeveloperDashboard() {
  renderDeveloperSettings();
  await Promise.all([
    renderDeveloperEvents(),
    renderDeveloperAds(),
    renderRegisteredUsers(),
    renderAdvancedStats()
  ]);
  await renderDeveloperOverview();
  renderBannedDevices();
  switchDeveloperTab(document.querySelector('[data-dev-tab].active')?.dataset.devTab || 'overview');
}

async function renderDeveloperOverview() {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  try {
    const [news, ads, users] = await Promise.all([
      getNewsFromFirebase(),
      getAdsFromFirebase(),
      getUsersFromFirebase()
    ]);
    const now = Date.now();
    setText('devStatUsers', String(users.length));
    setText('devStatNews', String(news.filter(item => isScheduleActive(item, now)).length));
    setText('devStatAds', String(ads.filter(item => isScheduleActive(item, now)).length));
    setText('devStatImpressions', String(ads.reduce((sum, ad) => sum + Number(ad.impressions || 0), 0)));
    setText('devStatBanned', String(getBannedDevices().length));
  } catch (err) {
    console.error('[Developer] Overview error:', err);
  }
  renderDeveloperActivity();
}

/* ============================================
   ✅ تغيير كلمة مرور المطور (عبر Firestore)
   ============================================ */
async function changeDeveloperPassword() {
  if (!requireDeveloper()) return;

  const current = prompt('أدخل كلمة المرور الحالية:');
  if (!current) return;

  const isValid = await window.firebaseHelpers.verifyDevPassword(current);
  if (!isValid) {
    showToast('❌ كلمة المرور الحالية خاطئة');
    return;
  }

  const newPass = prompt('أدخل كلمة المرور الجديدة (10 أحرف على الأقل):');
  if (!newPass || newPass.length < 10) {
    showToast('كلمة المرور قصيرة جداً (10 أحرف على الأقل)');
    return;
  }

  const confirmPass = prompt('أعد إدخال كلمة المرور الجديدة:');
  if (confirmPass !== newPass) {
    showToast('كلمتا المرور غير متطابقتين');
    return;
  }

  try {
    await window.firebaseHelpers.setDevPassword(newPass);
    recordDeveloperActivity('تغيير كلمة مرور المطور');
    showToast('✅ تم تغيير كلمة المرور');
    if (typeof trackEvent === 'function') trackEvent('developer_password_changed');
  } catch (err) {
    showToast('تعذر الحفظ: ' + err.message);
  }
}

/* ===== إحصائيات متقدمة ===== */
async function renderAdvancedStats() {
  const container = document.getElementById('developerAdvancedStats');
  if (!container) return;

  try {
    const [news, ads, users] = await Promise.all([
      getNewsFromFirebase(),
      getAdsFromFirebase(),
      getUsersFromFirebase()
    ]);

    const now = Date.now();
    const last7Days = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const stats = {
      newsTotal: news.length,
      newsActive: news.filter(n => isScheduleActive(n, now)).length,
      newsDrafts: news.filter(n => n.active === false).length,
      adsTotal: ads.length,
      adsActive: ads.filter(a => isScheduleActive(a, now)).length,
      adsImpressions: ads.reduce((s, a) => s + Number(a.impressions || 0), 0),
      adsClicks: ads.reduce((s, a) => s + Number(a.clicks || 0), 0),
      usersTotal: users.length,
      usersActive: users.filter(u => !u.disabled && !u.banned).length,
      usersDisabled: users.filter(u => u.disabled).length,
      usersBanned: users.filter(u => u.banned).length,
      usersWeek: users.filter(u => u.createdAt && new Date(u.createdAt).getTime() > last7Days).length,
      usersMonth: users.filter(u => u.createdAt && new Date(u.createdAt).getTime() > last30Days).length
    };

    const ctr = stats.adsImpressions > 0
      ? ((stats.adsClicks / stats.adsImpressions) * 100).toFixed(2)
      : '0.00';

    container.innerHTML = `
      <div class="dev-stats-grid">
        <div class="dev-stat-card">
          <div class="dev-stat-icon">📰</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">الأخبار</span>
            <strong class="dev-stat-value">${stats.newsTotal}</strong>
            <small class="dev-stat-sub">${stats.newsActive} نشط · ${stats.newsDrafts} مسودة</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">💰</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">الإعلانات</span>
            <strong class="dev-stat-value">${stats.adsTotal}</strong>
            <small class="dev-stat-sub">${stats.adsActive} نشط</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">👁️</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">المشاهدات</span>
            <strong class="dev-stat-value">${stats.adsImpressions}</strong>
            <small class="dev-stat-sub">${stats.adsClicks} نقرة</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">🎯</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">معدل النقر</span>
            <strong class="dev-stat-value">${ctr}%</strong>
            <small class="dev-stat-sub">CTR</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">👥</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">المستخدمون</span>
            <strong class="dev-stat-value">${stats.usersTotal}</strong>
            <small class="dev-stat-sub">${stats.usersActive} نشط</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">🚫</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">محظورون</span>
            <strong class="dev-stat-value">${stats.usersBanned}</strong>
            <small class="dev-stat-sub">${stats.usersDisabled} موقوف</small>
          </div>
        </div>

        <div class="dev-stat-card">
          <div class="dev-stat-icon">🆕</div>
          <div class="dev-stat-content">
            <span class="dev-stat-label">جدد هذا الأسبوع</span>
            <strong class="dev-stat-value">${stats.usersWeek}</strong>
            <small class="dev-stat-sub">${stats.usersMonth} هذا الشهر</small>
          </div>
        </div>
      </div>

      <div class="dev-tools-grid" id="devToolsGrid"></div>
    `;

    renderDevTools();
  } catch (err) {
    console.error('[Developer] Stats error:', err);
    container.innerHTML = '<p class="developer-empty">تعذر تحميل الإحصائيات</p>';
  }
}

/* ===== أدوات المطور ===== */
function renderDevTools() {
  const grid = document.getElementById('devToolsGrid');
  if (!grid) return;

  const tools = [
    { icon: '🧹', label: 'تنظيف الكاش', fn: 'devClearCache', danger: false },
    { icon: '🔄', label: 'إعادة تحميل', fn: 'devReloadPage', danger: false },
    { icon: '⚙️', label: 'تحديث SW', fn: 'devReinstallSW', danger: false },
    { icon: '💾', label: 'حالة التخزين', fn: 'devShowStorageInfo', danger: false },
    { icon: '🔥', label: 'اختبار Firebase', fn: 'devTestFirebase', danger: false },
    { icon: '📊', label: 'فحص شامل', fn: 'devFullDiagnostic', danger: false },
    { icon: '🛡️', label: 'معالج الأخطاء', fn: 'devShowErrors', danger: false },
    { icon: '⚡', label: 'تحسين الأداء', fn: 'devOptimizePerformance', danger: false },
    { icon: '🧪', label: 'اختبار الإشعارات', fn: 'devTestNotifications', danger: false },
    { icon: '☁️', label: 'مزامنة سحابية', fn: 'devSyncCloud', danger: false },
    { icon: '💽', label: 'مسح IndexedDB', fn: 'devClearIndexedDB', danger: false },
    { icon: '📈', label: 'عرض Analytics', fn: 'devShowAnalytics', danger: false },
    { icon: '🧹', label: 'مسح الكاش + SW', fn: 'devClearCacheAndSW', danger: true },
    { icon: '⚠️', label: 'مسح كل البيانات', fn: 'devClearAllData', danger: true }
  ];

  grid.innerHTML = tools.map(tool => `
    <button class="dev-tool-btn ${tool.danger ? 'danger' : ''}" onclick="${tool.fn}()">
      <span>${tool.icon}</span>
      <span>${tool.label}</span>
    </button>
  `).join('');
}

async function devClearCache() {
  if (!requireDeveloper()) return;
  if (!confirm('تنظيف الكاش وإعادة التحميل؟')) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    showToast('✅ تم مسح الكاش');
    setTimeout(() => location.reload(true), 800);
  } catch (err) {
    showToast('تعذر مسح الكاش');
  }
}

function devReloadPage() { location.reload(true); }

async function devReinstallSW() {
  if (!requireDeveloper()) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) await reg.unregister();
    showToast('✅ تم إلغاء SW. جارٍ إعادة التحميل...');
    setTimeout(() => location.reload(true), 800);
  } catch (err) {
    showToast('تعذر تحديث SW');
  }
}

async function devShowStorageInfo() {
  if (!requireDeveloper()) return;
  try {
    const estimate = await navigator.storage?.estimate?.() || {};
    const used = estimate.usage ? (estimate.usage / 1024 / 1024).toFixed(2) : '?';
    const quota = estimate.quota ? (estimate.quota / 1024 / 1024).toFixed(2) : '?';
    const keys = Object.keys(localStorage);
    const size = new Blob(keys.map(k => localStorage.getItem(k))).size;
    const sizeKB = (size / 1024).toFixed(2);

    alert(
      `💾 معلومات التخزين\n\n` +
      `📦 localStorage: ${keys.length} مفتاح · ${sizeKB} KB\n` +
      `🗄️ المستخدم: ${used} MB\n` +
      `📊 الحد الأقصى: ${quota} MB\n` +
      `📈 النسبة: ${estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(1) : '?'}%`
    );
  } catch (err) {
    alert('تعذر جلب معلومات التخزين');
  }
}

async function devTestFirebase() {
  if (!requireDeveloper()) return;
  const result = ['🔥 اختبار Firebase:\n'];

  try {
    result.push(`✅ Config: ${typeof FIREBASE_CONFIG !== 'undefined' ? 'موجود' : '❌ مفقود'}`);
    result.push(`✅ Helpers: ${window.firebaseHelpers ? 'موجود' : '❌ مفقود'}`);
    result.push(`✅ Ready: ${window.firebaseHelpers?.isReady ? '✅' : '⏳'}`);

    const auth = await window.firebaseHelpers?.whenFirebaseReady();
    result.push(`✅ Auth: ${auth?.auth ? 'متصل' : '❌'}`);
    result.push(`✅ Firestore: ${auth?.db ? 'متصل' : '❌'}`);

    const users = await getUsersFromFirebase();
    result.push(`✅ Users: ${users.length} مستخدم`);
    const news = await getNewsFromFirebase();
    result.push(`✅ News: ${news.length} خبر`);
    const ads = await getAdsFromFirebase();
    result.push(`✅ Ads: ${ads.length} إعلان`);
  } catch (e) {
    result.push(`❌ Error: ${e.message}`);
  }

  alert(result.join('\n'));
}

async function devFullDiagnostic() {
  if (!requireDeveloper()) return;

  const diagnostics = [];
  diagnostics.push('🔍 فحص شامل للنظام\n');

  diagnostics.push('📦 الحالة الأساسية:');
  diagnostics.push(`  • LocalStorage: ${Object.keys(localStorage).length} مفتاح`);
  diagnostics.push(`  • SessionStorage: ${Object.keys(sessionStorage).length} مفتاح`);
  diagnostics.push(`  • Online: ${navigator.onLine ? '✅' : '❌'}`);
  diagnostics.push(`  • SW: ${'serviceWorker' in navigator ? '✅' : '❌'}`);
  diagnostics.push(`  • Notifications: ${'Notification' in window ? Notification.permission : '❌'}`);
  diagnostics.push(`  • IndexedDB: ${'indexedDB' in window ? '✅' : '❌'}`);
  diagnostics.push('');

  diagnostics.push('🔥 Firebase:');
  try {
    const auth = await window.firebaseHelpers?.whenFirebaseReady();
    diagnostics.push(`  • Auth: ${auth?.auth ? '✅' : '❌'}`);
    diagnostics.push(`  • Firestore: ${auth?.db ? '✅' : '❌'}`);
    const users = await getUsersFromFirebase();
    diagnostics.push(`  • Users: ${users.length}`);
    const news = await getNewsFromFirebase();
    diagnostics.push(`  • News: ${news.length}`);
    const ads = await getAdsFromFirebase();
    diagnostics.push(`  • Ads: ${ads.length}`);
  } catch (e) {
    diagnostics.push(`  • ❌ ${e.message}`);
  }
  diagnostics.push('');

  diagnostics.push('☁️ Cloud Sync:');
  diagnostics.push(`  • Initialized: ${window.cloudSync?.getState?.().initialized ? '✅' : '❌'}`);
  diagnostics.push(`  • Features: ${window.cloudSync?.getState?.().features ? '✅' : '⏳'}`);
  diagnostics.push(`  • Messages: ${window.cloudSync?.getState?.().messages ? '✅' : '⏳'}`);
  diagnostics.push(`  • Banned: ${window.cloudSync?.getState?.().bannedDevices ? '✅' : '⏳'}`);
  diagnostics.push('');

  diagnostics.push('📊 Analytics:');
  if (window.analyticsApi) {
    const summary = window.analyticsApi.summary();
    diagnostics.push(`  • Total events: ${summary.total}`);
    diagnostics.push(`  • Session: ${summary.sessionId}`);
  } else {
    diagnostics.push('  • ❌ غير محمّل');
  }
  diagnostics.push('');

  diagnostics.push('🔴 آخر الأخطاء:');
  const errors = window.ErrorHandler?.getLogs() || [];
  if (errors.length === 0) {
    diagnostics.push('  • لا توجد أخطاء ✅');
  } else {
    errors.slice(0, 5).forEach((err, i) => {
      diagnostics.push(`  ${i + 1}. ${err.message.slice(0, 60)}`);
    });
  }

  alert(diagnostics.join('\n'));
}

function devShowErrors() {
  if (!requireDeveloper()) return;
  const logs = window.ErrorHandler?.getLogs() || [];

  if (logs.length === 0) {
    alert('✅ لا توجد أخطاء مسجّلة');
    return;
  }

  const text = logs.map((log, i) =>
    `${i + 1}. [${new Date(log.timestamp).toLocaleString('ar-IQ')}]\n${log.message}\n`
  ).join('\n---\n\n');

  if (confirm(`📋 ${logs.length} خطأ مسجّل\n\nهل تريد مسح السجل؟`)) {
    window.ErrorHandler?.clear();
    showToast('تم مسح سجل الأخطاء');
    return;
  }

  const win = window.open('', '_blank', 'width=600,height=500');
  win.document.write(`<pre style="font-family:monospace;padding:20px;white-space:pre-wrap;">${text.replace(/</g, '&lt;')}</pre>`);
}

async function devOptimizePerformance() {
  if (!requireDeveloper()) return;
  showToast('⚡ جارٍ تحسين الأداء...');

  try {
    if (window.appMemory) window.appMemory.clear();

    if ('caches' in window) {
      const keys = await caches.keys();
      const runtimeCaches = keys.filter(k => k.includes('runtime'));
      for (const key of runtimeCaches) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        if (requests.length > 100) {
          for (let i = 0; i < requests.length - 100; i++) {
            await cache.delete(requests[i]);
          }
        }
      }
    }

    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.startsWith('temp_') || key.startsWith('old_')) {
        sessionStorage.removeItem(key);
      }
    });

    localStorage.setItem('tariq_performance_mode', 'true');
    showToast('✅ تم تحسين الأداء');
  } catch (err) {
    console.error(err);
    showToast('تعذر التحسين');
  }
}

async function devTestNotifications() {
  if (!requireDeveloper()) return;

  if (!('Notification' in window)) {
    alert('❌ المتصفح لا يدعم الإشعارات');
    return;
  }

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      alert('❌ لم يتم السماح بالإشعارات');
      return;
    }
  }

  try {
    new Notification('🧪 اختبار', {
      body: 'إذا شفت هذا الإشعار، النظام يعمل بشكل صحيح',
      tag: 'test-' + Date.now()
    });
    showToast('✅ تم إرسال الإشعار');
  } catch (err) {
    alert('❌ تعذر الإرسال');
  }
}

async function devSyncCloud() {
  if (!requireDeveloper()) return;

  showToast('☁️ جارٍ المزامنة...');

  if (!window.cloudSync) {
    alert('❌ Cloud Sync غير محمّل');
    return;
  }

  try {
    const features = typeof getFeatures === 'function' ? getFeatures() : {};
    const settings = getDeveloperSettings();

    const results = await Promise.all([
      window.cloudSync.saveFeatures(features),
      window.cloudSync.saveDevSettings(settings)
    ]);

    if (results.every(r => r)) {
      showToast('✅ تمت المزامنة');
    } else {
      showToast('⚠️ بعض البيانات لم تُزامن');
    }
  } catch (err) {
    console.error(err);
    showToast('تعذر المزامنة');
  }
}

async function devClearIndexedDB() {
  if (!requireDeveloper()) return;
  if (!confirm('مسح جميع بيانات IndexedDB (السور، الآيات، القرّاء)؟')) return;

  try {
    if (window.idbHelper) {
      await window.idbHelper.clear();
      showToast('✅ تم مسح IndexedDB');
    } else {
      showToast('IndexedDB غير محمّل');
    }
  } catch (err) {
    showToast('تعذر المسح');
  }
}

function devShowAnalytics() {
  if (!requireDeveloper()) return;
  if (!window.analyticsApi) {
    alert('❌ Analytics غير محمّل');
    return;
  }

  const summary = window.analyticsApi.summary();
  const events = window.analyticsApi.getAll(50);

  const lines = [
    '📊 ملخص Analytics:\n',
    `• إجمالي الأحداث: ${summary.total}`,
    `• Session: ${summary.sessionId}`,
    '',
    '📋 آخر 10 أحداث:',
    ...events.slice(-10).map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('ar-IQ');
      return `  ${time} — ${e.name}`;
    }),
    '',
    '📈 أكثر الأحداث:',
    ...Object.entries(summary.byName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => `  ${name}: ${count}`)
  ];

  alert(lines.join('\n'));
}

async function devClearCacheAndSW() {
  if (!requireDeveloper()) return;
  if (!confirm('مسح الكاش + SW وإعادة التحميل؟')) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) await reg.unregister();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    showToast('✅ تم المسح');
    setTimeout(() => location.reload(true), 1000);
  } catch (err) {
    showToast('تعذر المسح');
  }
}

async function devClearAllData() {
  if (!requireDeveloper()) return;
  if (!confirm('⚠️ مسح كل البيانات؟')) return;
  if (!confirm('تأكيد نهائي؟')) return;

  try {
    localStorage.clear();
    sessionStorage.clear();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    if (window.idbHelper) await window.idbHelper.clear();
    alert('✅ تم المسح. جارٍ إعادة التحميل...');
    setTimeout(() => location.reload(true), 1000);
  } catch (err) {
    alert('تعذر المسح');
  }
}

/* ============================================
   محرر الأخبار
   ============================================ */
function resetNewsForm() {
  editingEventId = '';
  developerImageData = '';
  document.getElementById('developerEventForm')?.reset();
  document.getElementById('developerImagePreview')?.removeAttribute('src');
  const submit = document.getElementById('developerEventSubmit');
  if (submit) submit.textContent = 'نشر الخبر';
  document.getElementById('developerEventActive')?.setAttribute('checked', 'checked');
}

function fillNewsForm(event) {
  if (!requireDeveloper()) return;
  editingEventId = event.id;
  developerImageData = event.image || '';
  document.getElementById('developerEventTitle').value = event.title || '';
  document.getElementById('developerEventDescription').value = event.description || '';
  document.getElementById('developerEventLink').value = event.link || '';
  document.getElementById('developerEventImage').value = LocalSecurity.safeUrl(event.image || '');
  document.getElementById('developerEventCategory').value = event.type || 'news';
  document.getElementById('developerEventPriority').value = event.priority || 50;
  document.getElementById('developerEventStarts').value = event.startsAt || '';
  document.getElementById('developerEventEnds').value = event.endsAt || '';
  document.getElementById('developerEventFeatured').checked = !!event.featured;
  document.getElementById('developerEventPinned').checked = !!event.pinned;
  document.getElementById('developerEventActive').checked = event.active !== false;

  const preview = document.getElementById('developerImagePreview');
  if (preview) {
    if (developerImageData) preview.src = developerImageData;
    else preview.removeAttribute('src');
  }
  const submit = document.getElementById('developerEventSubmit');
  if (submit) submit.textContent = 'حفظ التعديل';
  switchDeveloperTab('news');
}

async function saveDeveloperEvent() {
  if (!requireDeveloper()) return;
  const title = document.getElementById('developerEventTitle').value.trim();
  const description = document.getElementById('developerEventDescription').value.trim();
  const link = document.getElementById('developerEventLink').value.trim();
  const startsAt = document.getElementById('developerEventStarts').value;
  const endsAt = document.getElementById('developerEventEnds').value;
  const category = document.getElementById('developerEventCategory').value || 'news';
  const featured = document.getElementById('developerEventFeatured').checked;
  const pinned = document.getElementById('developerEventPinned')?.checked;
  const active = document.getElementById('developerEventActive').checked;
  const priority = Number(document.getElementById('developerEventPriority').value || 50);
  const image = document.getElementById('developerEventImage').value.trim();

  if (!validateContentInput({ title, link, image, startsAt, endsAt })) return;

  const wasEditing = !!editingEventId;
  const eventData = {
    title, description, link, startsAt, endsAt, image,
    type: category, featured, pinned: !!pinned, active,
    priority: Number.isFinite(priority) ? Math.min(100, Math.max(1, priority)) : 50
  };

  try {
    if (editingEventId) {
      await window.firebaseHelpers.fbSetDoc('news', editingEventId, eventData);
    } else {
      await window.firebaseHelpers.fbAddDoc('news', eventData);
    }
    recordDeveloperActivity(`${wasEditing ? 'تعديل' : 'إضافة'} خبر: ${title}`);
    resetNewsForm();
    await renderDeveloperEvents();
    renderDeveloperOverview();
    await renderHomeEvents();
    showToast(wasEditing ? '✅ تم تحديث الخبر' : '✅ تم نشر الخبر');
  } catch (err) {
    showToast('تعذر حفظ الخبر: ' + err.message);
  }
}

async function deleteDeveloperEvent(id) {
  if (!requireDeveloper() || !confirm('حذف الخبر نهائيًا؟')) return;
  try {
    await window.firebaseHelpers.fbDeleteDoc('news', id);
    if (String(editingEventId) === String(id)) resetNewsForm();
    await renderDeveloperEvents();
    renderDeveloperOverview();
    await renderHomeEvents();
    recordDeveloperActivity('حذف خبر');
    showToast('تم حذف الخبر');
  } catch (err) {
    showToast('تعذر الحذف');
  }
}

async function toggleDeveloperEventStatus(id) {
  if (!requireDeveloper()) return;
  try {
    const events = await getNewsFromFirebase();
    const item = events.find(e => e.id === id);
    if (!item) return;
    await window.firebaseHelpers.fbSetDoc('news', id, { active: item.active === false });
    await renderDeveloperEvents();
    await renderHomeEvents();
    renderDeveloperOverview();
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

async function toggleDeveloperEventFeatured(id) {
  if (!requireDeveloper()) return;
  try {
    const events = await getNewsFromFirebase();
    const item = events.find(e => e.id === id);
    if (!item) return;
    await window.firebaseHelpers.fbSetDoc('news', id, { featured: !item.featured });
    await renderDeveloperEvents();
    await renderHomeEvents();
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

async function toggleDeveloperEventPinned(id) {
  if (!requireDeveloper()) return;
  try {
    const events = await getNewsFromFirebase();
    const item = events.find(e => e.id === id);
    if (!item) return;
    await window.firebaseHelpers.fbSetDoc('news', id, { pinned: !item.pinned });
    await renderDeveloperEvents();
    await renderHomeEvents();
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

async function renderDeveloperEvents() {
  const list = document.getElementById('developerEventsList');
  if (!list) return;
  list.innerHTML = '<p class="developer-empty">⏳ جارٍ التحميل...</p>';

  try {
    const events = await getNewsFromFirebase();
    if (!events.length) {
      list.innerHTML = '<p class="developer-empty">لا توجد أخبار محفوظة</p>';
      return;
    }
    events.sort((a, b) => (Number(b.priority || 50) - Number(a.priority || 50)));
    list.innerHTML = events.map(event => `
      <div class="developer-row">
        <div>
          <strong>${developerEscape(event.title)}</strong>
          <small>
            ${contentStatusLabel(event)}
            ${event.pinned ? '· 📌' : ''}
            ${event.featured ? '· ⭐' : ''}
            · أولوية ${event.priority || 50}
            · ${formatDate(event.createdAt?.toDate?.() || event.createdAt)}
          </small>
        </div>
        <div class="developer-row-actions">
          <button class="developer-mini-btn" onclick="fillNewsFormById('${event.id}')">✏️</button>
          <button class="developer-mini-btn" onclick="toggleDeveloperEventPinned('${event.id}')">${event.pinned ? '📍' : '📌'}</button>
          <button class="developer-mini-btn" onclick="toggleDeveloperEventFeatured('${event.id}')">${event.featured ? '☆' : '⭐'}</button>
          <button class="developer-mini-btn" onclick="toggleDeveloperEventStatus('${event.id}')">${event.active === false ? '👁️' : '🚫'}</button>
          <button class="developer-delete-btn" onclick="deleteDeveloperEvent('${event.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="developer-empty">تعذر تحميل الأخبار</p>';
  }
}

async function fillNewsFormById(id) {
  const events = await getNewsFromFirebase();
  const event = events.find(item => item.id === id);
  if (event) fillNewsForm(event);
}

/* ============================================
   عرض الأخبار في الرئيسية
   ============================================ */
async function getActiveHomeEvents() {
  try {
    const all = await getNewsFromFirebase();
    const now = Date.now();
    const settings = getDeveloperSettings();
    const events = all.filter(event => {
      if (event.active === false) return false;
      const starts = event.startsAt ? Date.parse(event.startsAt) : 0;
      const ends = event.endsAt ? Date.parse(event.endsAt) : Infinity;
      return starts <= now && ends > now;
    }).sort((a, b) => {
      const pinBoost = (b.pinned ? 200 : 0) - (a.pinned ? 200 : 0);
      const featuredBoost = (b.featured ? 100 : 0) - (a.featured ? 100 : 0);
      const priorityDiff = Number(b.priority || 50) - Number(a.priority || 50);
      return pinBoost || featuredBoost || priorityDiff;
    });

    const query = document.getElementById('homeNewsSearch')?.value.trim().toLowerCase() || '';
    return events
      .filter(item => !query || `${item.title} ${item.description}`.toLowerCase().includes(query))
      .slice(0, settings.maxHomeNews);
  } catch (err) {
    return [];
  }
}

async function renderHomeEvents() {
  const container = document.getElementById('homeEvents');
  if (!container) return;

  const settings = getDeveloperSettings();
  const section = document.getElementById('homeNewsSection');
  if (section) section.classList.toggle('hidden', !settings.enableHomeNews);

  if (!settings.enableHomeNews) {
    container.innerHTML = '';
    return;
  }

  const events = await getActiveHomeEvents();

  let ads = [];
  if (settings.enableAds && settings.interleaveAds) {
    ads = await getActiveAds('home-mid');
  }

  if (!events.length && !ads.length) {
    container.innerHTML = '<div class="home-event-empty">لا توجد أخبار نشطة حالياً.</div>';
    renderHomeAds();
    return;
  }

  const items = [];

  events.forEach((event, index) => {
    const badge = event.pinned ? '📌 مثبّت' : event.featured ? '⭐ مميز' : '📰 خبر';
    const image = LocalSecurity.safeUrl(event.image || '');
    const link = LocalSecurity.safeUrl(event.link || '');
    const media = image ? `<img src="${developerEscape(image)}" alt="" loading="lazy">` : '';
    const content = `<div class="home-event-copy"><span class="home-event-label">${badge}</span><h2>${developerEscape(event.title)}</h2><p>${developerEscape(event.description || '')}</p></div>`;

    const card = link
      ? `<a class="home-event-card" href="${developerEscape(link)}" target="_blank" rel="noopener noreferrer" style="animation-delay:${index * 0.05}s">${media}${content}<span class="home-event-arrow">↗</span></a>`
      : `<article class="home-event-card" style="animation-delay:${index * 0.05}s">${media}${content}</article>`;

    items.push(card);

    if (settings.interleaveAds && ads.length && (index + 1) % 2 === 0) {
      const adIndex = Math.floor(index / 2);
      if (ads[adIndex]) {
        items.push(renderAdCard(ads[adIndex], 'home-mid'));
      }
    }
  });

  container.innerHTML = items.join('');
  renderHomeAds();
}

/* ============================================
   الإعلانات
   ============================================ */
function resetAdForm() {
  editingAdId = '';
  developerAdImageData = '';
  document.getElementById('developerAdForm')?.reset();
  document.getElementById('developerAdImagePreview')?.removeAttribute('src');
  const submit = document.getElementById('developerAdSubmit');
  if (submit) submit.textContent = 'نشر الإعلان';
}

function fillAdForm(ad) {
  if (!requireDeveloper()) return;
  editingAdId = ad.id;
  developerAdImageData = ad.image || '';
  const fields = {
    developerAdTitle: ad.title,
    developerAdBody: ad.body,
    developerAdLink: ad.link,
    developerAdImage: LocalSecurity.safeUrl(ad.image || ''),
    developerAdCta: ad.cta || 'معرفة المزيد',
    developerAdAudience: ad.audience || 'all',
    developerAdPriority: ad.priority || 50,
    developerAdPlacement: ad.placement || 'home-top',
    developerAdStarts: ad.startsAt,
    developerAdEnds: ad.endsAt
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  });
  document.getElementById('developerAdActive').checked = ad.active !== false;
  document.getElementById('developerAdDismissible').checked = ad.dismissible !== false;
  const preview = document.getElementById('developerAdImagePreview');
  if (preview) {
    if (developerAdImageData) preview.src = developerAdImageData;
    else preview.removeAttribute('src');
  }
  document.getElementById('developerAdSubmit').textContent = 'حفظ الإعلان';
  switchDeveloperTab('ads');
}

async function saveDeveloperAd() {
  if (!requireDeveloper()) return;
  const title = document.getElementById('developerAdTitle').value.trim();
  const body = document.getElementById('developerAdBody').value.trim();
  const link = document.getElementById('developerAdLink').value.trim();
  const placement = document.getElementById('developerAdPlacement').value || 'home-top';
  const startsAt = document.getElementById('developerAdStarts').value;
  const endsAt = document.getElementById('developerAdEnds').value;
  const active = document.getElementById('developerAdActive').checked;
  const dismissible = document.getElementById('developerAdDismissible').checked;
  const image = document.getElementById('developerAdImage').value.trim();

  if (!validateContentInput({ title, link, image, startsAt, endsAt })) return;

  try {
    const existing = editingAdId ? (await getAdsFromFirebase()).find(a => a.id === editingAdId) : null;
    const payload = {
      title, body, link, placement, startsAt, endsAt, image,
      cta: document.getElementById('developerAdCta').value.trim() || 'معرفة المزيد',
      audience: document.getElementById('developerAdAudience').value,
      priority: Math.min(100, Math.max(1, Number(document.getElementById('developerAdPriority').value) || 50)),
      active,
      dismissible: placement === 'popup' ? true : dismissible,
      impressions: existing?.impressions || 0,
      clicks: existing?.clicks || 0
    };

    if (editingAdId) {
      await window.firebaseHelpers.fbSetDoc('ads', editingAdId, payload);
    } else {
      await window.firebaseHelpers.fbAddDoc('ads', payload);
    }
    recordDeveloperActivity(`${existing ? 'تعديل' : 'إضافة'} إعلان: ${title}`);
    resetAdForm();
    await renderDeveloperAds();
    renderDeveloperOverview();
    await renderHomeEvents();
    renderHomeAds();
    showToast(existing ? '✅ تم تحديث الإعلان' : '✅ تم نشر الإعلان');
  } catch (err) {
    showToast('تعذر الحفظ');
  }
}

async function deleteDeveloperAd(id) {
  if (!requireDeveloper() || !confirm('حذف الإعلان نهائيًا؟')) return;
  try {
    await window.firebaseHelpers.fbDeleteDoc('ads', id);
    if (String(editingAdId) === String(id)) resetAdForm();
    await renderDeveloperAds();
    renderDeveloperOverview();
    renderHomeAds();
    await renderHomeEvents();
    recordDeveloperActivity('حذف إعلان');
  } catch (err) {
    showToast('تعذر الحذف');
  }
}

async function toggleDeveloperAdStatus(id) {
  if (!requireDeveloper()) return;
  try {
    const ads = await getAdsFromFirebase();
    const item = ads.find(ad => ad.id === id);
    if (!item) return;
    await window.firebaseHelpers.fbSetDoc('ads', id, { active: item.active === false });
    await renderDeveloperAds();
    renderHomeAds();
    await renderHomeEvents();
    renderDeveloperOverview();
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

async function fillAdFormById(id) {
  const ad = (await getAdsFromFirebase()).find(item => item.id === id);
  if (ad) fillAdForm(ad);
}

async function renderDeveloperAds() {
  const list = document.getElementById('developerAdsList');
  if (!list) return;
  list.innerHTML = '<p class="developer-empty">⏳ جارٍ التحميل...</p>';

  try {
    const ads = await getAdsFromFirebase();
    const labels = {
      'home-top': '⬆️ أعلى',
      'home-mid': '↔️ وسط',
      'home-bottom': '⬇️ أسفل',
      popup: '🪟 منبثق'
    };
    list.innerHTML = ads.length ? ads.map(ad => {
      const ctr = ad.impressions ? ((Number(ad.clicks || 0) / ad.impressions) * 100).toFixed(1) : '0.0';
      return `
      <div class="developer-row">
        <div>
          <strong>${developerEscape(ad.title)}</strong>
          <small>
            ${developerEscape(labels[ad.placement] || ad.placement)}
            · ${contentStatusLabel(ad)}
            · 👁️ ${Number(ad.impressions || 0)}
            · 🖱️ ${Number(ad.clicks || 0)}
            · 🎯 ${ctr}%
          </small>
        </div>
        <div class="developer-row-actions">
          <button class="developer-mini-btn" onclick="fillAdFormById('${ad.id}')">✏️</button>
          <button class="developer-mini-btn" onclick="toggleDeveloperAdStatus('${ad.id}')">${ad.active === false ? '👁️' : '🚫'}</button>
          <button class="developer-delete-btn" onclick="deleteDeveloperAd('${ad.id}')">🗑️</button>
        </div>
      </div>
    `}).join('') : '<p class="developer-empty">لا توجد إعلانات</p>';
  } catch (err) {
    list.innerHTML = '<p class="developer-empty">تعذر التحميل</p>';
  }
}

/* ===== الإعلانات المخفية ===== */
function getDismissedAds() {
  const stored = getStoredJson(DEV_DISMISSED_ADS_KEY, []);
  return Array.isArray(stored) ? stored : [];
}

function dismissHomeAd(id) {
  const dismissed = new Set(getDismissedAds());
  dismissed.add(String(id));
  localStorage.setItem(DEV_DISMISSED_ADS_KEY, JSON.stringify([...dismissed]));
  document.getElementById('homeAdPopup')?.classList.remove('show');
  renderHomeEvents();
  renderHomeAds();
}

async function getActiveAds(placement) {
  const settings = getDeveloperSettings();
  if (!settings.enableAds) return [];
  if (placement === 'popup' && !settings.enablePopupAds) return [];
  const dismissed = new Set(getDismissedAds());
  const now = Date.now();
  const loggedIn = !!window.authApi?.getCurrentUser();
  const ads = await getAdsFromFirebase();
  return ads.filter(ad => {
    if (placement && ad.placement !== placement) return false;
    if (dismissed.has(String(ad.id)) && (ad.dismissible !== false || ad.placement === 'popup')) return false;
    if ((ad.audience === 'member' && !loggedIn) || (ad.audience === 'guest' && loggedIn)) return false;
    return isScheduleActive(ad, now);
  }).sort((a, b) => Number(b.priority || 50) - Number(a.priority || 50)).slice(0, settings.maxAdsPerSlot);
}

function bumpAdImpression(id) {
  if (viewedAds.has(String(id))) return;
  viewedAds.add(String(id));
  sessionStorage.setItem('tariq_viewed_ads', JSON.stringify([...viewedAds]));
}

function trackAdClick(id) {}

function renderAdCard(ad, variant = 'banner', preview = false) {
  const closeBtn = !preview && (ad.dismissible !== false || ad.placement === 'popup')
    ? `<button class="ad-dismiss" type="button" onclick="event.preventDefault(); event.stopPropagation(); dismissHomeAd('${developerEscape(ad.id)}')">✕</button>`
    : '';
  const image = LocalSecurity.safeUrl(ad.image || '');
  const link = LocalSecurity.safeUrl(ad.link || '');
  const media = image ? `<img src="${developerEscape(image)}" alt="" loading="lazy">` : '';
  const cta = link ? `<a class="ad-cta" href="${developerEscape(link)}" target="_blank" rel="noopener noreferrer">${developerEscape(ad.cta || 'معرفة المزيد')} ↗</a>` : '';
  const inner = `${closeBtn}${media}<div class="ad-copy"><span class="ad-kicker">إعلان</span><strong>${developerEscape(ad.title)}</strong><p>${developerEscape(ad.body || '')}</p>${cta}</div>`;
  return `<article class="home-ad-card ${variant}" ${preview ? '' : `data-ad-id="${developerEscape(ad.id)}"`}>${inner}</article>`;
}

function renderSlot(id, adsHtml) {
  const slot = document.getElementById(id);
  if (!slot) return;
  if (!adsHtml) {
    slot.innerHTML = '';
    slot.classList.add('hidden');
    return;
  }
  slot.classList.remove('hidden');
  slot.innerHTML = adsHtml;
}

async function renderHomeAds() {
  const settings = getDeveloperSettings();
  try {
    const top = settings.enableAds ? await getActiveAds('home-top') : [];
    const bottom = settings.enableAds ? await getActiveAds('home-bottom') : [];
    renderSlot('homeAdsTop', top.map(ad => renderAdCard(ad)).join(''));
    renderSlot('homeAdsBottom', bottom.map(ad => renderAdCard(ad)).join(''));
    await renderPopupAd();
    observeAdImpressions();
  } catch (err) {
    console.error('[Developer] renderHomeAds error:', err);
  }
}

async function renderPopupAd() {
  const popup = document.getElementById('homeAdPopup');
  if (!popup) return;
  const settings = getDeveloperSettings();
  const eligible = !developerUnlocked && !settings.maintenanceMode
    && !(settings.requireLogin && !window.authApi?.getCurrentUser());
  const ads = eligible && settings.enableAds && settings.enablePopupAds ? await getActiveAds('popup') : [];
  if (!ads.length) {
    popup.classList.remove('show');
    popup.innerHTML = '';
    return;
  }
  const ad = ads[0];
  if (popup.classList.contains('show') && popup.dataset.currentAd === ad.id) return;
  if (settings.popupOnce && sessionStorage.getItem('tariq_popup_shown')) {
    popup.classList.remove('show');
    return;
  }
  if (!document.getElementById('homeView')?.classList.contains('active')) return;
  popup.dataset.currentAd = ad.id;
  popup.classList.add('show');
  popup.innerHTML = `
    <div class="ad-popup-overlay" onclick="dismissHomeAd('${developerEscape(ad.id)}')"></div>
    <div class="ad-popup-card">${renderAdCard(ad, 'popup')}</div>
  `;
  sessionStorage.setItem('tariq_popup_shown', 'true');
}

/* ===== البانر والصيانة ===== */
function renderSiteBanner() {
  const banner = document.getElementById('siteBanner');
  if (!banner) return;
  const settings = getDeveloperSettings();
  if (!settings.siteBannerEnabled || !settings.siteBanner) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  banner.classList.remove('hidden');
  banner.textContent = settings.siteBanner;
}

function renderMaintenance() {
  const overlay = document.getElementById('maintenanceOverlay');
  if (!overlay) return;
  const settings = getDeveloperSettings();
  overlay.classList.toggle('show', !!settings.maintenanceMode && !developerUnlocked);
  const message = document.getElementById('maintenanceMessage');
  if (message) message.textContent = settings.maintenanceMessage || DEFAULT_DEV_SETTINGS.maintenanceMessage;
}

function refreshPublicSurfaces() {
  renderSiteBanner();
  renderMaintenance();
  renderHomeEvents();
  renderHomeAds();
  refreshHomeNewsTimer();
  if (typeof applyAuthGate === 'function') applyAuthGate();
  renderDeveloperOverview();
  window.authApi?.renderAuthWidget();
  window.authApi?.populateProfileData();
  if (typeof renderDevMessages === 'function') renderDevMessages();
}

/* ============================================
   المستخدمون + الحظر
   ============================================ */
async function renderRegisteredUsers() {
  const list = document.getElementById('developerUsersList');
  if (!list) return;
  list.innerHTML = '<p class="developer-empty">⏳ جارٍ التحميل...</p>';

  try {
    const users = await getUsersFromFirebase();
    const search = document.getElementById('developerUsersSearch')?.value.trim().toLowerCase() || '';
    const status = document.getElementById('developerUsersStatus')?.value || 'all';
    const filtered = users.filter(user => {
      const matches = `${user.username || ''} ${user.fullName || ''} ${user.email || ''}`.toLowerCase().includes(search);
      if (!matches) return false;
      if (status === 'all') return true;
      if (status === 'disabled') return user.disabled;
      if (status === 'banned') return user.banned;
      return !user.disabled && !user.banned;
    });

    if (!filtered.length) {
      list.innerHTML = '<p class="developer-empty">لا يوجد مستخدمون</p>';
      return;
    }

    list.innerHTML = filtered.map(user => `
      <div class="developer-row ${user.banned ? 'is-banned' : ''}">
        <div>
          <strong>
            ${user.banned ? '🚫 ' : ''}${developerEscape(user.fullName || user.username || '')}
          </strong>
          <small>
            @${developerEscape(user.username || '')}
            · ${developerEscape(user.email || 'بدون بريد')}
            · ${user.banned ? '🚫 محظور' : user.disabled ? '⛔ موقوف' : '✅ نشط'}
            ${user.lastLogin ? '· ' + formatDate(user.lastLogin) : ''}
          </small>
        </div>
        <div class="developer-row-actions">
          <button class="developer-mini-btn" onclick="toggleUserDisabled('${user.uid}', ${!user.disabled})">
            ${user.disabled ? '✅' : '⛔'}
          </button>
          <button class="developer-delete-btn" onclick="toggleUserBanned('${user.uid}', ${!user.banned})">
            ${user.banned ? '✅ إلغاء' : '🚫 حظر'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="developer-empty">تعذر التحميل</p>';
  }
}

async function toggleUserDisabled(uid, disabled) {
  if (!requireDeveloper()) return;
  try {
    await window.firebaseHelpers.fbSetDoc('users', uid, { disabled: !!disabled });
    await renderRegisteredUsers();
    renderDeveloperOverview();
    showToast(disabled ? '⛔ تم الإيقاف' : '✅ تم التفعيل');
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

async function toggleUserBanned(uid, banned) {
  if (!requireDeveloper()) return;
  const reason = banned ? (prompt('سبب الحظر:', 'انتهاك القوانين') || 'انتهاك القوانين') : '';
  try {
    await window.firebaseHelpers.fbSetDoc('users', uid, {
      banned: !!banned,
      banReason: reason,
      bannedAt: banned ? new Date().toISOString() : null
    });
    await renderRegisteredUsers();
    renderDeveloperOverview();
    renderBannedDevices();
    showToast(banned ? '🚫 تم الحظر' : '✅ تم إلغاء الحظر');
  } catch (err) {
    showToast('تعذر التحديث');
  }
}

/* ============================================
   نظام حظر الأجهزة — مع Cloud Sync
   ============================================ */
function getBannedDevices() {
  return getStoredJson(DEV_BANNED_DEVICES_KEY, []);
}

function saveBannedDevices(devices) {
  localStorage.setItem(DEV_BANNED_DEVICES_KEY, JSON.stringify(devices));
}

async function banDeviceFromPanel() {
  if (!requireDeveloper()) return;

  const input = document.getElementById('banDeviceInput');
  const reasonInput = document.getElementById('banDeviceReason');
  const fp = input?.value.trim() || '';
  const reason = reasonInput?.value.trim() || 'انتهاك القوانين';

  if (!fp) { showToast('أدخل بصمة الجهاز'); return; }

  const existing = getBannedDevices().find(d => d.fingerprint === fp);
  if (existing) { showToast('الجهاز محظور مسبقاً'); return; }

  const device = {
    fingerprint: fp,
    reason,
    bannedAt: new Date().toISOString(),
    bannedBy: window.authApi?.getCurrentUser()?.email || 'developer'
  };

  if (window.cloudSync) {
    const success = await window.cloudSync.addBanned(device);
    if (!success) {
      showToast('تعذر الحظر — تحقق من Firebase');
      return;
    }
    await window.cloudSync.loadBanned();
  } else {
    const devices = getBannedDevices();
    devices.push(device);
    saveBannedDevices(devices);
  }

  if (input) input.value = '';
  if (reasonInput) reasonInput.value = '';

  renderBannedDevices();
  renderDeveloperOverview();
  showToast('🚫 تم حظر الجهاز لجميع الأجهزة');
}

async function unbanDevice(id) {
  if (!requireDeveloper()) return;
  if (!confirm('إلغاء الحظر؟')) return;

  if (window.cloudSync) {
    await window.cloudSync.removeBanned(id);
    await window.cloudSync.loadBanned();
  } else {
    const devices = getBannedDevices().filter(d => d.id !== id && d.fingerprint !== id);
    saveBannedDevices(devices);
  }

  renderBannedDevices();
  renderDeveloperOverview();
  showToast('✅ تم إلغاء الحظر');
}

function banMyDevice() {
  if (!requireDeveloper()) return;
  if (!confirm('⚠️ حظر جهازك الحالي؟ ستفقد الوصول للنظام.')) return;
  if (typeof banCurrentDevice === 'function') {
    banCurrentDevice('حظر ذاتي من المطور');
    showToast('🚫 تم حظر جهازك');
  }
}

function renderBannedDevices() {
  const list = document.getElementById('bannedDevicesList');
  const countEl = document.getElementById('bannedDevicesCount');
  if (!list) return;

  const devices = getBannedDevices();
  if (countEl) countEl.textContent = String(devices.length);

  const myFp = typeof getDeviceFingerprint === 'function' ? getDeviceFingerprint() : '';

  if (!devices.length) {
    list.innerHTML = '<p class="developer-empty">لا توجد أجهزة محظورة</p>';
    return;
  }

  list.innerHTML = devices.map(device => {
    const id = device.id || device.fingerprint;
    return `
      <div class="developer-row">
        <div>
          <strong>
            ${device.fingerprint === myFp ? '📱 (جهازك)' : '🖥️'} 
            <code style="font-size:0.75rem;color:var(--gold-soft);">${developerEscape((device.fingerprint || '').slice(0, 16))}...</code>
          </strong>
          <small>
            ${developerEscape(device.reason || 'بدون سبب')}
            · ${formatDate(device.bannedAt)}
            ${device.bannedBy ? '· ' + developerEscape(device.bannedBy) : ''}
          </small>
        </div>
        <div class="developer-row-actions">
          <button class="developer-delete-btn" onclick="unbanDevice('${developerEscape(id)}')">✅ إلغاء</button>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== التصدير ===== */
async function exportDeveloperData() {
  if (!requireDeveloper()) return;
  try {
    const [news, ads, users] = await Promise.all([
      getNewsFromFirebase(),
      getAdsFromFirebase(),
      getUsersFromFirebase()
    ]);
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: getDeveloperSettings(),
      features: typeof getFeatures === 'function' ? getFeatures() : {},
      messages: getDevMessages(),
      bannedDevices: getBannedDevices(),
      news, ads, users
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tariq-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('✅ تم التصدير');
  } catch (err) {
    showToast('تعذر التصدير');
  }
}

function resetDismissedAds() {
  if (!requireDeveloper()) return;
  localStorage.removeItem(DEV_DISMISSED_ADS_KEY);
  sessionStorage.removeItem('tariq_popup_shown');
  refreshPublicSurfaces();
  showToast('✅ تمت إعادة الإظهار');
}

/* ===== النشاط ===== */
function recordDeveloperActivity(message) {
  const activity = getStoredJson(DEV_ACTIVITY_KEY, []);
  try {
    localStorage.setItem(DEV_ACTIVITY_KEY, JSON.stringify([{ message, time: Date.now() }, ...activity].slice(0, 50)));
    renderDeveloperActivity();
  } catch {}
}

function renderDeveloperActivity() {
  const container = document.getElementById('developerActivity');
  if (!container) return;
  const activity = getStoredJson(DEV_ACTIVITY_KEY, []);
  container.innerHTML = activity.length
    ? activity.slice(0, 10).map(item =>
      `<div class="developer-row"><strong>${developerEscape(item.message)}</strong><small>${formatDate(new Date(item.time).toISOString())}</small></div>`
    ).join('')
    : '<p class="developer-empty">لا توجد نشاطات بعد</p>';
}

/* ===== التحديث التلقائي ===== */
function refreshHomeNewsTimer() {
  if (homeNewsRefreshTimer) clearInterval(homeNewsRefreshTimer);
  const settings = getDeveloperSettings();
  if (!settings.autoRefreshMinutes) return;
  homeNewsRefreshTimer = setInterval(() => {
    renderHomeEvents();
    renderHomeAds();
    renderDevMessages();
  }, Number(settings.autoRefreshMinutes) * 60 * 1000);
}

/* ===== حماية المطور ===== */
function requireDeveloper() {
  if (!developerUnlocked || Date.now() - developerLastActive >= 15 * 60 * 1000) {
    if (developerUnlocked) lockDeveloperPanel();
    showToast('سجّل دخول المطور أولاً');
    return false;
  }
  developerLastActive = Date.now();
  return true;
}

function runDeveloperAction(action) {
  try {
    const result = action();
    if (result && typeof result.catch === 'function') {
      result.catch(error => showToast(error.message || 'تعذر تنفيذ العملية'));
    }
  } catch (error) {
    showToast(error.message || 'تعذر تنفيذ العملية');
  }
}

/* ===== Preview ===== */
function previewContentImage(kind) {
  const prefix = kind === 'news' ? 'developerEvent' : 'developerAd';
  const image = LocalSecurity.safeUrl(document.getElementById(`${prefix}Image`).value.trim());
  const target = document.getElementById(kind === 'news' ? 'developerImagePreview' : 'developerAdImagePreview');
  if (image) target.src = image;
  else target.removeAttribute('src');
}

function previewContent(kind) {
  if (!requireDeveloper()) return;
  const prefix = kind === 'news' ? 'developerEvent' : 'developerAd';
  const title = document.getElementById(`${prefix}Title`).value.trim() || 'عنوان المحتوى';
  const image = LocalSecurity.safeUrl(document.getElementById(`${prefix}Image`).value.trim());
  const body = document.getElementById(kind === 'news' ? 'developerEventDescription' : 'developerAdBody').value;
  const target = document.getElementById('contentPreviewBody');
  if (kind === 'ads') {
    target.innerHTML = renderAdCard({
      title, image, body,
      link: document.getElementById('developerAdLink').value,
      cta: document.getElementById('developerAdCta').value
    }, 'preview', true);
  } else {
    target.innerHTML = `<article class="home-event-card">${image ? `<img src="${developerEscape(image)}" alt="">` : ''}<div class="home-event-copy"><span class="home-event-label">خبر</span><h2>${developerEscape(title)}</h2><p>${developerEscape(body)}</p></div></article>`;
  }
  document.getElementById('contentPreviewModal').classList.add('show');
}

function closeContentPreview() {
  document.getElementById('contentPreviewModal')?.classList.remove('show');
}

/* ===== مراقبة الإعلانات ===== */
function observeAdImpressions() {
  if (typeof IntersectionObserver === 'undefined') return;
  if (!adObserver) {
    adObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !document.hidden) {
          bumpAdImpression(entry.target.dataset.adId);
          adObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
  }
  document.querySelectorAll('[data-ad-id]').forEach(element => {
    if (!viewedAds.has(element.dataset.adId)) adObserver.observe(element);
  });
}

/* ============================================
   الميزات
   ============================================ */
function renderFeaturesGrid() {
  const container = document.getElementById('featuresGrid');
  const statsEl = document.getElementById('featuresStats');
  if (!container) return;

  const features = typeof getFeatures === 'function' ? getFeatures() : {};
  const allFeatures = window.ALL_FEATURES || {};
  const categories = window.FEATURE_CATEGORIES || {};

  if (statsEl) {
    const total = Object.keys(allFeatures).length;
    const enabled = Object.values(features).filter(v => v !== false).length;
    statsEl.innerHTML = `
      <div class="feature-stat-card"><strong>${total}</strong><span>إجمالي</span></div>
      <div class="feature-stat-card"><strong style="color:#7fe8a8">${enabled}</strong><span>مفعّلة</span></div>
      <div class="feature-stat-card"><strong style="color:#ff8a7a">${total - enabled}</strong><span>معطّلة</span></div>
    `;
  }

  const grouped = {};
  Object.entries(allFeatures).forEach(([key, data]) => {
    const cat = data.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...data });
  });

  let html = '';
  Object.entries(categories).forEach(([catKey, catData]) => {
    if (!grouped[catKey]) return;
    html += `
      <div class="feature-category-group">
        <h3 class="feature-category-title">
          <span>${catData.icon}</span><span>${catData.label}</span>
        </h3>
        <div class="feature-category-items">
          ${grouped[catKey].map(f => {
            const enabled = features[f.key] !== false;
            return `
              <div class="feature-toggle-card ${enabled ? '' : 'disabled'}">
                <div class="feature-toggle-icon">${f.icon}</div>
                <div class="feature-toggle-info">
                  <strong>${f.label}</strong>
                  <small>${f.description || ''}</small>
                </div>
                <label class="feature-switch">
                  <input type="checkbox" ${enabled ? 'checked' : ''} onchange="handleFeatureToggle('${f.key}', this.checked)">
                  <span class="feature-switch-slider"></span>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<p class="developer-empty">لا توجد ميزات</p>';
}

async function handleFeatureToggle(key, enabled) {
  if (!requireDeveloper()) return;
  if (typeof toggleFeature !== 'function') return;
  const newState = await toggleFeature(key);
  const label = window.ALL_FEATURES[key]?.label || key;
  showToast(newState ? `✅ ${label}` : `🚫 ${label}`);
  renderFeaturesGrid();
  recordDeveloperActivity(`${newState ? 'تفعيل' : 'تعطيل'} ${label}`);
}

/* ============================================
   الرسائل — مع Cloud Sync
   ============================================ */
function getDevMessages() {
  try {
    const raw = localStorage.getItem(DEV_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDevMessages(messages) {
  try { localStorage.setItem(DEV_MESSAGES_KEY, JSON.stringify(messages)); } catch {}
}

async function addDevMessage() {
  if (!requireDeveloper()) return;

  const titleEl = document.getElementById('devMessageTitle');
  const bodyEl = document.getElementById('devMessageBody');
  const iconEl = document.getElementById('devMessageIcon');
  const colorEl = document.getElementById('devMessageColor');
  const dismissibleEl = document.getElementById('devMessageDismissible');

  const title = titleEl?.value.trim() || '';
  const body = bodyEl?.value.trim() || '';

  if (!title) { showToast('اكتب عنوان الرسالة'); return; }

  const message = {
    title, body,
    icon: iconEl?.value || '📢',
    color: colorEl?.value || 'gold',
    dismissible: dismissibleEl?.checked !== false,
    createdAt: Date.now(),
    active: true,
    createdBy: window.authApi?.getCurrentUser()?.email || 'developer'
  };

  if (window.cloudSync) {
    const success = await window.cloudSync.addMessage(message);
    if (!success) {
      showToast('تعذر الحفظ في السحابة');
      return;
    }
    await window.cloudSync.loadMessages();
  } else {
    const messages = getDevMessages();
    message.id = 'msg_' + Date.now();
    messages.unshift(message);
    saveDevMessages(messages);
  }

  if (titleEl) titleEl.value = '';
  if (bodyEl) bodyEl.value = '';

  renderDevMessagesList();
  renderDevMessages();
  recordDeveloperActivity(`رسالة: ${title}`);
  showToast('✅ تم النشر لجميع الزوار');
}

async function deleteDevMessage(id) {
  if (!requireDeveloper()) return;
  if (!confirm('حذف الرسالة؟')) return;

  if (window.cloudSync) {
    const success = await window.cloudSync.deleteMessage(id);
    if (!success) {
      showToast('تعذر الحذف');
      return;
    }
    await window.cloudSync.loadMessages();
  } else {
    const messages = getDevMessages().filter(m => m.id !== id);
    saveDevMessages(messages);
  }

  renderDevMessagesList();
  renderDevMessages();
  showToast('✅ تم الحذف');
}

async function toggleDevMessageStatus(id) {
  if (!requireDeveloper()) return;

  const messages = getDevMessages();
  const msg = messages.find(m => m.id === id);
  if (!msg) return;

  const newActive = !msg.active;

  if (window.cloudSync) {
    await window.cloudSync.updateMessage(id, { active: newActive });
    await window.cloudSync.loadMessages();
  } else {
    msg.active = newActive;
    saveDevMessages(messages);
  }

  renderDevMessagesList();
  renderDevMessages();
}

function renderDevMessages() {
  const container = document.getElementById('devMessagesContainer');
  if (!container) return;

  if (typeof isFeatureEnabled === 'function' && !isFeatureEnabled('messages_system')) {
    container.innerHTML = '';
    return;
  }

  const messages = getDevMessages().filter(m => m.active !== false);
  const existingIds = new Set(messages.map(m => m.id));

  container.querySelectorAll('.dev-message').forEach(el => {
    if (!existingIds.has(el.dataset.id)) {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }
  });

  messages.forEach(msg => {
    if (container.querySelector(`[data-id="${msg.id}"]`)) return;

    let dismissed = [];
    try { dismissed = JSON.parse(sessionStorage.getItem('dismissed_dev_messages') || '[]'); } catch {}
    if (dismissed.includes(msg.id)) return;

    const el = document.createElement('div');
    el.className = 'dev-message';
    el.dataset.id = msg.id;
    el.dataset.color = msg.color;

    const dismissBtn = msg.dismissible !== false
      ? `<button class="dev-message-close" onclick="dismissDevMessage('${msg.id}')" aria-label="إغلاق">✕</button>`
      : '';

    el.innerHTML = `
      ${dismissBtn}
      <div class="dev-message-icon">${msg.icon || '📢'}</div>
      <div class="dev-message-content">
        <strong class="dev-message-title">${developerEscape(msg.title)}</strong>
        ${msg.body ? `<p class="dev-message-body">${developerEscape(msg.body)}</p>` : ''}
      </div>
    `;

    container.appendChild(el);
    requestAnimationFrame(() => setTimeout(() => el.classList.add('show'), 50));
  });
}

function dismissDevMessage(id) {
  const el = document.querySelector(`.dev-message[data-id="${id}"]`);
  if (el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }
  try {
    const dismissed = JSON.parse(sessionStorage.getItem('dismissed_dev_messages') || '[]');
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      sessionStorage.setItem('dismissed_dev_messages', JSON.stringify(dismissed));
    }
  } catch {}
}

function renderDevMessagesList() {
  const list = document.getElementById('devMessagesList');
  if (!list) return;

  const messages = getDevMessages();
  if (!messages.length) {
    list.innerHTML = '<p class="developer-empty">لا توجد رسائل</p>';
    return;
  }

  const colors = { gold: '🟡', green: '🟢', blue: '🔵', red: '🔴', purple: '🟣' };

  list.innerHTML = messages.map(msg => `
    <div class="developer-row">
      <div>
        <strong>${msg.icon} ${developerEscape(msg.title)}</strong>
        <small>
          ${msg.body ? developerEscape(msg.body.slice(0, 60)) : ''}
          · ${colors[msg.color] || msg.color}
          · ${msg.active !== false ? '✅' : '🚫'}
          · ${formatDate(new Date(msg.createdAt).toISOString())}
        </small>
      </div>
      <div class="developer-row-actions">
        <button class="developer-mini-btn" onclick="toggleDevMessageStatus('${msg.id}')">${msg.active !== false ? '🚫' : '👁️'}</button>
        <button class="developer-delete-btn" onclick="deleteDevMessage('${msg.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function previewDevMessage() {
  const title = document.getElementById('devMessageTitle')?.value.trim() || 'عنوان تجريبي';
  const body = document.getElementById('devMessageBody')?.value.trim() || '';
  const icon = document.getElementById('devMessageIcon')?.value || '📢';
  const color = document.getElementById('devMessageColor')?.value || 'gold';

  const container = document.getElementById('devMessagesContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'dev-message show';
  el.dataset.color = color;
  el.dataset.preview = 'true';
  el.innerHTML = `
    <button class="dev-message-close" onclick="this.parentElement.remove()">✕</button>
    <div class="dev-message-icon">${icon}</div>
    <div class="dev-message-content">
      <strong class="dev-message-title">${developerEscape(title)}</strong>
      ${body ? `<p class="dev-message-body">${developerEscape(body)}</p>` : ''}
    </div>
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/* ===== بدء ===== */
document.addEventListener('DOMContentLoaded', () => {
  refreshPublicSurfaces();

  document.getElementById('developerLoginForm')?.addEventListener('submit', handleDeveloperLoginSubmit);
  document.getElementById('developerLoginClose')?.addEventListener('click', closeDeveloperLoginModal);
  document.getElementById('developerLoginOverlay')?.addEventListener('click', closeDeveloperLoginModal);

  document.querySelectorAll('.home-version, .app-version, .home-footer-version').forEach(el => {
    el.addEventListener('click', () => {
      versionTapCount += 1;
      clearTimeout(versionTapTimer);
      versionTapTimer = setTimeout(() => { versionTapCount = 0; }, 1800);
      if (versionTapCount >= 5) {
        versionTapCount = 0;
        openDeveloperPanel();
      }
    });
  });

  if (location.hash === '#developer') openDeveloperPanel();

  const noteActivity = () => {
    if (!developerUnlocked) return;
    if (Date.now() - developerLastActive >= 15 * 60 * 1000) lockDeveloperPanel();
    else developerLastActive = Date.now();
  };
  document.addEventListener('pointerdown', noteActivity);
  document.addEventListener('keydown', noteActivity);

  setInterval(() => {
    if (developerUnlocked && Date.now() - developerLastActive >= 15 * 60 * 1000) {
      lockDeveloperPanel();
      showToast('انتهت جلسة المطور');
    }
  }, 30000);

  setInterval(() => {
    renderHomeEvents();
    renderHomeAds();
    renderDevMessages();
  }, 60000);

  setTimeout(renderDevMessages, 1500);
});

document.addEventListener('keydown', event => {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    openDeveloperPanel();
  }
});

/* ===== تصدير ===== */
window.getDeveloperSettings = getDeveloperSettings;
window.openDeveloperPanel = openDeveloperPanel;
window.lockDeveloperPanel = lockDeveloperPanel;
window.saveDeveloperSettings = saveDeveloperSettings;
window.changeDeveloperPassword = changeDeveloperPassword;
window.saveDeveloperEvent = saveDeveloperEvent;
window.deleteDeveloperEvent = deleteDeveloperEvent;
window.toggleDeveloperEventStatus = toggleDeveloperEventStatus;
window.toggleDeveloperEventFeatured = toggleDeveloperEventFeatured;
window.toggleDeveloperEventPinned = toggleDeveloperEventPinned;
window.fillNewsFormById = fillNewsFormById;
window.resetNewsForm = resetNewsForm;
window.saveDeveloperAd = saveDeveloperAd;
window.deleteDeveloperAd = deleteDeveloperAd;
window.toggleDeveloperAdStatus = toggleDeveloperAdStatus;
window.fillAdFormById = fillAdFormById;
window.resetAdForm = resetAdForm;
window.dismissHomeAd = dismissHomeAd;
window.trackAdClick = trackAdClick;
window.switchDeveloperTab = switchDeveloperTab;
window.exportDeveloperData = exportDeveloperData;
window.renderHomeEvents = renderHomeEvents;
window.renderHomeAds = renderHomeAds;
window.renderSiteBanner = renderSiteBanner;
window.renderMaintenance = renderMaintenance;
window.renderRegisteredUsers = renderRegisteredUsers;
window.renderDeveloperEvents = renderDeveloperEvents;
window.renderDeveloperAds = renderDeveloperAds;
window.renderDeveloperOverview = renderDeveloperOverview;
window.renderAdvancedStats = renderAdvancedStats;
window.attemptDeveloperUnlock = attemptDeveloperUnlock;
window.getActiveAds = getActiveAds;
window.renderAdCard = renderAdCard;
window.observeAdImpressions = observeAdImpressions;
window.toggleUserDisabled = toggleUserDisabled;
window.toggleUserBanned = toggleUserBanned;

window.devClearCache = devClearCache;
window.devReloadPage = devReloadPage;
window.devReinstallSW = devReinstallSW;
window.devShowStorageInfo = devShowStorageInfo;
window.devTestFirebase = devTestFirebase;
window.devClearAllData = devClearAllData;
window.devFullDiagnostic = devFullDiagnostic;
window.devShowErrors = devShowErrors;
window.devOptimizePerformance = devOptimizePerformance;
window.devTestNotifications = devTestNotifications;
window.devClearCacheAndSW = devClearCacheAndSW;
window.devSyncCloud = devSyncCloud;
window.devClearIndexedDB = devClearIndexedDB;
window.devShowAnalytics = devShowAnalytics;

window.renderFeaturesGrid = renderFeaturesGrid;
window.handleFeatureToggle = handleFeatureToggle;

window.addDevMessage = addDevMessage;
window.deleteDevMessage = deleteDevMessage;
window.toggleDevMessageStatus = toggleDevMessageStatus;
window.dismissDevMessage = dismissDevMessage;
window.renderDevMessages = renderDevMessages;
window.renderDevMessagesList = renderDevMessagesList;
window.previewDevMessage = previewDevMessage;
window.getDevMessages = getDevMessages;

window.getBannedDevices = getBannedDevices;
window.banDeviceFromPanel = banDeviceFromPanel;
window.unbanDevice = unbanDevice;
window.banMyDevice = banMyDevice;
window.renderBannedDevices = renderBannedDevices;