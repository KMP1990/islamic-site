/* ===== إعدادات القراءة — v3.1 (زر داخل السور فقط) ===== */

const SETTINGS_KEY = 'reading_settings';

/* ===== الإعدادات الافتراضية ===== */
let readingSettings = {
  fontSize: 26,
  fontFamily: 'amiri-quran',
  preferredTafsir: 'ar.miqbas',
  lineHeight: 2.4,
  letterSpacing: 2,
  theme: 'auto'
};

/* ===== تحميل الإعدادات ===== */
function loadReadingSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      readingSettings = { ...readingSettings, ...JSON.parse(saved) };
    }

    const validTafsirs = ['ar.miqbas', 'ar.jalalayn', 'ar.muyassar', 'ar.qurtubi'];
    if (!validTafsirs.includes(readingSettings.preferredTafsir)) {
      readingSettings.preferredTafsir = 'ar.miqbas';
    }

    readingSettings.fontSize = Math.min(48, Math.max(14, readingSettings.fontSize));
  } catch (err) {
    console.error('خطأ في تحميل الإعدادات:', err);
  }
}

/* ===== حفظ الإعدادات ===== */
function saveReadingSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(readingSettings));
  } catch (err) {
    console.error('خطأ في حفظ الإعدادات:', err);
  }
}

/* ===== تطبيق الإعدادات ===== */
function applyReadingSettings() {
  const root = document.documentElement;

  root.style.setProperty('--quran-font-size', readingSettings.fontSize + 'px');
  root.style.setProperty('--quran-line-height', String(readingSettings.lineHeight));
  root.style.setProperty('--quran-letter-spacing', readingSettings.letterSpacing + 'px');

  let fontFamily = "'Amiri Quran', 'Amiri', serif";
  if (readingSettings.fontFamily === 'amiri') fontFamily = "'Amiri', serif";
  else if (readingSettings.fontFamily === 'scheherazade') fontFamily = "'Scheherazade New', serif";
  else if (readingSettings.fontFamily === 'noto-naskh') fontFamily = "'Noto Naskh Arabic', serif";

  root.style.setProperty('--quran-font-family', fontFamily);

  if (typeof currentTafsir !== 'undefined') {
    currentTafsir = readingSettings.preferredTafsir;
  }
}

/* ===== تبديل اللوحة ===== */
function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  const overlay = document.getElementById('settingsOverlay');
  if (!panel) return;

  const isOpen = panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show', isOpen);

  document.body.style.overflow = isOpen ? 'hidden' : '';

  const toggleBtn = document.querySelector('.sidebar-toggle');
  if (toggleBtn) toggleBtn.classList.remove('is-open');
}

