const translations = {};
let currentLang = localStorage.getItem('lang') || 'ar';

/* ===== تحميل الترجمة ===== */
async function loadTranslation(lang) {
  const res = await fetch(`locales/${lang}.json`);
  return await res.json();
}

/* ===== تطبيق الترجمة ===== */
function applyTranslation(t) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.placeholder = t[key];
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.title = t[key];
  });
}

/* ===== تبديل اللغة ===== */
async function setLang(lang) {
  if (lang === currentLang && translations[lang]) return;

  currentLang = lang;
  localStorage.setItem('lang', lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('.lang-option').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === lang);
  });

  const t = await loadTranslation(lang);
  translations[lang] = t;
  applyTranslation(t);

  /* ✅ إذا كنا في سورة أو صفحة التشغيل → إعادة تحميل الصفحة */
  const surahView = document.getElementById('surahView');
  const playingView = document.getElementById('playingView');

  if (surahView && surahView.classList.contains('active')) {
    location.reload();
    return;
  }

  if (playingView && playingView.classList.contains('active')) {
    location.reload();
    return;
  }

  if (typeof renderSurahs === 'function' && allSurahs.length > 0) {
    renderSurahs();
  }

  if (typeof renderReciters === 'function' && allReciters.length > 0) {
    renderReciters();
  }

  if (typeof renderStats === 'function') {
    renderStats();
  }

  if (typeof renderPrayerTimes === 'function' && prayerTimes && Object.keys(prayerTimes).length > 0) {
    renderPrayerTimes();
  }
}

/* ===== تشغيل ===== */
window.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
});