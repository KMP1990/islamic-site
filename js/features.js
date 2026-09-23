/* ===== نظام إدارة الميزات — مع Cloud Sync v3 (مع الأصدقاء) ===== */

const FEATURES_KEY = 'tariq_features_v1';
const FEATURES_VERSION = 3;

/* ===== جميع الميزات المتاحة ===== */
const ALL_FEATURES = {
  home: { label: 'الصفحة الرئيسية', icon: '🏠', description: 'صفحة الترحيب مع آية اليوم والصلاة القادمة', category: 'core' },
  quran: { label: 'القرآن الكريم', icon: '📖', description: 'قراءة السور مع التفسير والمفضلة', category: 'core' },
  listen: { label: 'الاستماع', icon: '🎧', description: 'الاستماع للقرّاء + المشغل المتقدم', category: 'core' },
  prayer: { label: 'مواقيت الصلاة', icon: '🕌', description: 'أوقات الصلاة + الإشعارات + الأذان', category: 'core' },
  friends: { label: 'نظام الأصدقاء', icon: '👥', description: 'محادثات ومجموعات وقائمة أصدقاء', category: 'core' },
  qibla: { label: 'القبلة', icon: '🧭', description: 'بوصلة القبلة + كاميرا AR + مؤشر الكعبة', category: 'tools' },
  names: { label: 'أسماء الله الحسنى', icon: '✨', description: 'الأسماء الـ 99 مع المفضلة', category: 'spiritual' },
  ziyarat: { label: 'الزيارات', icon: '📿', description: 'الزيارات والأدعية مع الصوت', category: 'spiritual' },
  istikhara: { label: 'الاستخارة', icon: '🎲', description: 'نظام الاستخارة الذكية', category: 'spiritual' },
  stats: { label: 'إحصائياتي', icon: '📊', description: 'تقدمك في القراءة والاستماع', category: 'core' },
  ads: { label: 'نظام الإعلانات', icon: '💰', description: 'عرض الإعلانات للزوار', category: 'system' },
  news: { label: 'نظام الأخبار', icon: '📰', description: 'عرض الأخبار في الرئيسية', category: 'system' },
  auth: { label: 'نظام الحسابات', icon: '👤', description: 'تسجيل الدخول + الملف الشخصي', category: 'system' },
  popup_ads: { label: 'الإعلانات المنبثقة', icon: '🪟', description: 'النوافذ المنبثقة للإعلانات', category: 'system' },
  messages_system: { label: 'نظام الرسائل', icon: '📢', description: 'رسائل المطور المنبثقة', category: 'system' },
  chat_system: { label: 'نظام الدردشة', icon: '💬', description: 'المحادثات الفورية بين المستخدمين', category: 'system' },
  groups_system: { label: 'نظام القروبات', icon: '👨‍👩‍👦', description: 'إنشاء وإدارة القروبات', category: 'system' },
  pwa_install: { label: 'زر تثبيت PWA', icon: '📱', description: 'زر تثبيت التطبيق على الجهاز', category: 'ui' },
  theme_switcher: { label: 'مبدّل الثيمات', icon: '🎨', description: 'زر تبديل الألوان', category: 'ui' },
  lang_switcher: { label: 'مبدّل اللغة', icon: '🌐', description: 'تبديل بين العربية والإنجليزية', category: 'ui' },
  global_back_btn: { label: 'زر الرجوع الدائمي', icon: '⬅️', description: 'زر عائم للعودة للرئيسية', category: 'ui' },
  reading_settings_btn: { label: 'زر إعدادات القراءة', icon: '⚙️', description: 'الزر العائم داخل السور', category: 'ui' }
};

const FEATURE_CATEGORIES = {
  core: { label: 'الأقسام الأساسية', icon: '📱' },
  tools: { label: 'الأدوات', icon: '🛠️' },
  spiritual: { label: 'القسم الروحاني', icon: '🌙' },
  system: { label: 'الأنظمة', icon: '⚙️' },
  ui: { label: 'عناصر الواجهة', icon: '🎨' }
};

const DEFAULT_FEATURES = {
  home: true,
  quran: true,
  listen: true,
  prayer: true,
  friends: true,
  qibla: true,
  names: true,
  ziyarat: true,
  istikhara: true,
  stats: true,
  ads: true,
  news: true,
  auth: true,
  popup_ads: true,
  messages_system: true,
  chat_system: true,
  groups_system: true,
  pwa_install: true,
  theme_switcher: true,
  lang_switcher: true,
  global_back_btn: true,
  reading_settings_btn: true
};

/* ===== تحميل الإعدادات ===== */
function getFeatures() {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (!raw) return { ...DEFAULT_FEATURES };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_FEATURES, ...saved };
  } catch (e) {
    return { ...DEFAULT_FEATURES };
  }
}