function closeSettings() {
  const panel = document.getElementById('settingsPanel');
  const overlay = document.getElementById('settingsOverlay');
  if (panel) panel.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ============================================
   ✅ إظهار/إخفاء زر إعدادات القراءة
   يظهر فقط عند فتح سورة (surahView أو playingView)
   ============================================ */
function updateSurahSettingsBtn() {
  const btn = document.getElementById('surahSettingsBtn');
  if (!btn) return;

  // فحص الميزة
  if (typeof isFeatureEnabled === 'function' && !isFeatureEnabled('reading_settings_btn')) {
    btn.classList.remove('visible');
    return;
  }

  const surahView = document.getElementById('surahView');
  const playingView = document.getElementById('playingView');
  const isInSurah =
    (surahView && surahView.classList.contains('active')) ||
    (playingView && playingView.classList.contains('active'));

  btn.classList.toggle('visible', isInSurah);
}

/* مراقبة تغيير الصفحات */
function setupSurahSettingsWatcher() {
  // استخدام MutationObserver لمراقبة تغيير الـ classes
  const observer = new MutationObserver(() => {
    updateSurahSettingsBtn();
  });

  document.querySelectorAll('.view').forEach(view => {
    observer.observe(view, { attributes: true, attributeFilter: ['class'] });
  });

  // فحص دوري خفيف كضمان
  setInterval(updateSurahSettingsBtn, 600);
}

/* ===== حجم الخط ===== */
function changeFontSize(delta) {
  let newSize = readingSettings.fontSize + (delta * 2);
  newSize = Math.max(14, Math.min(48, newSize));

  readingSettings.fontSize = newSize;
  saveReadingSettings();
  applyReadingSettings();
  updateFontSizeUI();

  if (typeof showToast === 'function') {
    showToast(`حجم الخط: ${toArabicNumberSettings(newSize)}`);
  }
}

function setFontSize(size) {
  readingSettings.fontSize = Math.max(14, Math.min(48, size));
  saveReadingSettings();
  applyReadingSettings();
  updateFontSizeUI();

  if (typeof showToast === 'function') {
    const labels = { 18: 'صغير', 22: 'متوسط', 26: 'كبير', 32: 'كبير جداً' };
    showToast(`حجم الخط: ${labels[size] || toArabicNumberSettings(size)}`);
  }
}

function updateFontSizeUI() {
  const valueEl = document.getElementById('fontSizeValue');
  if (valueEl) valueEl.textContent = toArabicNumberSettings(readingSettings.fontSize);

  document.querySelectorAll('.font-preset-btn').forEach(btn => {
    const presetSize = Number(btn.dataset.size);
    btn.classList.toggle('active', presetSize === readingSettings.fontSize);
  });
}

/* ===== الخط ===== */
function setFontFamily(family) {
  readingSettings.fontFamily = family;
  saveReadingSettings();
  applyReadingSettings();

  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === family);
  });

  if (typeof showToast === 'function') {
    const names = {
      'amiri-quran': 'أميري قرآن',
      'amiri': 'أميري',
      'scheherazade': 'شهرزاد',
      'noto-naskh': 'نوتو نسخ'
    };
    showToast(`الخط: ${names[family]}`);
  }
}

/* ===== التفسير المفضل ===== */
function setPreferredTafsir(tafsir) {
  readingSettings.preferredTafsir = tafsir;
  saveReadingSettings();

  if (typeof currentTafsir !== 'undefined') currentTafsir = tafsir;

  if (typeof showToast === 'function') {
    const names = {
      'ar.miqbas': 'ابن كثير',
      'ar.jalalayn': 'الجلالين',
      'ar.muyassar': 'المیسر',
      'ar.qurtubi': 'القرطبي'
    };
    showToast(`التفسير: ${names[tafsir]}`);
  }
}

/* ===== إعادة الإعدادات ===== */
function resetSettings() {
  const lang = localStorage.getItem('lang') || 'ar';
  const confirmed = confirm(
    lang === 'ar' ? 'إعادة الإعدادات الافتراضية؟' : 'Reset to default settings?'
  );

  if (!confirmed) return;

  readingSettings = {
    fontSize: 26,
    fontFamily: 'amiri-quran',
    preferredTafsir: 'ar.miqbas',
    lineHeight: 2.4,
    letterSpacing: 2,
    theme: 'auto'
  };

  saveReadingSettings();
  applyReadingSettings();
  updateFontSizeUI();

  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.font === 'amiri-quran');
  });

  const select = document.getElementById('preferredTafsir');
  if (select) select.value = 'ar.miqbas';

  if (typeof showToast === 'function') {
    showToast('تم إعادة الإعدادات');
  }
}

/* ===== مساعد ===== */
function toArabicNumberSettings(num) {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/* ===== تشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  loadReadingSettings();
  applyReadingSettings();

  setTimeout(() => {
    updateFontSizeUI();

    document.querySelectorAll('.font-family-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.font === readingSettings.fontFamily);
    });

    const select = document.getElementById('preferredTafsir');
    if (select) select.value = readingSettings.preferredTafsir;

    // ✅ بدء مراقبة زر الإعدادات
    updateSurahSettingsBtn();
    setupSurahSettingsWatcher();
  }, 100);
});

/* ===== تصدير ===== */
window.toggleSettings = toggleSettings;
window.closeSettings = closeSettings;
window.changeFontSize = changeFontSize;
window.setFontSize = setFontSize;
window.setFontFamily = setFontFamily;
window.setPreferredTafsir = setPreferredTafsir;
window.resetSettings = resetSettings;
window.updateSurahSettingsBtn = updateSurahSettingsBtn;