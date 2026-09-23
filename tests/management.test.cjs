const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const sources = ['security', 'developer', 'auth'].map(name => ({
  name, source: fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8')
}));
const account = {
  fullName: 'مستخدم الاختبار', username: 'test_user', email: 'test@example.com',
  password: 'long-password-123', confirmPassword: 'long-password-123',
  birthDate: '2000-01-01', gender: 'male'
};

async function fixture(t) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://site.example/dashboard.html', runScripts: 'outside-only', virtualConsole: console });
  t.after(() => dom.window.close());
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  const w = dom.window;
  w.TextEncoder = TextEncoder;
  Object.defineProperty(w.crypto, 'subtle', { value: webcrypto.subtle });
  w.messages = [];
  w.showToast = message => w.messages.push(message);
  w.closeSidebarIfOpen = () => {};
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.showHome = () => {
    w.document.querySelectorAll('.view').forEach(element => element.classList.remove('active'));
    w.document.getElementById('homeView').classList.add('active');
  };
  w.observedAds = [];
  w.IntersectionObserver = class {
    constructor(callback) { w.observeCallback = callback; }
    observe(element) { w.observedAds.push(element); }
    unobserve() {}
    disconnect() { w.observedAds = []; }
  };
  const context = dom.getInternalVMContext();
  for (const { name, source } of sources) vm.runInContext(source, context, { filename: `${name}.js` });
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.deepEqual(errors, [], 'startup has no unhandled errors');
  t.after(() => assert.deepEqual(errors, []));
  return {
    w, run: source => vm.runInContext(source, context),
    value: (id, value) => { w.document.getElementById(id).value = value; },
    check: (id, value) => { w.document.getElementById(id).checked = value; },
    unlock: () => w.attemptDeveloperUnlock('developer-password-123', 'developer-password-123')
  };
}

test('registration, email login, salted hashing and bounded sessions', async t => {
  const { w, run } = await fixture(t);
  const result = await w.createUserAccount(account);
  assert.equal(result.ok, true);
  assert.match(result.recoveryCode, /^[A-F0-9-]{39}$/);
  assert.equal(result.user.passwordHash, undefined);
  const record = w.getUsers()[0];
  assert.match(record.passwordHash, /^pbkdf2:/);
  assert.ok(!record.passwordHash.includes(account.password));
  const otherHash = await run(`LocalSecurity.hash(${JSON.stringify(account.password)})`);
  assert.notEqual(record.passwordHash, otherHash);
  assert.equal((await w.loginUser('test@example.com', account.password, false)).ok, true);
  assert.equal(w.localStorage.getItem('tariq_session_v1'), null);
  assert.equal(JSON.parse(w.sessionStorage.getItem('tariq_session_v1')).username, undefined);
  assert.equal(w.getCurrentUser().username, 'test_user');
  const session = JSON.parse(w.sessionStorage.getItem('tariq_session_v1'));
  w.sessionStorage.setItem('tariq_session_v1', JSON.stringify({ ...session, expiresAt: 1 }));
  assert.equal(w.getCurrentUser(), null);
  assert.equal((await w.loginUser('TEST_USER', account.password, true)).ok, true);
  assert.ok(w.localStorage.getItem('tariq_session_v1'));
  w.updateUserAccount(record.id, { disabled: true });
  assert.equal(w.getCurrentUser(), null);
  assert.equal((await w.loginUser('test_user', account.password)).ok, false);
});

