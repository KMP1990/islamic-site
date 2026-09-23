/* ===== إدارة الثيمات ===== */

const THEMES = ['green', 'dark', 'light', 'ocean', 'rose', 'midnight'];
const THEME_ICONS = {
  green: '🌙',  // التالي راح يكون ليلي
  dark: '☀️',   // التالي راح يكون نهاري
  light: '🌊',
  ocean: '🌸',
  rose: '🌌',
  midnight: '🟢'
};

let currentTheme = localStorage.getItem('theme') || 'green';

/* ===== تطبيق الثيم ===== */
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);

  // ✅ نطبق data-theme على html
  document.documentElement.setAttribute('data-theme', theme);

  // نحدث الأيقونة
  updateThemeIcon();
}

/* ===== تحديث الأيقونة ===== */
function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = THEME_ICONS[currentTheme];
  }

  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.setAttribute('data-current', currentTheme);
  }
}

/* ===== تبديل الثيم ===== */
function toggleTheme() {
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % THEMES.length;
  const nextTheme = THEMES[nextIndex];

  applyTheme(nextTheme);
}

/* ===== تشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
});