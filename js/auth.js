/* ===== نظام الحسابات — Firebase Auth (v6) ===== */

const AUTH_LOCK_KEY = 'tariq_login_lock_v2';
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_LOCK_MS = 2 * 60 * 1000;
const VIRTUAL_DOMAIN = 'tariq-alhuda.local';
const AVATAR_CACHE_KEY = 'tariq_user_avatar_cache';
const REMEMBER_COLLECTION = 'userPrefs';

let currentFirebaseUser = null;
let authStateReady = false;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function escapeAuthText(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function cacheAvatar(uid, avatar) {
  try {
    const cache = safeReadJson(AVATAR_CACHE_KEY, {});
    if (avatar) cache[uid] = avatar;
    else delete cache[uid];
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

function getCachedAvatar(uid) {
  try {
    const cache = safeReadJson(AVATAR_CACHE_KEY, {});
    return cache[uid] || '';
  } catch {
    return '';
  }
}

function getEmailCandidates(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return [];
  const candidates = [];
  if (raw.includes('@')) candidates.push(raw);
  else candidates.push(`${normalizeUsername(raw)}@${VIRTUAL_DOMAIN}`);
  return [...new Set(candidates)];
}

function emailToUsername(email) {
  return String(email || '').replace(`@${VIRTUAL_DOMAIN}`, '');
}

function getLoginLock() {
  return safeReadJson(AUTH_LOCK_KEY, { attempts: 0, until: 0 });
}

function setLoginLock(lock) {
  localStorage.setItem(AUTH_LOCK_KEY, JSON.stringify(lock));
}

function clearLoginLock() {
  localStorage.removeItem(AUTH_LOCK_KEY);
}

function registerFailedAttempt() {
  const lock = getLoginLock();
  const attempts = (lock.until && lock.until <= Date.now() ? 0 : Number(lock.attempts || 0)) + 1;
  setLoginLock({
    attempts,
    until: attempts >= AUTH_MAX_ATTEMPTS ? Date.now() + AUTH_LOCK_MS : 0
  });
}

async function loadRememberedUsername() {
  try {
    const user = window.firebaseHelpers?.fbGetCurrentUser?.();
    const authUser = await user;
    if (!authUser) return '';
    const prefs = await window.firebaseHelpers.fbGetDoc(REMEMBER_COLLECTION, authUser.uid);
    return prefs?.lastUsername || '';
  } catch {
    return '';
  }
}

async function saveRememberedUsername(uid, username) {
  try {
    await window.firebaseHelpers.fbSetDoc(REMEMBER_COLLECTION, uid, {
      lastUsername: username,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {}
}

function validateRegisterInput({ fullName, username, password, confirmPassword, birthDate, gender, email }) {
  if (!fullName || !fullName.trim()) return 'اكتب الاسم الكامل';
  if (!username || !username.trim()) return 'اكتب اسم المستخدم';
  if (password.length < 10 || password.length > 128) return 'كلمة المرور من 10 إلى 128 حرفاً';
  if (fullName.trim().length > 60) return 'الاسم يجب ألا يتجاوز 60 حرفاً';
  if (password !== confirmPassword) return 'كلمتا المرور غير متطابقتين';
  if (!birthDate) return 'اختر تاريخ الميلاد';
  if (!['male', 'female'].includes(gender)) return 'اختر النوع';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'البريد الإلكتروني غير صحيح';

  const birth = new Date(birthDate);
  if (!Number.isFinite(birth.getTime()) || birth > new Date()) return 'تاريخ الميلاد غير صحيح';

  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    return 'اسم المستخدم: 3-20 حرفاً إنجليزياً أو رقماً أو _';
  }
  return null;
}

async function createUserAccount(payload) {
  if (getDeveloperSettings().allowRegistration === false) {
    return { ok: false, error: 'إنشاء الحسابات متوقف مؤقتاً' };
  }

  const error = validateRegisterInput(payload);
  if (error) return { ok: false, error };

  if (!window.firebaseHelpers) {
    return { ok: false, error: 'Firebase لم يتم تحميله بعد' };
  }

  try {
    const email = (payload.email && payload.email.trim()) || `${normalizeUsername(payload.username)}@${VIRTUAL_DOMAIN}`;

    const credential = await window.firebaseHelpers.fbSignUp(email, payload.password, payload.fullName.trim());

    await window.firebaseHelpers.fbSetDoc('users', credential.user.uid, {
      uid: credential.user.uid,
      fullName: payload.fullName.trim(),
      username: normalizeUsername(payload.username),
      email: email,
      birthDate: payload.birthDate,
      gender: payload.gender,
      bio: '',
      avatar: '',
      disabled: false,
      banned: false,
      createdAt: new Date().toISOString()
    });

    if (typeof trackEvent === 'function') trackEvent('user_registered');

    return {
      ok: true,
      user: {
        id: credential.user.uid,
        uid: credential.user.uid,
        fullName: payload.fullName.trim(),
        username: normalizeUsername(payload.username),
        email: email,
        avatar: ''
      }
    };
  } catch (err) {
    console.error('[Auth] Register error:', err);
    const messages = {
      'auth/email-already-in-use': 'البريد أو اسم المستخدم مستخدم بالفعل',
      'auth/weak-password': 'كلمة المرور ضعيفة جداً',
      'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
      'auth/network-request-failed': 'تعذر الاتصال بالإنترنت',
      'auth/operation-not-allowed': 'التسجيل بالإيميل غير مفعّل'
    };
    return { ok: false, error: messages[err.code] || err.message || 'فشل إنشاء الحساب' };
  }
}

async function loginUser(usernameOrEmail, password, remember = true) {
  const lock = getLoginLock();
  if (lock.until && Date.now() < lock.until) {
    const seconds = Math.ceil((lock.until - Date.now()) / 1000);
    return { ok: false, error: `تم قفل الدخول مؤقتاً. حاول بعد ${seconds} ثانية` };
  }

  if (!window.firebaseHelpers) {
    return { ok: false, error: 'Firebase لم يتم تحميله بعد' };
  }

  const input = String(usernameOrEmail || '').trim().toLowerCase();
  if (!input || !password) {
    return { ok: false, error: 'أدخل اسم المستخدم وكلمة المرور' };
  }

  const candidates = getEmailCandidates(input);
  let lastError = null;

  for (const email of candidates) {
    try {
      const credential = await window.firebaseHelpers.fbSignIn(email, password);

      clearLoginLock();
      await saveRememberedUsername(credential.user.uid, normalizeUsername(input));

      let userData = { uid: credential.user.uid, email: credential.user.email };
      try {
        const users = await window.firebaseHelpers.fbGetCollection('users', {
          where: [['uid', '==', credential.user.uid]],
          limit: 1
        });
        if (users.length) userData = { ...userData, ...users[0] };
      } catch (e) {}

      if (userData.banned === true) {
        try { await window.firebaseHelpers.fbSignOut(); } catch (e) {}
        const reason = userData.banReason || 'تواصل مع الإدارة';
        return { ok: false, error: `🚫 تم حظر جهازك\n${reason}` };
      }

      if (userData.disabled) {
        try { await window.firebaseHelpers.fbSignOut(); } catch (e) {}
        return { ok: false, error: 'حسابك موقوف. تواصل مع الإدارة' };
      }

      if (typeof isDeviceBanned === 'function' && isDeviceBanned()) {
        return { ok: false, error: '🚫 هذا الجهاز محظور من استخدام التطبيق' };
      }

      try {
        await window.firebaseHelpers.fbSetDoc('users', credential.user.uid, {
          lastLogin: new Date().toISOString()
        });
      } catch (e) {}

      if (userData.avatar) cacheAvatar(credential.user.uid, userData.avatar);

      if (typeof trackEvent === 'function') trackEvent('user_login');

      return {
        ok: true,
        user: {
          id: credential.user.uid,
          uid: credential.user.uid,
          fullName: userData.fullName || credential.user.displayName || '',
          username: userData.username || normalizeUsername(input),
          email: credential.user.email,
          birthDate: userData.birthDate || '',
          gender: userData.gender || 'male',
          bio: userData.bio || '',
          avatar: userData.avatar || getCachedAvatar(credential.user.uid) || '',
          lastLogin: new Date().toISOString()
        }
      };
    } catch (err) {
      lastError = err;
    }
  }

  registerFailedAttempt();

  const errCode = lastError?.code || '';
  const messages = {
    'auth/user-not-found': 'الحساب غير موجود',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    'auth/invalid-login-credentials': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً',
    'auth/network-request-failed': 'تعذر الاتصال بالإنترنت',
    'auth/user-disabled': 'هذا الحساب موقوف'
  };

  return {
    ok: false,
    error: messages[errCode] || 'بيانات الدخول غير صحيحة'
  };
}

async function logoutUser() {
  try {
    if (window.firebaseHelpers) await window.firebaseHelpers.fbSignOut();
  } catch (e) {}
  currentFirebaseUser = null;
  renderAuthWidget();
  populateProfileData();
  if (typeof applyAuthGate === 'function') applyAuthGate();
  if (typeof refreshPublicSurfaces === 'function') refreshPublicSurfaces();
  if (typeof showToast === 'function') showToast('تم تسجيل الخروج');
  if (typeof trackEvent === 'function') trackEvent('user_logout');
}

function getCurrentUser() {
  return currentFirebaseUser;
}

function renderAuthWidget() {
  const user = getCurrentUser();
  const widget = document.getElementById('authWidget');
  if (!widget) return;

  if (user) {
    const initial = (user.fullName || user.username || user.email || 'م').charAt(0).toUpperCase();
    const avatarContent = user.avatar
      ? `<img src="${escapeAuthText(user.avatar)}" alt="" class="auth-avatar-img" />`
      : escapeAuthText(initial);

    widget.innerHTML = `
      <div class="auth-user-card">
        <div class="auth-user-avatar" onclick="openAvatarPicker()" title="تغيير الصورة">
          ${avatarContent}
          <span class="avatar-edit-overlay">📷</span>
        </div>
        <div class="auth-user-meta">
          <strong>${escapeAuthText(user.fullName || user.username || user.email || 'مستخدم')}</strong>
          <small>@${escapeAuthText(user.username || user.email || '')}</small>
        </div>
        <button class="auth-action-btn" onclick="openAuthModal('profile')">ملفي</button>
        <button class="auth-action-btn danger" onclick="logoutUser()">خروج</button>
      </div>
    `;
  } else {
    widget.innerHTML = `
      <div class="auth-login-cta">
        <div class="auth-cta-copy">
          <strong>حسابك في طريق الهدى</strong>
          <small>سجّل دخولك للمتابعة</small>
        </div>
        <button class="auth-action-btn primary" onclick="openAuthModal('login')">تسجيل الدخول</button>
        ${getDeveloperSettings().allowRegistration !== false ? '<button class="auth-action-btn" onclick="openAuthModal(\'register\')">إنشاء حساب</button>' : ''}
      </div>
    `;
  }
}

function setAuthMode(mode = 'login') {
  if (mode === 'register' && getDeveloperSettings().allowRegistration === false) mode = 'login';
  setAuthMessage('');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const profileForm = document.getElementById('profileForm');
  const title = document.getElementById('authModalTitle');
  const user = getCurrentUser();
  const isProfile = mode === 'profile' && user;

  if (loginForm) loginForm.classList.toggle('hidden', mode !== 'login' || !!user);
  if (registerForm) registerForm.classList.toggle('hidden', mode !== 'register');
  if (profileForm) profileForm.classList.toggle('hidden', !isProfile);

  const guestTabs = document.getElementById('authGuestTabs');
  const userTabs = document.getElementById('authUserTabs');
  if (guestTabs) guestTabs.classList.toggle('hidden', !!user);
  if (userTabs) userTabs.classList.toggle('hidden', !user);

  document.querySelectorAll('[data-auth-tab]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.authTab === mode);
  });

  if (title) {
    title.textContent = user ? 'ملفي الشخصي' : mode === 'register' ? 'إنشاء حساب' : 'تسجيل الدخول';
  }

  if (user && isProfile) fillProfileForm(user);
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  const user = getCurrentUser();
  setAuthMode(user && mode === 'login' ? 'profile' : mode);
  modal.classList.add('show');
  setTimeout(() => modal.querySelector('form:not(.hidden) input')?.focus(), 0);

  loadRememberedUsername().then(remembered => {
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername && remembered && !loginUsername.value) loginUsername.value = remembered;
  });
}

function closeAuthModal() {
  document.getElementById('authModal')?.classList.remove('show');
}

function fillProfileForm(user) {
  const name = document.getElementById('profileEditName');
  const email = document.getElementById('profileEditEmail');
  const bio = document.getElementById('profileEditBio');
  const birth = document.getElementById('profileEditBirthDate');
  const genderMale = document.querySelector('input[name="profileGender"][value="male"]');
  const genderFemale = document.querySelector('input[name="profileGender"][value="female"]');
  if (name) name.value = user.fullName || '';
  if (email && !email.value) email.value = user.email || '';
  if (bio) bio.value = user.bio || '';
  if (birth) birth.value = user.birthDate || '';
  if (genderMale) genderMale.checked = user.gender !== 'female';
  if (genderFemale) genderFemale.checked = user.gender === 'female';

  populateProfileStats();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername')?.value || '';
  const password = document.getElementById('loginPassword')?.value || '';
  const remember = document.getElementById('loginRemember')?.checked !== false;

  setAuthMessage('جارٍ تسجيل الدخول...');
  const result = await loginUser(username, password, remember);
  if (!result.ok) {
    setAuthMessage(result.error || 'فشل تسجيل الدخول');
    return;
  }
  afterAuthSuccess('تم تسجيل الدخول بنجاح');
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const payload = {
    fullName: document.getElementById('registerFullName')?.value || '',
    username: document.getElementById('registerUsername')?.value || '',
    email: document.getElementById('registerEmail')?.value || '',
    password: document.getElementById('registerPassword')?.value || '',
    confirmPassword: document.getElementById('registerConfirmPassword')?.value || '',
    birthDate: document.getElementById('registerBirthDate')?.value || '',
    gender: document.querySelector('input[name="registerGender"]:checked')?.value || ''
  };

  setAuthMessage('جارٍ إنشاء الحساب...');
  const result = await createUserAccount(payload);
  if (!result.ok) {
    setAuthMessage(result.error || 'فشل إنشاء الحساب');
    return;
  }

  await loginUser(payload.username, payload.password, true);
  afterAuthSuccess('تم إنشاء الحساب');
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const fullName = document.getElementById('profileEditName')?.value.trim() || '';
  const email = document.getElementById('profileEditEmail')?.value.trim() || '';
  const bio = document.getElementById('profileEditBio')?.value.trim() || '';
  const birthDate = document.getElementById('profileEditBirthDate')?.value || '';
  const gender = document.querySelector('input[name="profileGender"]:checked')?.value || user.gender;

  if (!fullName) { showToast('اكتب الاسم الكامل'); return; }

  try {
    await window.firebaseHelpers.fbSetDoc('users', user.uid, {
      fullName, email, bio, birthDate, gender
    });
    currentFirebaseUser = { ...user, fullName, email, bio, birthDate, gender };
    populateProfileData();
    renderAuthWidget();
    showToast('تم حفظ الملف الشخصي');
    if (typeof trackEvent === 'function') trackEvent('profile_updated');
  } catch (err) {
    showToast('تعذر حفظ التغييرات');
  }
}

async function handleDeleteAccount() {
  showToast('حذف الحساب غير متاح حالياً');
}

function afterAuthSuccess(message) {
  renderAuthWidget();
  populateProfileData();
  closeAuthModal();
  if (typeof applyAuthGate === 'function') applyAuthGate();
  showToast(message);
  document.getElementById('loginForm')?.reset();
  document.getElementById('registerForm')?.reset();
  if (typeof refreshPublicSurfaces === 'function') refreshPublicSurfaces();
}

function populateProfileData() {
  const user = getCurrentUser();
  const profileCard = document.getElementById('profileCard');
  if (profileCard) profileCard.classList.toggle('hidden', !user);
  if (!user) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  };
  setText('profileName', user.fullName);
  setText('profileUsername', '@' + (user.username || ''));
  setText('profileBirthDate', user.birthDate);
  setText('profileGender', user.gender === 'female' ? 'أنثى' : 'ذكر');
  setText('profileEmail', user.email || 'غير مضاف');
  setText('profileBio', user.bio || 'لا توجد نبذة بعد');
  setText('profileLastLogin', user.lastLogin ? new Date(user.lastLogin).toLocaleString('ar-IQ') : '—');

  populateProfileStats();
}

function populateProfileStats() {
  try {
    const raw = localStorage.getItem('user_stats');
    const stats = raw ? JSON.parse(raw) : {};

    const toAr = (n) => String(n || 0).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('profileStatAyahs', toAr(stats.ayahsRead || 0));
    setText('profileStatMinutes', toAr(Math.floor((stats.totalSeconds || 0) / 60)));
    setText('profileStatSurahs', toAr((stats.surahsListened || []).length));
    setText('profileStatCompleted', toAr((stats.completedSurahs || []).length));
    setText('profileStatStreak', toAr(stats.currentStreak || 0));

    let topSurahName = '—';
    if (stats.surahCounts && Object.keys(stats.surahCounts).length) {
      let topId = null, topCount = 0;
      for (const [id, count] of Object.entries(stats.surahCounts)) {
        if (count > topCount) { topCount = count; topId = parseInt(id); }
      }
      if (topId) {
        if (typeof allQuranSurahs !== 'undefined' && allQuranSurahs.length) {
          const surah = allQuranSurahs.find(s => s.number === topId);
          topSurahName = surah ? (typeof removeTashkeelListen === 'function' ? removeTashkeelListen(surah.name) : surah.name) : `سورة ${topId}`;
        } else {
          topSurahName = `سورة ${topId}`;
        }
      }
    }
    setText('profileStatTopSurah', topSurahName);

    let topReciterName = '—';
    if (stats.reciterCounts && Object.keys(stats.reciterCounts).length) {
      let topName = null, topCount = 0;
      for (const data of Object.values(stats.reciterCounts)) {
        if (data.count > topCount) { topCount = data.count; topName = data.name; }
      }
      if (topName) topReciterName = topName;
    }
    setText('profileStatTopReciter', topReciterName);

    const viewBtn = document.getElementById('profileStatsViewBtn');
    if (viewBtn) {
      viewBtn.onclick = () => {
        closeAuthModal();
        if (typeof showStats === 'function') showStats();
      };
    }

    const resetBtn = document.getElementById('profileStatsResetBtn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (typeof resetStats === 'function') {
          resetStats();
          setTimeout(populateProfileStats, 150);
        }
      };
    }
  } catch (err) {
    console.error('[Auth] populateProfileStats error:', err);
  }
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  if (button) button.textContent = hidden ? 'إخفاء' : 'إظهار';
}