test('validation, closed registrations, duplicate email and attempt limit', async t => {
  const { w } = await fixture(t);
  assert.equal((await w.createUserAccount({ ...account, password: 'short' })).ok, false);
  assert.equal((await w.createUserAccount({ ...account, birthDate: '2999-01-01' })).ok, false);
  await w.createUserAccount(account);
  assert.equal((await w.createUserAccount({ ...account, username: 'another' })).ok, false);
  for (let i = 0; i < 5; i++) assert.equal((await w.loginUser('test_user', 'bad')).ok, false);
  assert.equal((await w.loginUser('test_user', account.password)).ok, false);
  w.localStorage.setItem('tariq_login_lock_v1', JSON.stringify({ attempts: 5, until: 1 }));
  assert.equal((await w.loginUser('test_user', account.password)).ok, true);
  w.persistDeveloperSettings({ allowRegistration: false });
  assert.equal((await w.createUserAccount({ ...account, username: 'new', email: '' })).ok, false);
});

test('legacy passwords migrate on login and legacy sessions are invalidated', async t => {
  const { w } = await fixture(t);
  w.saveUsers([{ ...account, id: 'legacy', passwordHash: w.legacyPasswordHash(account.password) }]);
  w.localStorage.setItem('tariq_session_v1', JSON.stringify({ id: 'legacy', username: 'test_user' }));
  assert.equal(w.getCurrentUser(), null);
  assert.equal((await w.loginUser('test_user', account.password)).ok, true);
  assert.match(w.getUsers()[0].passwordHash, /^pbkdf2:/);
  w.localStorage.setItem('tariq_dev_password', 'legacy-dev-password');
  assert.equal(await w.attemptDeveloperUnlock('legacy-dev-password'), true);
  assert.match(w.localStorage.getItem('tariq_dev_password'), /^pbkdf2:/);
});

test('recovery requires a code, rotates it, and invalidates existing sessions', async t => {
  const { w, value } = await fixture(t);
  const created = await w.createUserAccount(account);
  await w.loginUser(account.username, account.password);
  const priorSession = w.localStorage.getItem('tariq_session_v1');
  const form = w.document.getElementById('resetForm');
  const submit = { preventDefault() {}, target: form };
  value('resetUsername', account.username);
  value('resetRecoveryCode', account.birthDate);
  value('resetPassword', 'replacement-password');
  value('resetConfirmPassword', 'replacement-password');
  await w.handleResetSubmit(submit);
  assert.equal((await w.loginUser(account.username, 'replacement-password')).ok, false);
  value('resetRecoveryCode', created.recoveryCode);
  await w.handleResetSubmit(submit);
  assert.equal((await w.loginUser(account.username, 'replacement-password')).ok, true);
  w.localStorage.setItem('tariq_session_v1', priorSession);
  assert.equal(w.getCurrentUser(), null);
  assert.notEqual(w.document.getElementById('recoveryCodeValue').textContent, created.recoveryCode);
  value('resetUsername', account.username);
  value('resetRecoveryCode', created.recoveryCode);
  value('resetPassword', 'another-password');
  value('resetConfirmPassword', 'another-password');
  await w.handleResetSubmit(submit);
  assert.equal((await w.loginUser(account.username, 'another-password')).ok, false);
});

test('profile changes require the current password, update data and terminate sessions', async t => {
  const { w, value } = await fixture(t);
  await w.createUserAccount(account);
  await w.loginUser(account.username, account.password);
  w.fillProfileForm(w.getCurrentUser());
  value('profileEditName', 'اسم جديد');
  value('profileNewPassword', 'new-profile-password');
  value('profileConfirmPassword', 'new-profile-password');
  const event = { preventDefault() {}, target: w.document.getElementById('profileForm') };
  await w.handleProfileSubmit(event);
  assert.equal(w.getCurrentUser().fullName, account.fullName);
  value('profileCurrentPassword', account.password);
  await w.handleProfileSubmit(event);
  assert.equal(w.getCurrentUser(), null);
  assert.equal((await w.loginUser(account.username, 'new-profile-password')).ok, true);
  assert.equal(w.getCurrentUser().fullName, 'اسم جديد');
});

