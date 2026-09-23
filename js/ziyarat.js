/* ===== الزيارات ===== */

let allZiyarat = [];
let currentZiyaratAudio = null;
let isZiyaratPlaying = false;

/* ===== تحميل الزيارات ===== */
async function loadZiyarat() {
  try {
    const res = await fetch('data/ziyarat.json');
    const data = await res.json();
    allZiyarat = data.ziyarat || [];
    renderZiyarat();
  } catch (err) {
    console.error('خطأ في تحميل الزيارات:', err);
    const list = document.getElementById('ziyaratList');
    if (list) list.innerHTML = '<div class="loading">تعذر تحميل الزيارات</div>';
  }
}

/* ===== عرض الزيارات ===== */
function renderZiyarat() {
  const list = document.getElementById('ziyaratList');
  if (!list) return;

  if (allZiyarat.length === 0) {
    list.innerHTML = '<div class="loading">لا توجد زيارات</div>';
    return;
  }

  list.innerHTML = allZiyarat.map((z, i) => `
    <div class="ziyarat-card" style="animation-delay: ${i * 0.1}s" onclick="openZiyarat('${z.id}')">
      <div class="ziyarat-icon">📿</div>
      <div class="ziyarat-info">
        <div class="ziyarat-title">${z.title}</div>
        <div class="ziyarat-subtitle">${z.subtitle || ''}</div>
      </div>
      <div class="ziyarat-arrow">›</div>
    </div>
  `).join('');
}

/* ===== فتح الزيارة ===== */
function openZiyarat(id) {
  const z = allZiyarat.find(x => x.id === id);
  if (!z) return;

  /* عرض View الزيارة */
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('ziyaratView').classList.add('active');

  /* تحديث العنوان */
  const nameEl = document.getElementById('ziyaratViewName');
  const infoEl = document.getElementById('ziyaratViewInfo');
  if (nameEl) nameEl.textContent = z.title;
  if (infoEl) infoEl.textContent = z.subtitle || '';

  /* عرض النص */
  const textEl = document.getElementById('ziyaratTextContainer');
  if (textEl) {
    textEl.innerHTML = formatZiyaratText(z.text);
  }

  /* إعداد الصوت */
  const audio = document.getElementById('ziyaratAudio');
  if (audio && z.audio) {
    audio.src = z.audio;
    updateZiyaratMediaSession(z);
  }

  /* إظهار زر الرجوع العائم */
  const floatingBtn = document.getElementById('floatingBackBtn');
  if (floatingBtn) floatingBtn.classList.add('show');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateZiyaratMediaSession(ziyarat) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ziyarat.title,
      artist: ziyarat.subtitle || 'طريق الهدى',
      album: 'الزيارات'
    });
    navigator.mediaSession.setActionHandler('play', () => document.getElementById('ziyaratAudio')?.play());
    navigator.mediaSession.setActionHandler('pause', () => document.getElementById('ziyaratAudio')?.pause());
  } catch (error) {
    console.warn('[Ziyarat] Media Session unavailable:', error);
  }
}

/* ===== تنسيق النص ===== */
function formatZiyaratText(text) {
  /* نقسم على الأسطر */
  const paragraphs = text.split('\n\n').filter(p => p.trim());

  return paragraphs.map(p => {
    /* إذا السطر يبدأ بـ "ثمّ" → عنوان فرعي */
    if (p.trim().startsWith('ثمّ')) {
      return `<div class="ziyarat-subheading">${p.trim()}</div>`;
    }
    return `<p class="ziyarat-paragraph">${p.trim()}</p>`;
  }).join('');
}

/* ===== تشغيل/إيقاف الصوت ===== */
function toggleZiyaratAudio() {
  const audio = document.getElementById('ziyaratAudio');
  if (!audio) return;

  if (audio.paused) {
    audio.play();
    isZiyaratPlaying = true;
  } else {
    audio.pause();
    isZiyaratPlaying = false;
  }
  updateZiyaratButtons();
}

/* ===== تحديث أزرار الصوت ===== */
function updateZiyaratButtons() {
  const playBtn = document.getElementById('ziyaratPlayBtn');
  const stopBtn = document.getElementById('ziyaratStopBtn');
  const audio = document.getElementById('ziyaratAudio');

  if (!audio) return;

  if (audio.paused) {
    if (playBtn) playBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';
  } else {
    if (playBtn) playBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'flex';
  }
}

/* ===== إيقاف الصوت ===== */
function stopZiyaratAudio() {
  const audio = document.getElementById('ziyaratAudio');
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  updateZiyaratButtons();
}

/* ===== نسخ النص ===== */
async function copyZiyaratText() {
  const currentId = getCurrentZiyaratId();
  const z = allZiyarat.find(x => x.id === currentId);
  if (!z) return;

  const lang = localStorage.getItem('lang') || 'ar';

  try {
    await navigator.clipboard.writeText(z.text);
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? 'تم نسخ النص' : 'Text copied');
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? 'تعذر النسخ' : 'Copy failed');
    }
  }
}

/* ===== تحديد الزيارة الحالية ===== */
function getCurrentZiyaratId() {
  const nameEl = document.getElementById('ziyaratViewName');
  if (!nameEl) return null;
  const name = nameEl.textContent;
  const z = allZiyarat.find(x => x.title === name);
  return z ? z.id : null;
}

/* ===== إغلاق الزيارة ===== */
function closeZiyarat() {
  /* إيقاف الصوت */
  stopZiyaratAudio();

  /* إخفاء زر الرجوع */
  const floatingBtn = document.getElementById('floatingBackBtn');
  if (floatingBtn) floatingBtn.classList.remove('show');

  /* رجوع للقائمة */
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('ziyaratListView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== عرض قائمة الزيارات ===== */
function showZiyarat() {
  if (typeof stopAutoScroll === 'function') stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('ziyaratListView').classList.add('active');

  /* تحديث Sidebar */
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  if (items[3]) items[3].classList.add('active');

  closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (allZiyarat.length === 0) {
    loadZiyarat();
  }
}

/* ===== تشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ziyaratList')) {
    loadZiyarat();
  }

  /* ربط أزرار الصوت */
  const audio = document.getElementById('ziyaratAudio');
  if (audio) {
    audio.addEventListener('ended', updateZiyaratButtons);
    audio.addEventListener('pause', updateZiyaratButtons);
    audio.addEventListener('play', updateZiyaratButtons);
  }
});