function applyAuthGate() {
  const settings = typeof getDeveloperSettings === 'function' ? getDeveloperSettings() : {};
  const overlay = document.getElementById('authGateOverlay');
  const user = getCurrentUser();
  const locked = !!settings.requireLogin && !user && !developerUnlocked;
  if (overlay) overlay.classList.toggle('show', locked);
  document.body.classList.toggle('auth-gated', locked);
}

function setAuthMessage(message) {
  const el = document.getElementById('authMessage');
  if (el) el.textContent = message || '';
}

function openAvatarPicker() {
  const user = getCurrentUser();
  if (!user) return;
  const modal = document.getElementById('avatarModal');
  if (!modal) return;

  const preview = document.getElementById('avatarPreview');
  const emptyState = document.getElementById('avatarEmptyState');
  if (preview && emptyState) {
    if (user.avatar) {
      preview.src = user.avatar;
      preview.style.display = 'block';
      emptyState.style.display = 'none';
    } else {
      preview.style.display = 'none';
      emptyState.style.display = 'block';
    }
  }

  modal.classList.add('show');
}

function closeAvatarModal() {
  document.getElementById('avatarModal')?.classList.remove('show');
}

async function handleAvatarUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    showToast('الصورة كبيرة جداً — الحجم الأقصى 500KB');
    event.target.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('الملف ليس صورة');
    event.target.value = '';
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      const img = new Image();
      img.onload = async () => {
        try {
          const size = Math.min(img.width, img.height, 300);
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          const offsetX = (img.width - size) / 2;
          const offsetY = (img.height - size) / 2;
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

          const compressed = canvas.toDataURL('image/jpeg', 0.8);

          const user = getCurrentUser();
          if (!user) return;

          await window.firebaseHelpers.fbSetDoc('users', user.uid, { avatar: compressed });
          cacheAvatar(user.uid, compressed);

          currentFirebaseUser = { ...user, avatar: compressed };
          renderAuthWidget();
          populateProfileData();
          showToast('✅ تم حفظ الصورة');
          closeAvatarModal();
          if (typeof trackEvent === 'function') trackEvent('avatar_updated');
        } catch (err) {
          console.error('[Avatar] Process failed:', err);
          showToast('تعذر معالجة الصورة');
        }
      };
      img.onerror = () => showToast('تعذر قراءة الصورة');
      img.src = dataUrl;
    };
    reader.onerror = () => showToast('تعذر قراءة الملف');
    reader.readAsDataURL(file);
  } catch (err) {
    console.error('[Avatar] Read failed:', err);
    showToast('تعذر قراءة الصورة');
  } finally {
    event.target.value = '';
  }
}