test('developer settings and mutation actions are locked until authenticated', async t => {
  const { w, run, unlock, value } = await fixture(t);
  const original = w.localStorage.getItem('tariq_home_events');
  w.deleteDeveloperEvent('welcome-news');
  w.saveDeveloperSettings();
  assert.equal(w.localStorage.getItem('tariq_home_events'), original);
  await assert.rejects(w.attemptDeveloperUnlock('short', 'short'));
  await unlock();
  assert.equal(w.document.getElementById('developerView').classList.contains('active'), true);
  for (const tab of ['overview', 'news', 'ads', 'users', 'settings', 'backup']) {
    w.switchDeveloperTab(tab);
    assert.equal(w.document.querySelector(`[data-dev-panel="${tab}"]`).classList.contains('hidden'), false);
    assert.equal(w.document.querySelectorAll('[data-dev-panel]:not(.hidden)').length, 1);
  }
  value('developerBannerText', 'تنبيه');
  w.document.getElementById('developerBannerEnabled').checked = true;
  w.saveDeveloperSettings();
  assert.equal(w.document.getElementById('siteBanner').textContent, 'تنبيه');
  run('developerLastActive = Date.now() - 16 * 60000');
  w.saveDeveloperSettings();
  assert.equal(run('developerUnlocked'), false);
});

test('news CRUD supports drafts, indefinite publication, correct priority and empty lists', async t => {
  const { w, unlock, value, check } = await fixture(t);
  await unlock();
  value('developerEventTitle', 'خبر دائم');
  value('developerEventDescription', '<img src=x onerror=alert(1)>');
  check('developerEventPinned', true);
  w.saveDeveloperEvent();
  const saved = w.getNewsItems()[0];
  assert.equal(saved.title, 'خبر دائم');
  assert.equal(w.isScheduleActive(saved), true);
  assert.equal(w.document.querySelector('#homeEvents img[onerror]'), null);
  assert.ok(w.document.getElementById('homeEvents').textContent.includes('<img'));
  w.fillNewsFormById(saved.id);
  value('developerEventTitle', 'عنوان معدّل');
  w.saveDeveloperEvent();
  assert.equal(w.getNewsItems()[0].createdAt, saved.createdAt);
  assert.equal(w.messages.at(-1), 'تم تحديث الخبر');
  w.duplicateContent('news', saved.id);
  assert.equal(w.getNewsItems()[0].active, false);
  value('developerNewsStatus', 'draft');
  w.renderDeveloperEvents();
  assert.equal(w.document.querySelectorAll('#developerEventsList .developer-row').length, 1);
  const now = Date.now();
  w.saveNewsItems([
    { id: 'older-pinned', title: 'old', pinned: true, active: true, createdAt: now - 86400000 },
    { id: 'newer', title: 'new', active: true, priority: 100, createdAt: now }
  ]);
  assert.equal(w.getActiveHomeEvents()[0].id, 'older-pinned');
  w.saveNewsItems([]);
  w.seedDefaultContent();
  assert.equal(w.getNewsItems().length, 0);
});

test('schedules, unsafe links and non-executable previews', async t => {
  const { w, unlock, value } = await fixture(t);
  const now = Date.now();
  assert.equal(w.isScheduleActive({ active: true }, now), true);
  assert.equal(w.isScheduleActive({ startsAt: new Date(now + 1000).toISOString() }, now), false);
  assert.equal(w.isScheduleActive({ endsAt: new Date(now).toISOString() }, now), false);
  assert.equal(w.isScheduleActive({ active: false }, now), false);
  await unlock();
  value('developerAdTitle', 'إعلان');
  value('developerAdStarts', '2030-02-02T12:00');
  value('developerAdEnds', '2030-01-02T12:00');
  w.saveDeveloperAd();
  assert.equal(w.getAds().length, 0);
  value('developerAdStarts', '');
  value('developerAdEnds', '');
  value('developerAdLink', 'javascript:alert(1)');
  w.saveDeveloperAd();
  assert.equal(w.getAds().length, 0);
  value('developerAdLink', 'https://example.com');
  value('developerAdTitle', '<script>alert(1)</script>');
  w.previewContent('ads');
  assert.equal(w.document.querySelector('#contentPreviewBody script'), null);
  assert.equal(w.document.querySelector('#contentPreviewBody [data-ad-id]'), null);
  assert.equal(w.document.querySelector('#contentPreviewBody a').hasAttribute('onclick'), false);
});

