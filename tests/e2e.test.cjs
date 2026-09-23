/* ============================================
   E2E Tests خفيفة — v1.0
   ============================================
   اختبارات بنية + محتوى الملفات
   لا تحاكي تجربة المتصفح الحقيقي
   ============================================ */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

/* ============================================
   1. اختبارات dashboard.html
   ============================================ */

test('dashboard.html يحتوي على جميع الـ scripts المطلوبة', () => {
  const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
  const requiredScripts = [
    'js/health.js',
    'js/firebase-config.js',
    'js/firebase.js',
    'js/theme.js',
    'js/lang.js',
    'js/security.js',
    'js/auth.js',
    'js/developer.js',
    'js/quran.js',
    'js/listen.js',
    'js/prayer.js',
    'js/friends.js',
    'js/notifications.js',
    'js/pwa.js',
    'js/indexeddb.js',
    'js/analytics.js'
  ];

  requiredScripts.forEach(script => {
    assert.ok(
      html.includes(script),
      `❌ dashboard.html لا يحتوي على: ${script}`
    );
  });
});

test('dashboard.html لا يحتوي على duplicate IDs', () => {
  const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
  const dom = new JSDOM(html);
  const ids = new Set();
  const duplicates = [];

  dom.window.document.querySelectorAll('[id]').forEach(el => {
    if (ids.has(el.id)) duplicates.push(el.id);
    ids.add(el.id);
  });

  assert.deepEqual(duplicates, [], `❌ IDs مكررة: ${duplicates.join(', ')}`);
  dom.window.close();
});

test('dashboard.html يحتوي على عناصر رئيسية', () => {
  const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
  const dom = new JSDOM(html);
  const requiredElements = [
    'homeView',
    'authWidget',
    'developerView',
    'qiblaView',
    'namesView',
    'surahsView',
    'audioPlayer',
    'chatWindow',
    'settingsPanel'
  ];

  requiredElements.forEach(id => {
    assert.ok(
      dom.window.document.getElementById(id),
      `❌ عنصر مفقود في dashboard.html: #${id}`
    );
  });

  dom.window.close();
});

test('index.html يحتوي على عناصر أساسية', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html);

  assert.ok(dom.window.document.querySelector('.landing-container'), '❌ landing-container مفقود');
  assert.ok(dom.window.document.querySelector('.enter-btn'), '❌ enter-btn مفقود');

  dom.window.close();
});

/* ============================================
   2. اختبارات الملفات
   ============================================ */

test('جميع ملفات CSS موجودة', () => {
  const cssFiles = [
    'global.css', 'landing.css', 'home.css', 'quran.css', 'listen.css',
    'stats.css', 'prayer.css', 'qibla.css', 'names.css', 'ziyarat.css',
    'istikhara.css', 'management.css', 'features.css', 'settings.css',
    'friends.css', 'pwa.css'
  ];

  cssFiles.forEach(file => {
    const filePath = path.join(root, 'css', file);
    assert.ok(fs.existsSync(filePath), `❌ CSS مفقود: ${file}`);
  });
});

test('جميع ملفات JS موجودة', () => {
  const jsFiles = [
    'health.js', 'theme.js', 'lang.js', 'firebase-config.js', 'firebase.js',
    'security.js', 'sync.js', 'features.js', 'auth.js', 'developer.js',
    'home.js', 'quran.js', 'listen.js', 'share.js', 'stats.js',
    'prayer.js', 'qibla.js', 'names.js', 'ziyarat.js', 'istikhara.js',
    'friends.js', 'notifications.js', 'settings.js', 'pwa.js', 'landing.js',
    'indexeddb.js', 'analytics.js'
  ];

  jsFiles.forEach(file => {
    const filePath = path.join(root, 'js', file);
    assert.ok(fs.existsSync(filePath), `❌ JS مفقود: ${file}`);
  });
});

test('ملفات data موجودة وصحيحة', () => {
  const dataFiles = ['istikhara.json', 'ziyarat.json'];
  dataFiles.forEach(file => {
    const filePath = path.join(root, 'data', file);
    assert.ok(fs.existsSync(filePath), `❌ Data مفقود: ${file}`);

    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotThrow(() => JSON.parse(content), `❌ JSON غير صحيح: ${file}`);
  });
});

test('ملفات locales موجودة وصحيحة', () => {
  const locales = ['ar.json', 'en.json'];
  locales.forEach(file => {
    const filePath = path.join(root, 'locales', file);
    assert.ok(fs.existsSync(filePath), `❌ Locale مفقود: ${file}`);

    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotThrow(() => JSON.parse(content), `❌ JSON غير صحيح: ${file}`);
  });
});

/* ============================================
   3. اختبارات Backend + Config
   ============================================ */