async function removeAvatar() {
  const user = getCurrentUser();
  if (!user) return;
  if (!confirm('حذف صورة الحساب؟')) return;

  try {
    await window.firebaseHelpers.fbSetDoc('users', user.uid, { avatar: '' });
    cacheAvatar(user.uid, '');
    currentFirebaseUser = { ...user, avatar: '' };
    renderAuthWidget();
    populateProfileData();
    showToast('تم حذف الصورة');
    closeAvatarModal();
  } catch (err) {
    showToast('تعذر الحذف');
  }
}

const DEVICE_BAN_KEY = 'tariq_device_ban_v1';

function getDeviceFingerprint() {
  try {
    let fp = localStorage.getItem('tariq_device_fp');
    if (fp) return fp;

    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || ''
    ];
    const raw = parts.join('|');

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash = hash & hash;
    }
    fp = 'dev_' + Math.abs(hash).toString(36);
    localStorage.setItem('tariq_device_fp', fp);
    return fp;
  } catch {
    return 'dev_unknown';
  }
}

function isDeviceBanned() {
  try {
    const banned = safeReadJson(DEVICE_BAN_KEY, { devices: [] });
    const fp = getDeviceFingerprint();
    return banned.devices.includes(fp);
  } catch {
    return false;
  }
}