test('ad CRUD, audience, placement, dismissal and impressions without redraw inflation', async t => {
  const { w, unlock, value } = await fixture(t);
  await unlock();
  value('developerAdTitle', 'حملة');
  value('developerAdLink', 'https://example.com');
  value('developerAdPlacement', 'home-mid');
  w.saveDeveloperAd();
  const saved = w.getAds()[0];
  assert.ok(w.document.querySelector('#homeEvents [data-ad-id]'));
  w.bumpAdImpression(saved.id);
  w.bumpAdImpression(saved.id);
  w.renderHomeEvents();
  w.renderHomeAds();
  assert.equal(w.getAds()[0].impressions, 1);
  w.trackAdClick(saved.id);
  w.fillAdFormById(saved.id);
  value('developerAdTitle', 'حملة معدّلة');
  w.saveDeveloperAd();
  assert.equal(w.getAds()[0].clicks, 1);
  w.dismissHomeAd(saved.id);
  assert.equal(w.document.querySelector('#homeEvents [data-ad-id]'), null);
  w.resetDismissedAds();
  assert.ok(w.document.querySelector('#homeEvents [data-ad-id]'));
  w.saveAds([
    { id: 'members', title: 'أعضاء', audience: 'member', placement: 'home-top' },
    { id: 'guests', title: 'زوار', audience: 'guest', placement: 'home-top' }
  ]);
  assert.equal(w.getActiveAds('home-top')[0].id, 'guests');
  await w.createUserAccount(account);
  await w.loginUser(account.username, account.password);
  assert.equal(w.getActiveAds('home-top')[0].id, 'members');
  w.persistDeveloperSettings({ enableAds: false });
  w.refreshPublicSurfaces();
  assert.equal(w.document.querySelector('[data-ad-id]'), null);
});

test('popup is closable and appears only once per browsing session', async t => {
  const { w } = await fixture(t);
  w.saveAds([{ id: 'popup', title: 'تنبيه', placement: 'popup', dismissible: false }]);
  w.renderHomeAds();
  assert.equal(w.document.getElementById('homeAdPopup').classList.contains('show'), true);
  assert.ok(w.document.querySelector('#homeAdPopup button'));
  w.dismissHomeAd('popup');
  w.renderHomeAds();
  assert.equal(w.document.getElementById('homeAdPopup').classList.contains('show'), false);
});

test('backup validation rejects malicious, oversized, duplicate and malformed entries', async t => {
  const { w } = await fixture(t);
  const good = { version: 2, settings: { maxHomeNews: 4 }, news: [{ id: 'safe-id', title: 'خبر', active: false }], ads: [] };
  assert.equal(w.validateBackup(good).settings.maxHomeNews, 4);
  assert.throws(() => w.validateBackup({ ...good, version: 99 }));
  assert.throws(() => w.validateBackup({ ...good, settings: { enableAds: 'false' } }));
  assert.throws(() => w.validateBackup({ ...good, settings: { maxHomeNews: -1 } }));
  assert.throws(() => w.validateBackup({ ...good, news: [{ id: "x');alert(1)//", title: 'x' }] }));
  assert.throws(() => w.validateBackup({ ...good, news: [{ id: 'x', title: 'x', link: 'javascript:alert(1)' }] }));
  assert.throws(() => w.validateBackup({ ...good, news: [good.news[0], good.news[0]] }));
  assert.throws(() => w.validateBackup({ ...good, ads: [{ id: 'x', title: 'x', placement: 'fake' }] }));
  assert.throws(() => w.validateBackup({ ...good, news: Array(501).fill(good.news[0]) }));
});