/* ✅ حفظ محلي + سحابي */
async function saveFeatures(features) {
  try {
    localStorage.setItem(FEATURES_KEY, JSON.stringify(features));

    /* ✅ مزامنة مع Firebase */
    if (window.cloudSync && window.authApi?.getCurrentUser()) {
      const isDeveloper = typeof developerUnlocked !== 'undefined' && developerUnlocked;
      if (isDeveloper) {
        await window.cloudSync.saveFeatures(features);
      }
    }
  } catch (e) {
    console.error('[Features] Save failed:', e);
  }
}

function isFeatureEnabled(name) {
  return getFeatures()[name] !== false;
}

async function toggleFeature(name) {
  const features = getFeatures();
  features[name] = !features[name];
  await saveFeatures(features);
  applyFeatures();
  return features[name];
}

/* ===== تطبيق الميزات على الواجهة ===== */
function applyFeatures() {
  const features = getFeatures();

  /* --- إخفاء/إظهار الأقسام في Sidebar --- */
  const navMap = {
    home: 0,
    quran: 1,
    listen: 2,
    prayer: 3,
    friends: 4,        // ✅ جديد — بعد مواقيت الصلاة
    qibla: 5,
    names: 6,
    ziyarat: 7,
    istikhara: 8,
    stats: 9
  };
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  Object.entries(navMap).forEach(([key, index]) => {
    if (navItems[index]) {
      navItems[index].style.display = features[key] ? '' : 'none';
    }
  });

  /* --- إخفاء الأقسام من الصفحة --- */
  const sectionMap = {
    home: 'homeView',
    quran: 'surahsView',
    listen: 'recitersView',
    prayer: 'prayerView',
    friends: 'friendsView',      // ✅ جديد
    qibla: 'qiblaView',
    names: 'namesView',
    ziyarat: 'ziyaratListView',
    istikhara: 'istikharaView',
    stats: 'statsView'
  };
  Object.entries(sectionMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = features[key] ? '' : 'none';
  });

  /* --- عناصر الواجهة --- */
  const themeSwitcher = document.querySelector('.theme-switcher');
  if (themeSwitcher) themeSwitcher.style.display = features.theme_switcher ? '' : 'none';

  const langSwitcher = document.querySelector('.lang-switcher');
  if (langSwitcher) langSwitcher.style.display = features.lang_switcher ? '' : 'none';

  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) installBtn.style.display = features.pwa_install ? '' : 'none';

  const backBtn = document.getElementById('globalBackBtn');
  if (backBtn && !features.global_back_btn) backBtn.classList.remove('visible');

  /* --- زر إعدادات القراءة --- */
  if (typeof updateSurahSettingsBtn === 'function') updateSurahSettingsBtn();

  /* --- الأنظمة --- */
  if (!features.ads) {
    document.querySelectorAll('.home-ads-slot').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.home-ads-slot').forEach(el => el.style.display = '');
  }

  if (!features.news) {
    const newsSection = document.getElementById('homeNewsSection');
    if (newsSection) newsSection.style.display = 'none';
  } else {
    const newsSection = document.getElementById('homeNewsSection');
    if (newsSection) newsSection.style.display = '';
  }

  /* --- نظام الرسائل --- */
  if (!features.messages_system) {
    const container = document.getElementById('devMessagesContainer');
    if (container) container.style.display = 'none';
  } else {
    const container = document.getElementById('devMessagesContainer');
    if (container) container.style.display = '';
  }

  /* --- نظام الدردشة --- */
  if (!features.chat_system) {
    const chatWindow = document.getElementById('chatWindow');
    if (chatWindow) {
      chatWindow.classList.remove('open');
      chatWindow.style.display = 'none';
    }
  } else {
    const chatWindow = document.getElementById('chatWindow');
    if (chatWindow) chatWindow.style.display = '';
  }
}

/* ===== إحصائيات الميزات ===== */
function getFeaturesStats() {
  const features = getFeatures();
  const total = Object.keys(ALL_FEATURES).length;
  const enabled = Object.values(features).filter(v => v === true).length;
  return { total, enabled, disabled: total - enabled };
}

async function resetFeatures() {
  await saveFeatures({ ...DEFAULT_FEATURES });
  applyFeatures();
}

/* ===== التصدير ===== */
window.getFeatures = getFeatures;
window.saveFeatures = saveFeatures;
window.isFeatureEnabled = isFeatureEnabled;
window.toggleFeature = toggleFeature;
window.applyFeatures = applyFeatures;
window.getFeaturesStats = getFeaturesStats;
window.resetFeatures = resetFeatures;
window.ALL_FEATURES = ALL_FEATURES;
window.FEATURE_CATEGORIES = FEATURE_CATEGORIES;

/* ===== تطبيق تلقائي عند التحميل ===== */
document.addEventListener('DOMContentLoaded', () => {
  applyFeatures();
  setTimeout(applyFeatures, 500);
});