function banCurrentDevice(reason = '') {
  try {
    const banned = safeReadJson(DEVICE_BAN_KEY, { devices: [] });
    const fp = getDeviceFingerprint();
    if (!banned.devices.includes(fp)) banned.devices.push(fp);
    banned.meta = banned.meta || {};
    banned.meta[fp] = { reason, time: Date.now() };
    localStorage.setItem(DEVICE_BAN_KEY, JSON.stringify(banned));
    return true;
  } catch {
    return false;
  }
}

function unbanCurrentDevice() {
  try {
    const banned = safeReadJson(DEVICE_BAN_KEY, { devices: [] });
    const fp = getDeviceFingerprint();
    banned.devices = banned.devices.filter(d => d !== fp);
    if (banned.meta) delete banned.meta[fp];
    localStorage.setItem(DEVICE_BAN_KEY, JSON.stringify(banned));
    return true;
  } catch {
    return false;
  }
}

window.getDeviceFingerprint = getDeviceFingerprint;
window.isDeviceBanned = isDeviceBanned;
window.banCurrentDevice = banCurrentDevice;
window.unbanCurrentDevice = unbanCurrentDevice;

async function initAuthState() {
  if (!window.firebaseHelpers) return;
  await window.firebaseHelpers.whenFirebaseReady();

  window.firebaseHelpers.fbOnAuthStateChanged(async (user) => {
    if (user) {
      let userData = { uid: user.uid, email: user.email };
      try {
        const users = await window.firebaseHelpers.fbGetCollection('users', {
          where: [['uid', '==', user.uid]],
          limit: 1
        });
        if (users.length) userData = { ...userData, ...users[0] };
      } catch (e) {}

      if (userData.banned === true) {
        try { await window.firebaseHelpers.fbSignOut(); } catch (e) {}
        currentFirebaseUser = null;
        renderAuthWidget();
        populateProfileData();
        showToast('🚫 تم حظر جهازك');
        return;
      }

      if (userData.disabled) {
        try { await window.firebaseHelpers.fbSignOut(); } catch (e) {}
        currentFirebaseUser = null;
        renderAuthWidget();
        populateProfileData();
        showToast('حسابك موقوف. تواصل مع الإدارة');
        return;
      }

      const avatar = userData.avatar || getCachedAvatar(user.uid) || '';
      if (avatar && !userData.avatar) cacheAvatar(user.uid, avatar);

      currentFirebaseUser = {
        id: user.uid,
        uid: user.uid,
        fullName: userData.fullName || user.displayName || '',
        username: userData.username || emailToUsername(user.email || ''),
        email: user.email,
        birthDate: userData.birthDate || '',
        gender: userData.gender || 'male',
        bio: userData.bio || '',
        avatar: avatar,
        lastLogin: userData.lastLogin || null
      };
    } else {
      currentFirebaseUser = null;
    }
    authStateReady = true;
    renderAuthWidget();
    populateProfileData();
    if (typeof applyAuthGate === 'function') applyAuthGate();
    if (typeof refreshPublicSurfaces === 'function') refreshPublicSurfaces();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthState();

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const profileForm = document.getElementById('profileForm');

  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
  if (profileForm) profileForm.addEventListener('submit', handleProfileSubmit);

  document.querySelectorAll('[data-auth-tab]').forEach(tab => {
    tab.addEventListener('click', () => openAuthModal(tab.dataset.authTab || 'login'));
  });

  document.getElementById('authModalClose')?.addEventListener('click', closeAuthModal);
  document.getElementById('authModalOverlay')?.addEventListener('click', closeAuthModal);
  document.getElementById('deleteAccountBtn')?.addEventListener('click', handleDeleteAccount);
});

window.authApi = {
  createUserAccount,
  loginUser,
  logoutUser,
  getCurrentUser,
  openAuthModal,
  closeAuthModal,
  renderAuthWidget,
  populateProfileData,
  populateProfileStats,
  applyAuthGate
};

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.logoutUser = logoutUser;
window.togglePasswordVisibility = togglePasswordVisibility;
window.applyAuthGate = applyAuthGate;
window.populateProfileStats = populateProfileStats;
window.openAvatarPicker = openAvatarPicker;
window.closeAvatarModal = closeAvatarModal;
window.handleAvatarUpload = handleAvatarUpload;
window.removeAvatar = removeAvatar;