test('import is confirmed, excludes account data and rolls back failed writes', async t => {
  const { w, unlock } = await fixture(t);
  await unlock();
  const old = w.localStorage.getItem('tariq_home_events');
  const backup = JSON.stringify({ version: 2, settings: { maxHomeNews: 3 }, news: [{ id: 'new', title: 'جديد' }], ads: [] });
  const input = { files: [{ size: backup.length, text: async () => backup }], value: 'file' };
  w.confirm = () => false;
  await w.importDeveloperData(input);
  assert.equal(w.localStorage.getItem('tariq_home_events'), old);
  w.confirm = () => true;
  const original = w.Storage.prototype.setItem;
  let failed = false;
  w.Storage.prototype.setItem = function (key, value) {
    if (key === 'tariq_home_ads_v1' && !failed) { failed = true; throw new w.DOMException('Full', 'QuotaExceededError'); }
    return original.call(this, key, value);
  };
  await w.importDeveloperData(input);
  assert.equal(w.localStorage.getItem('tariq_home_events'), old);
  w.Storage.prototype.setItem = original;
  await w.importDeveloperData(input);
  assert.equal(w.getNewsItems()[0].id, 'new');
  assert.equal(w.getUsers().length, 0);
});

test('maintenance and login gates allow developer recovery and re-lock afterward', async t => {
  const { w, unlock } = await fixture(t);
  w.persistDeveloperSettings({ maintenanceMode: true, requireLogin: true });
  w.refreshPublicSurfaces();
  assert.equal(w.document.getElementById('maintenanceOverlay').classList.contains('show'), true);
  assert.equal(w.document.getElementById('authGateOverlay').classList.contains('show'), true);
  await unlock();
  assert.equal(w.document.getElementById('maintenanceOverlay').classList.contains('show'), false);
  assert.equal(w.document.getElementById('authGateOverlay').classList.contains('show'), false);
  w.lockDeveloperPanel();
  assert.equal(w.document.getElementById('maintenanceOverlay').classList.contains('show'), true);
});

test('all configured middle-slot ads display and legacy popup dismissal persists', async t => {
  const { w } = await fixture(t);
  w.persistDeveloperSettings({ maxAdsPerSlot: 2, popupOnce: false });
  w.saveAds([
    { id: 'middle-a', title: 'a', placement: 'home-mid' },
    { id: 'middle-b', title: 'b', placement: 'home-mid' },
    { id: 'legacy-popup', title: 'p', placement: 'popup', dismissible: false }
  ]);
  w.renderHomeEvents();
  assert.equal(w.document.querySelectorAll('#homeEvents [data-ad-id]').length, 2);
  w.dismissHomeAd('legacy-popup');
  w.renderHomeAds();
  assert.equal(w.document.getElementById('homeAdPopup').classList.contains('show'), false);
});

test('changing a password removes member ads and restores the login gate immediately', async t => {
  const { w, value } = await fixture(t);
  await w.createUserAccount(account);
  await w.loginUser(account.username, account.password);
  w.persistDeveloperSettings({ requireLogin: true });
  w.saveAds([{ id: 'members', title: 'أعضاء', audience: 'member', placement: 'home-top' }]);
  w.refreshPublicSurfaces();
  assert.ok(w.document.querySelector('[data-ad-id="members"]'));
  w.fillProfileForm(w.getCurrentUser());
  value('profileCurrentPassword', account.password);
  value('profileNewPassword', 'changed-password');
  value('profileConfirmPassword', 'changed-password');
  await w.handleProfileSubmit({ preventDefault() {}, target: w.document.getElementById('profileForm') });
  assert.equal(w.document.querySelector('[data-ad-id="members"]'), null);
  assert.equal(w.document.getElementById('authGateOverlay').classList.contains('show'), true);
});