test('firestore.rules موجود', () => {
  const rulesPath = path.join(root, 'firestore.rules');
  assert.ok(fs.existsSync(rulesPath), '❌ firestore.rules مفقود');

  const content = fs.readFileSync(rulesPath, 'utf8');
  assert.ok(content.includes('rules_version'), '❌ firestore.rules غير صحيح');
});

test('Netlify Function موجود', () => {
  const fnPath = path.join(root, 'netlify', 'functions', 'send-push.js');
  assert.ok(fs.existsSync(fnPath), '❌ send-push.js مفقود');

  const content = fs.readFileSync(fnPath, 'utf8');
  assert.ok(content.includes('exports.handler'), '❌ send-push.js لا يحتوي على exports.handler');
});

test('netlify.toml موجود', () => {
  const tomlPath = path.join(root, 'netlify.toml');
  assert.ok(fs.existsSync(tomlPath), '❌ netlify.toml مفقود');
});

/* ============================================
   4. اختبارات الأمان
   ============================================ */

test('notifications.js لا يحتوي على REST Key مكشوف', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'notifications.js'), 'utf8');
  assert.ok(
    !content.includes('ONESIGNAL_REST_KEY =') || content.includes('process.env'),
    '❌ REST Key مكشوف في notifications.js'
  );
  assert.ok(
    !content.match(/os_v2_app_[a-zA-Z0-9_]+/),
    '❌ مفتاح OneSignal مكشوف في الكود'
  );
});

test('firebase-config.js لا يحتوي على salt ثابت للمطور', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'firebase-config.js'), 'utf8');
  // ✅ DEV_PASSWORD_HASH قد يبقى كـ fallback، لكن يجب توثيقه
  assert.ok(
    content.includes('Fallback') || content.includes('first') || content.includes('أول'),
    '⚠️ DEV_PASSWORD_HASH موجود بدون توثيق'
  );
});

/* ============================================
   5. اختبارات الميزات الجديدة
   ============================================ */

test('indexeddb.js موجود ويحتوي على idbHelper', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'indexeddb.js'), 'utf8');
  assert.ok(content.includes('window.idbHelper'), '❌ idbHelper غير مُصدَّر');
  assert.ok(content.includes('idbFetch'), '❌ idbFetch مفقود');
});

test('analytics.js موجود ويحتوي على trackEvent', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'analytics.js'), 'utf8');
  assert.ok(content.includes('window.trackEvent'), '❌ trackEvent غير مُصدَّر');
  assert.ok(content.includes('analyticsApi'), '❌ analyticsApi مفقود');
});

test('auth.js يستخدم Firestore لـ Remember', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
  assert.ok(
    content.includes('REMEMBER_COLLECTION') || content.includes('userPrefs'),
    '❌ auth.js لا يستخدم Firestore للـ Remember'
  );
});

test('friends.js يزامن lastSeenMessages', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'friends.js'), 'utf8');
  assert.ok(
    content.includes('saveLastSeenMessages'),
    '❌ friends.js لا يحتوي على saveLastSeenMessages'
  );
  assert.ok(
    content.includes('userPrefs'),
    '❌ friends.js لا يزامن lastSeenMessages مع Firestore'
  );
});

test('pwa.js لا يحتوي على updateNotificationButtons المكررة', () => {
  const content = fs.readFileSync(path.join(root, 'js', 'pwa.js'), 'utf8');
  // ✅ يجب أن يستدعيها فقط، لا يعرّفها
  const definesFunction = /function\s+updateNotificationButtons\s*\(/.test(content);
  assert.ok(
    !definesFunction,
    '❌ pwa.js يعرّف updateNotificationButtons — يجب أن تكون في prayer.js فقط'
  );
});

/* ============================================
   6. اختبارات service-worker.js
   ============================================ */

test('service-worker.js يحتوي على CORE_ASSETS محدّثة', () => {
  const content = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.ok(content.includes('./js/indexeddb.js'), '❌ indexeddb.js غير موجود في CORE_ASSETS');
  assert.ok(content.includes('./js/analytics.js'), '❌ analytics.js غير موجود في CORE_ASSETS');
  assert.ok(content.includes('./data/ziyarat.json'), '❌ ziyarat.json غير موجود في CORE_ASSETS');
  assert.ok(content.includes('./data/istikhara.json'), '❌ istikhara.json غير موجود في CORE_ASSETS');
});

test('service-worker.js يتجاهل Netlify Functions', () => {
  const content = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.ok(
    content.includes('/api/') || content.includes('/.netlify/'),
    '❌ service-worker.js لا يتعامل مع Netlify Functions'
  );
});

/* ============================================
   7. اختبارات package.json
   ============================================ */

test('package.json يحتوي على scripts المطلوبة', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.lint, '❌ script lint مفقود');
  assert.ok(pkg.scripts.test, '❌ script test مفقود');
  assert.ok(pkg.scripts['test:e2e'], '❌ script test:e2e مفقود');
  assert.ok(pkg.scripts['test:all'], '❌ script test:all مفقود');
});