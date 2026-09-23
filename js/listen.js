/* ===== بيانات ===== */
let allReciters = [];
let filteredReciters = [];
let allQuranSurahs = [];

let currentReciter = null;
let currentMoshaf = null;
let reciterSurahs = [];
let filteredReciterSurahs = [];

let currentSurahIndex = -1;
let isPlaying = false;

/* ===== ميزات ===== */
let isLooping = false;
let isShuffling = false;
let currentSpeed = 1;
let currentAudioUrl = '';

/* ===== التمرير ===== */
let autoScrollEnabled = false;
let autoScrollRAF = null;
let autoScrollDuration = 120;
let autoScrollStartY = 0;
let autoScrollStartTime = 0;
let playingAyahs = [];
let playingAyahTranslations = [];

/* ===== مؤقت النوم ===== */
let sleepEndTime = null;
let sleepIntervalTimer = null;

/* ===== حفظ الحالة ===== */
let saveStateInterval = null;

const MP3QURAN_API = 'https://www.mp3quran.net/api/v3';
const ALQURAN_API = 'https://api.alquran.cloud/v1';
const PLAYER_STATE_KEY = 'tariq_player_state_v2';

/* ⚠️ ملاحظة: IDB_TTL_SURAHS معرّف في quran.js — لا تعيد تعريفه هنا */
const IDB_TTL_RECITERS = 7 * 24 * 60 * 60 * 1000;

/* ===== إزالة التشكيل ===== */
function removeTashkeelListen(text) {
  if (!text) return '';
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/ٱ/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ===== تحويل الرقم لعربي ===== */
function toArabicNumberListen(num) {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/* ===== تنسيق الوقت ===== */
function formatTime(seconds) {
  if (isNaN(seconds)) return '٠:٠٠';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const formatted = `${m}:${s.toString().padStart(2, '0')}`;
  const lang = localStorage.getItem('lang') || 'ar';
  return lang === 'ar' ? toArabicNumberListen(formatted) : formatted;
}

/* ===== Debounce ===== */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/* ============================================
   حفظ واسترجاع حالة المشغل
   ============================================ */
function savePlayerState() {
  if (!currentReciter || currentSurahIndex < 0) return;

  try {
    const audio = document.getElementById('audioElement');
    const state = {
      reciterId: currentReciter.id,
      reciterName: currentReciter.name,
      surahNumber: reciterSurahs[currentSurahIndex]?.number,
      surahName: reciterSurahs[currentSurahIndex]?.name,
      currentTime: audio?.currentTime || 0,
      duration: audio?.duration || 0,
      speed: currentSpeed,
      volume: audio?.volume ?? 1,
      isLooping,
      isShuffling,
      timestamp: Date.now()
    };
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
    console.log('💾 Player state saved');
  } catch (err) {
    console.error('خطأ في حفظ الحالة:', err);
  }
}

function getSavedPlayerState() {
  try {
    const raw = localStorage.getItem(PLAYER_STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (Date.now() - state.timestamp > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PLAYER_STATE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function clearSavedPlayerState() {
  localStorage.removeItem(PLAYER_STATE_KEY);
}

function startSaveStateInterval() {
  if (saveStateInterval) clearInterval(saveStateInterval);
  saveStateInterval = setInterval(savePlayerState, 5000);
}

function stopSaveStateInterval() {
  if (saveStateInterval) {
    clearInterval(saveStateInterval);
    saveStateInterval = null;
  }
}

/* ============================================
   تحميل القرّاء (مع IndexedDB)
   ============================================ */
async function loadReciters() {
  const list = document.getElementById('recitersList');
  if (!list) return;

  try {
    let data;
    if (window.idbHelper) {
      data = await window.idbHelper.fetch(`${MP3QURAN_API}/reciters?language=ar`, 'reciters', IDB_TTL_RECITERS);
    } else {
      data = await fetch(`${MP3QURAN_API}/reciters?language=ar`).then(res => res.json());
    }
    allReciters = data.reciters || [];
    filteredReciters = [...allReciters];
    renderReciters();
  } catch (err) {
    console.error('خطأ في تحميل القرّاء:', err);
    list.innerHTML = '<div class="loading">تعذر تحميل القرّاء. تحقق من الإنترنت.</div>';
  }
}

/* ===== عرض القرّاء ===== */
function renderReciters() {
  const list = document.getElementById('recitersList');
  if (!list) return;

  if (filteredReciters.length === 0) {
    list.innerHTML = '<div class="loading">لا توجد نتائج</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredReciters.forEach((reciter, i) => {
    const name = reciter.name || 'غير معروف';
    const moshafCount = reciter.moshaf ? reciter.moshaf.length : 0;
    const moshafText = moshafCount === 1 ? 'رواية واحدة' : `${moshafCount} روايات`;

    const card = document.createElement('div');
    card.className = 'reciter-card';
    card.style.animationDelay = `${Math.min(i * 0.02, 0.5)}s`;
    card.onclick = () => openReciter(reciter.id);
    card.innerHTML = `
      <div class="reciter-icon">🎙️</div>
      <div class="reciter-info">
        <div class="reciter-name">${name}</div>
        <div class="reciter-meta">${moshafText}</div>
      </div>
      <div class="reciter-arrow">›</div>
    `;
    fragment.appendChild(card);
  });

  list.innerHTML = '';
  list.appendChild(fragment);
}

/* ===== البحث ===== */
function filterReciters() {
  const query = document.getElementById('recitersSearchInput').value.trim().toLowerCase();
  if (!query) {
    filteredReciters = [...allReciters];
  } else {
    filteredReciters = allReciters.filter(r =>
      r.name && r.name.toLowerCase().includes(query)
    );
  }
  renderReciters();
}

/* ============================================
   فتح قارئ (مع IndexedDB)
   ============================================ */
async function openReciter(reciterId) {
  const reciter = allReciters.find(r => r.id === reciterId);
  if (!reciter) return;

  currentReciter = reciter;

  if (allQuranSurahs.length === 0) {
    try {
      let data;
      if (window.idbHelper) {
        data = await window.idbHelper.fetch(`${ALQURAN_API}/surah`, 'surahs', IDB_TTL_RECITERS);
      } else {
        data = await fetch(`${ALQURAN_API}/surah`).then(res => res.json());
      }
      allQuranSurahs = data.data;
    } catch (err) {
      console.error('خطأ في تحميل السور:', err);
    }
  }

  const moshaf = reciter.moshaf && reciter.moshaf[0];
  if (!moshaf) {
    alert('لا توجد رواية متوفرة لهذا القارئ');
    return;
  }

  currentMoshaf = moshaf;
  reciterSurahs = allQuranSurahs;
  filteredReciterSurahs = [...reciterSurahs];

  const nameEl = document.getElementById('reciterNameTitle');
  const infoEl = document.getElementById('reciterInfoTitle');

  nameEl.textContent = reciter.name;
  infoEl.textContent = moshaf.name;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('reciterSurahsView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderReciterSurahs();
}

/* ===== عرض سور القارئ ===== */
function renderReciterSurahs() {
  const list = document.getElementById('reciterSurahsList');
  if (!list) return;

  const lang = localStorage.getItem('lang') || 'ar';

  if (filteredReciterSurahs.length === 0) {
    list.innerHTML = '<div class="loading">لا توجد نتائج</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredReciterSurahs.forEach((surah, i) => {
    const rawName = lang === 'ar' ? surah.name : surah.englishName;
    const name = lang === 'ar' ? removeTashkeelListen(rawName) : rawName;
    const ayahsText = lang === 'ar' ? 'آية' : 'verses';
    const ayahsCount = lang === 'ar'
      ? toArabicNumberListen(surah.numberOfAyahs)
      : surah.numberOfAyahs;

    const isPlayingThis = currentSurahIndex === i;

    const item = document.createElement('div');
    item.className = `reciter-surah-item ${isPlayingThis ? 'playing' : ''}`;
    item.dataset.surahIndex = i;
    item.style.animationDelay = `${Math.min(i * 0.01, 0.4)}s`;
    item.onclick = () => openReciterSurah(surah.number);
    item.innerHTML = `
      <div class="reciter-surah-play">${isPlayingThis ? '❚❚' : '▶'}</div>
      <div class="reciter-surah-name">${name}</div>
      <div class="reciter-surah-ayahs">${ayahsCount} ${ayahsText}</div>
    `;
    fragment.appendChild(item);
  });

  list.innerHTML = '';
  list.appendChild(fragment);
}

/* ===== البحث في سور القارئ ===== */
function filterReciterSurahs() {
  const query = document.getElementById('reciterSurahsSearchInput').value.trim().toLowerCase();
  filteredReciterSurahs = reciterSurahs.filter(s => {
    const cleanName = removeTashkeelListen(s.name).toLowerCase();
    return (
      cleanName.includes(query) ||
      s.name.toLowerCase().includes(query) ||
      s.englishName.toLowerCase().includes(query) ||
      s.number.toString() === query
    );
  });
  renderReciterSurahs();
}

/* ===== بناء رابط mp3 ===== */
function buildSurahUrl(surahNumber) {
  if (!currentMoshaf) return null;
  const paddedNumber = surahNumber.toString().padStart(3, '0');
  const baseUrl = currentMoshaf.server.endsWith('/')
    ? currentMoshaf.server
    : currentMoshaf.server + '/';
  return `${baseUrl}${paddedNumber}.mp3`;
}

/* ===== فتح سورة القارئ ===== */
async function openReciterSurah(surahNumber, options = {}) {
  const index = reciterSurahs.findIndex(s => s.number === surahNumber);
  if (index === -1 || !currentReciter || !currentMoshaf) return;

  currentSurahIndex = index;
  const surah = reciterSurahs[index];
  const url = buildSurahUrl(surahNumber);

  if (!url) {
    alert('لا يمكن تشغيل هذه السورة');
    return;
  }

  const audio = document.getElementById('audioElement');
  try { audio.pause(); } catch (e) {}

  currentAudioUrl = url;

  const lang = localStorage.getItem('lang') || 'ar';
  const surahName = lang === 'ar' ? removeTashkeelListen(surah.name) : surah.englishName;

  document.getElementById('playerReciter').textContent = currentReciter.name;
  document.getElementById('playerSurah').textContent = surahName;

  saveLastPlayed(surahNumber);

  const player = document.getElementById('audioPlayer');
  player.classList.add('show');
  document.body.classList.add('player-open');

  if (typeof startStatsTracking === 'function') {
    startStatsTracking(surah.number, currentReciter);
  }

  if (typeof trackEvent === 'function') {
    trackEvent('surah_playing', {
      surah: surah.number,
      reciter: currentReciter.name
    });
  }

  renderReciterSurahs();

  await showPlayingView(surah);

  audio.src = url;
  audio.playbackRate = currentSpeed;
  audio.load();
  updateMediaSession();

  if (options.resumeFrom && options.resumeFrom > 0) {
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = options.resumeFrom;
    }, { once: true });
  }

  try {
    await audio.play();
    isPlaying = true;
    updatePlayPauseIcon();
    startSaveStateInterval();

    if (autoScrollEnabled) {
      window.scrollTo(0, 0);
      startAutoScroll(true);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('تم إلغاء التشغيل');
      return;
    }
    console.error('خطأ في التشغيل:', err);
    if (err.name !== 'AbortError') {
      alert('تعذر تشغيل السورة. تحقق من الإنترنت.');
    }
  }
}

/* ===== عرض صفحة التشغيل ===== */
async function showPlayingView(surah) {
  const lang = localStorage.getItem('lang') || 'ar';

  const nameEl = document.getElementById('playingSurahName');
  const infoEl = document.getElementById('playingSurahInfo');
  const basmala = document.getElementById('playingBasmala');
  const container = document.getElementById('playingAyahsContainer');
  const searchInput = document.getElementById('playingAyahSearchInput');
  if (searchInput) searchInput.value = '';
  const searchResults = document.getElementById('playingAyahSearchResults');
  if (searchResults) searchResults.innerHTML = '';

  const rawName = lang === 'ar' ? surah.name : surah.englishName;
  const name = lang === 'ar' ? removeTashkeelListen(rawName) : rawName;

  nameEl.textContent = name;
  infoEl.textContent = currentReciter.name;

  basmala.style.display = (surah.number === 1 || surah.number === 9) ? 'none' : 'block';

  container.innerHTML = '<div class="loading">جارٍ التحميل...</div>';

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('playingView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    let data;
    if (window.idbHelper) {
      data = await window.idbHelper.fetch(`${ALQURAN_API}/surah/${surah.number}/ar.alafasy`, 'ayahs', IDB_TTL_RECITERS);
    } else {
      const res = await fetch(`${ALQURAN_API}/surah/${surah.number}/ar.alafasy`);
      data = await res.json();
    }
    const ayahs = data.data.ayahs;
    playingAyahs = ayahs;

    let translations = [];
    if (lang === 'en') {
      try {
        if (window.idbHelper) {
          const transData = await window.idbHelper.fetch(`${ALQURAN_API}/surah/${surah.number}/en.sahih`, 'ayahs', IDB_TTL_RECITERS);
          translations = transData.data.ayahs;
        } else {
          const transRes = await fetch(`${ALQURAN_API}/surah/${surah.number}/en.sahih`);
          const transData = await transRes.json();
          translations = transData.data.ayahs;
        }
      } catch (err) {
        console.error('خطأ في تحميل الترجمة:', err);
      }
    }
    playingAyahTranslations = translations;

    const fragment = document.createDocumentFragment();
    const surahNameClean = removeTashkeelListen(surah.name);

    ayahs.forEach((ayah, i) => {
      const numDisplay = lang === 'ar'
        ? toArabicNumberListen(ayah.numberInSurah)
        : ayah.numberInSurah;

      let translationHtml = '';
      if (lang === 'en' && translations[i]) {
        translationHtml = `<div class="ayah-translation">${translations[i].text}</div>`;
      }

      const ayahTextEscaped = ayah.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      const ayahLine = document.createElement('div');
      ayahLine.className = 'ayah-line';
      ayahLine.dataset.ayah = ayah.numberInSurah;
      ayahLine.innerHTML = `
        <span class="ayah-text" onclick="openTafsir(${surah.number}, ${ayah.numberInSurah})">${ayah.text}</span>
        <span class="ayah-number" onclick="openTafsir(${surah.number}, ${ayah.numberInSurah})">${numDisplay}</span>
        <button class="ayah-share-btn" onclick="event.stopPropagation(); shareAyahGlobal(${surah.number}, ${ayah.numberInSurah}, '${ayahTextEscaped}', '${surahNameClean}')" title="مشاركة الآية">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        ${translationHtml}
      `;
      fragment.appendChild(ayahLine);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  } catch (err) {
    console.error('خطأ في تحميل الآيات:', err);
    container.innerHTML = '<div class="loading">تعذر تحميل الآيات.</div>';
  }
}

/* ===== قائمة التمرير ===== */
function toggleAutoScrollMenu() {
  const menu = document.getElementById('autoscrollMenu');
  menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('autoscrollMenu');
  const btn = document.getElementById('autoScrollBtn');

  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('show');
  }
});

/* ===== تشغيل التمرير بسرعة محددة ===== */
function startScrollWithSpeed(duration) {
  autoScrollDuration = duration;

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.preset-btn[data-preset="${duration}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  updateScrollStatus(duration);

  if (autoScrollEnabled) {
    autoScrollStartY = window.scrollY;
    autoScrollStartTime = performance.now();
  } else {
    autoScrollEnabled = true;
    const btn = document.getElementById('autoScrollBtn');
    if (btn) btn.classList.add('auto-active');

    autoScrollStartY = window.scrollY;
    autoScrollStartTime = performance.now();
    startAutoScroll(false);
  }

  setTimeout(() => {
    const menu = document.getElementById('autoscrollMenu');
    if (menu) menu.classList.remove('show');
  }, 400);
}

/* ===== إيقاف التمرير ===== */
function stopScrollFromMenu() {
  if (!autoScrollEnabled) return;

  autoScrollEnabled = false;

  const btn = document.getElementById('autoScrollBtn');
  if (btn) btn.classList.remove('auto-active');

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

  updateScrollStatus('stop');
  stopAutoScroll();
}

/* ===== تحديث حالة التمرير ===== */
function updateScrollStatus(duration) {
  const statusEl = document.getElementById('autoscrollStatusText');
  if (!statusEl) return;

  const lang = localStorage.getItem('lang') || 'ar';

  if (duration === 'stop' || !duration) {
    statusEl.textContent = lang === 'ar' ? 'متوقف' : 'Stopped';
    return;
  }

  let text;
  if (duration <= 30) text = lang === 'ar' ? 'سريع' : 'Fast';
  else if (duration <= 90) text = lang === 'ar' ? 'متوسط' : 'Medium';
  else if (duration <= 240) text = lang === 'ar' ? 'بطيء' : 'Slow';
  else if (duration <= 600) text = lang === 'ar' ? 'بطيء جداً' : 'Very Slow';
  else if (duration <= 1200) text = lang === 'ar' ? 'بطيء للغاية' : 'Extremely Slow';
  else if (duration <= 1800) text = lang === 'ar' ? 'أبطأ' : 'Slowest';
  else if (duration <= 3600) text = lang === 'ar' ? 'الأثقل (ساعة)' : 'Heaviest (1h)';
  else if (duration <= 5400) text = lang === 'ar' ? 'أبطأ جداً (ساعة ونصف)' : 'Ultra Slow (1.5h)';
  else text = lang === 'ar' ? 'الأقصى (ساعتين)' : 'Maximum (2h)';

  const seconds = lang === 'ar' ? toArabicNumberListen(duration) : duration;
  statusEl.textContent = lang === 'ar'
    ? `${text} (${seconds} ث)`
    : `${text} (${seconds}s)`;
}

/* ===== التمرير ===== */
function startAutoScroll(fromStart = false) {
  if (autoScrollRAF) {
    autoScrollStartY = window.scrollY;
    autoScrollStartTime = performance.now();
    return;
  }

  if (fromStart) {
    autoScrollStartY = 0;
    autoScrollStartTime = performance.now();
  } else {
    autoScrollStartY = window.scrollY;
    autoScrollStartTime = performance.now();
  }

  function scrollStep(now) {
    if (!autoScrollEnabled) {
      autoScrollRAF = null;
      return;
    }

    const elapsed = (now - autoScrollStartTime) / 1000;
    const totalHeight = document.body.scrollHeight - window.innerHeight;

    if (totalHeight <= 0) {
      autoScrollRAF = requestAnimationFrame(scrollStep);
      return;
    }

    const remainingDistance = totalHeight - autoScrollStartY;

    if (remainingDistance <= 0) {
      autoScrollRAF = null;
      return;
    }

    const pixelsPerSecond = remainingDistance / autoScrollDuration;
    const newY = autoScrollStartY + (pixelsPerSecond * elapsed);

    if (newY >= totalHeight) {
      window.scrollTo(0, totalHeight);
      autoScrollRAF = null;
      return;
    }

    window.scrollTo(0, newY);
    autoScrollRAF = requestAnimationFrame(scrollStep);
  }

  autoScrollRAF = requestAnimationFrame(scrollStep);
}

function stopAutoScroll() {
  if (autoScrollRAF) {
    cancelAnimationFrame(autoScrollRAF);
    autoScrollRAF = null;
  }
}

/* ===== مؤقت النوم ===== */
function toggleSleepMenu() {
  const menu = document.getElementById('sleepMenu');
  if (menu) menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('sleepMenu');
  const btn = document.getElementById('sleepBtn');

  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('show');
  }
});

function setSleepTimer(minutes) {
  cancelSleepTimer();

  sleepEndTime = Date.now() + (minutes * 60 * 1000);

  const btn = document.getElementById('sleepBtn');
  if (btn) btn.classList.add('sleep-active');

  const status = document.getElementById('sleepStatus');
  if (status) status.style.display = 'flex';

  document.querySelectorAll('.sleep-preset-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  updateSleepRemaining();

  sleepIntervalTimer = setInterval(() => {
    updateSleepRemaining();

    if (Date.now() >= sleepEndTime) {
      stopPlaybackBySleep();
    }
  }, 1000);

  const lang = localStorage.getItem('lang') || 'ar';
  if (typeof showToast === 'function') {
    const mins = lang === 'ar'
      ? minutes.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
      : minutes;
    showToast(lang === 'ar' ? `المؤقت: ${mins} دقيقة` : `Timer: ${mins} min`);
  }

  setTimeout(() => {
    const menu = document.getElementById('sleepMenu');
    if (menu) menu.classList.remove('show');
  }, 500);
}

function updateSleepRemaining() {
  const el = document.getElementById('sleepRemaining');
  if (!el || !sleepEndTime) return;

  const diff = sleepEndTime - Date.now();

  if (diff <= 0) {
    el.textContent = '٠:٠٠';
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;

  const lang = localStorage.getItem('lang') || 'ar';
  el.textContent = lang === 'ar'
    ? timeStr.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
    : timeStr;
}

function stopPlaybackBySleep() {
  const audio = document.getElementById('audioElement');
  if (audio) {
    audio.pause();
    isPlaying = false;
    updatePlayPauseIcon();
  }

  cancelSleepTimer();

  if (typeof showToast === 'function') {
    const lang = localStorage.getItem('lang') || 'ar';
    showToast(lang === 'ar' ? 'تم إيقاف التشغيل (مؤقت النوم)' : 'Playback stopped (sleep timer)');
  }
}

function cancelSleepTimer() {
  if (sleepIntervalTimer) {
    clearInterval(sleepIntervalTimer);
    sleepIntervalTimer = null;
  }

  sleepEndTime = null;

  const btn = document.getElementById('sleepBtn');
  if (btn) btn.classList.remove('sleep-active');

  const status = document.getElementById('sleepStatus');
  if (status) status.style.display = 'none';

  document.querySelectorAll('.sleep-preset-btn').forEach(b => b.classList.remove('active'));
}

/* ===== تشغيل/إيقاف ===== */
async function togglePlay() {
  const audio = document.getElementById('audioElement');
  if (!audio.src) return;

  try {
    if (audio.paused) {
      await audio.play();
      isPlaying = true;
    } else {
      audio.pause();
      isPlaying = false;
    }
    updatePlayPauseIcon();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('خطأ في التشغيل:', err);
    }
  }
}

function updatePlayPauseIcon() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  if (!playIcon || !pauseIcon) return;
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

/* ===== السابق ===== */
function playPrev() {
  if (currentSurahIndex <= 0) return;
  const prevSurah = reciterSurahs[currentSurahIndex - 1];
  openReciterSurah(prevSurah.number);
}

/* ===== التالي ===== */
function playNext() {
  if (currentSurahIndex >= reciterSurahs.length - 1) return;
  const nextSurah = reciterSurahs[currentSurahIndex + 1];
  openReciterSurah(nextSurah.number);
}

/* ===== التكرار ===== */
function toggleLoop() {
  isLooping = !isLooping;
  const btn = document.getElementById('loopBtn');
  btn.classList.toggle('active', isLooping);
  const audio = document.getElementById('audioElement');
  audio.loop = isLooping;
  savePlayerState();
}

/* ===== العشوائي ===== */
function toggleShuffle() {
  isShuffling = !isShuffling;
  const btn = document.getElementById('shuffleBtn');
  btn.classList.toggle('active', isShuffling);
  savePlayerState();
}

function playRandomSurah() {
  const randomIndex = Math.floor(Math.random() * reciterSurahs.length);
  openReciterSurah(reciterSurahs[randomIndex].number);
}

/* ===== شريط التقدم ===== */
function seekAudio(value) {
  const audio = document.getElementById('audioElement');
  if (!audio.duration) return;
  audio.currentTime = (value / 100) * audio.duration;
}

/* ===== الصوت ===== */
function changeVolume(value) {
  const audio = document.getElementById('audioElement');
  audio.volume = value / 100;
  updateVolumeIcon(value);
}

let previousVolume = 100;

function toggleMute() {
  const audio = document.getElementById('audioElement');
  const volumeBar = document.getElementById('volumeBar');

  if (audio.volume > 0) {
    previousVolume = audio.volume * 100;
    audio.volume = 0;
    volumeBar.value = 0;
    updateVolumeIcon(0);
  } else {
    audio.volume = previousVolume / 100;
    volumeBar.value = previousVolume;
    updateVolumeIcon(previousVolume);
  }
}

function updateVolumeIcon(value) {
  const icon = document.getElementById('volumeIcon');
  if (!icon) return;

  if (value == 0) {
    icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
  } else if (value < 50) {
    icon.innerHTML = '<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>';
  } else {
    icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
  }
}

/* ===== سرعة التشغيل ===== */
function toggleSpeedMenu() {
  const menu = document.getElementById('speedMenu');
  menu.classList.toggle('show');
}

function setSpeed(speed) {
  currentSpeed = speed;
  const audio = document.getElementById('audioElement');
  audio.playbackRate = speed;

  const label = document.getElementById('speedLabel');
  const lang = localStorage.getItem('lang') || 'ar';
  const speedText = speed === 1 ? '1x' : `${speed}x`;
  label.textContent = lang === 'ar' ? toArabicNumberListen(speedText) : speedText;

  document.querySelectorAll('.speed-menu button').forEach(btn => {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  }
  document.getElementById('speedMenu').classList.remove('show');
  savePlayerState();
}

document.addEventListener('click', (e) => {
  const speedMenu = document.getElementById('speedMenu');
  const speedBtn = document.getElementById('speedBtn');
  if (speedMenu && speedBtn && !speedBtn.contains(e.target) && !speedMenu.contains(e.target)) {
    speedMenu.classList.remove('show');
  }
});

/* ===== تحميل السورة ===== */
function downloadSurah() {
  if (!currentAudioUrl) return;
  const link = document.createElement('a');
  link.href = currentAudioUrl;
  link.download = currentAudioUrl.split('/').pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ===== حفظ آخر سورة ===== */
function saveLastPlayed(surahNumber) {
  try {
    const data = {
      surahNumber,
      reciterId: currentReciter?.id,
      reciterName: currentReciter?.name,
      timestamp: Date.now()
    };
    localStorage.setItem('lastPlayed', JSON.stringify(data));
  } catch (err) {
    console.error('خطأ في الحفظ:', err);
  }
}

/* ===== استرجاع آخر جلسة ===== */
async function resumeLastSession() {
  const state = getSavedPlayerState();
  if (!state || !state.reciterId || !state.surahNumber) return false;

  console.log('🔄 Resuming last session:', state);

  try {
    if (allReciters.length === 0) {
      await loadReciters();
    }

    const reciter = allReciters.find(r => r.id === state.reciterId);
    if (!reciter) {
      console.warn('Reciter not found');
      return false;
    }

    currentSpeed = state.speed || 1;
    isLooping = state.isLooping || false;
    isShuffling = state.isShuffling || false;

    await openReciter(reciter.id);

    const audio = document.getElementById('audioElement');
    if (audio && state.volume !== undefined) {
      audio.volume = state.volume;
      const volumeBar = document.getElementById('volumeBar');
      if (volumeBar) volumeBar.value = state.volume * 100;
    }

    await openReciterSurah(state.surahNumber, { resumeFrom: state.currentTime });

    if (isLooping) document.getElementById('loopBtn')?.classList.add('active');
    if (isShuffling) document.getElementById('shuffleBtn')?.classList.add('active');

    return true;
  } catch (err) {
    console.error('خطأ في استرجاع الجلسة:', err);
    return false;
  }
}

/* ===== إغلاق المشغل ===== */
function closePlayer() {
  const audio = document.getElementById('audioElement');

  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch (e) {}

  isPlaying = false;
  currentAudioUrl = '';

  stopAutoScroll();
  autoScrollEnabled = false;

  cancelSleepTimer();
  stopSaveStateInterval();
  clearSavedPlayerState();

  if (typeof stopStatsTracking === 'function') {
    stopStatsTracking();
  }

  const player = document.getElementById('audioPlayer');
  if (player) {
    player.classList.remove('show');
  }

  const btn = document.getElementById('autoScrollBtn');
  if (btn) btn.classList.remove('auto-active');

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  updateScrollStatus('stop');

  document.body.classList.remove('player-open');

  currentSurahIndex = -1;
  renderReciterSurahs();

  if (typeof showToast === 'function') {
    showToast('تم إغلاق المشغل');
  }
}

/* ===== إغلاق صفحة التشغيل ===== */
function closePlaying() {
  stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('reciterSurahsView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  savePlayerState();
}

/* ===== ربط الأحداث ===== */
document.addEventListener('DOMContentLoaded', () => {
  const audio = document.getElementById('audioElement');
  if (!audio) return;

  audio.addEventListener('timeupdate', () => {
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');

    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = percent;
      currentTimeEl.textContent = formatTime(audio.currentTime);
      updatePlayingAyahIndicator();
    }
  }, { passive: true });

  audio.addEventListener('loadedmetadata', () => {
    const durationEl = document.getElementById('durationTime');
    durationEl.textContent = formatTime(audio.duration);
  }, { passive: true });

  audio.addEventListener('ended', () => {
    if (typeof trackSurahCompleted === 'function' && currentSurahIndex >= 0) {
      const surah = reciterSurahs[currentSurahIndex];
      if (surah) trackSurahCompleted(surah.number);
    }

    if (isLooping) return;
    if (isShuffling) {
      playRandomSurah();
    } else {
      playNext();
    }
  });

  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseIcon();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }, { passive: true });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseIcon();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    savePlayerState();
  }, { passive: true });

  if (document.getElementById('recitersList')) {
    loadReciters();
  }
});

/* ===== حفظ الحالة قبل الإغلاق ===== */
window.addEventListener('beforeunload', () => {
  savePlayerState();
});

window.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    savePlayerState();
  }
});

/* ===== معالجة تغيير الاتجاه ===== */
const handleResize = debounce(() => {
  if (autoScrollEnabled) {
    autoScrollStartY = window.scrollY;
    autoScrollStartTime = performance.now();
  }
}, 300);

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

/* ===== إغلاق قارئ ===== */
function closeReciter() {
  stopAutoScroll();

  currentReciter = null;
  currentMoshaf = null;
  document.getElementById('reciterSurahsView').classList.remove('active');
  document.getElementById('recitersView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== عرض صفحة القرّاء ===== */
function showListen() {
  stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('recitersView').classList.add('active');

  updateSidebarActive('listen');
  closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (allReciters.length === 0) {
    loadReciters();
  }
}

/* ===== تحديث Sidebar ===== */
function updateSidebarActive(section) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  const items = document.querySelectorAll('.nav-item');
  if (section === 'quran' && items[0]) items[0].classList.add('active');
  if (section === 'listen' && items[1]) items[1].classList.add('active');
}

/* ===== إغلاق Sidebar ===== */
function closeSidebarIfOpen() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}

/* ===== البحث في آيات صفحة التشغيل ===== */
function normalizeListenSearchNumber(value) {
  return String(value)
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
}

function searchPlayingAyahs(query) {
  const results = document.getElementById('playingAyahSearchResults');
  if (!results) return;
  const value = query.trim().toLowerCase();
  if (!value) { results.innerHTML = ''; return; }
  const numberQuery = normalizeListenSearchNumber(value);
  const cleanQuery = removeTashkeelListen(value);
  const found = playingAyahs.filter((ayah, index) => {
    const translation = playingAyahTranslations[index]?.text || '';
    return String(ayah.numberInSurah) === numberQuery ||
      removeTashkeelListen(`${ayah.text} ${translation}`).toLowerCase().includes(cleanQuery);
  }).slice(0, 12);
  results.innerHTML = found.length
    ? found.map(ayah => `<button onclick="focusPlayingAyah(${ayah.numberInSurah})"><b>${toArabicNumberListen(ayah.numberInSurah)}</b><span>${ayah.text.slice(0, 90)}...</span></button>`).join('')
    : '<span class="playing-search-empty">لا توجد نتيجة</span>';
}

function focusPlayingAyah(ayahNumber) {
  const target = document.querySelector(`#playingAyahsContainer .ayah-line[data-ayah="${ayahNumber}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.querySelectorAll('#playingAyahsContainer .ayah-line').forEach(line => line.classList.remove('audio-reading'));
  target.classList.add('audio-reading');
  const results = document.getElementById('playingAyahSearchResults');
  if (results) results.innerHTML = '';
}

/* ===== مؤشر الآية أثناء التشغيل ===== */
function getAyahMarkerSettings() {
  const settings = typeof getDeveloperSettings === 'function' ? getDeveloperSettings() : null;
  return {
    mode: settings?.ayahMarkerMode || 'balanced',
    tolerance: Number(settings?.ayahTolerance || 1.2),
    debug: !!settings?.enableDebugLogs
  };
}

function getWeightedAyahIndex(currentTime, duration, ayahs) {
  if (!ayahs.length || !duration) return 0;
  const settings = getAyahMarkerSettings();
  const weights = ayahs.map((ayah) => {
    const text = (ayah.text || '').trim();
    const words = text.split(/\s+/).filter(Boolean).length || 1;
    const chars = text.length || 1;
    return words * 1.8 + chars * 0.025;
  });

  const totalWeight = weights.reduce((sum, val) => sum + val, 0) || 1;
  const normalizedTime = Math.min(Math.max(currentTime / duration, 0), 1);

  if (settings.mode === 'strict') {
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i] / totalWeight;
      if (normalizedTime <= cumulative + (settings.tolerance / 100)) {
        return i;
      }
    }
    return weights.length - 1;
  }

  if (settings.mode === 'relaxed') {
    const rawIndex = Math.floor(normalizedTime * ayahs.length);
    return Math.min(ayahs.length - 1, Math.max(0, rawIndex));
  }

  let cumulative = 0;
  const effectiveTolerance = Math.min(0.35, Math.max(0.06, settings.tolerance / 50));
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i] / totalWeight;
    if (normalizedTime <= cumulative + effectiveTolerance) {
      return i;
    }
  }
  return weights.length - 1;
}

function updatePlayingAyahIndicator() {
  const audio = document.getElementById('audioElement');
  if (!audio || !audio.duration || !playingAyahs.length) return;

  const settings = getAyahMarkerSettings();
  const targetIndex = getWeightedAyahIndex(audio.currentTime, audio.duration, playingAyahs);
  if (settings.debug) {
    console.log('[Ayah Marker]', { currentTime: audio.currentTime, duration: audio.duration, targetIndex, mode: settings.mode });
  }

  document.querySelectorAll('#playingAyahsContainer .ayah-line').forEach((line, lineIndex) => {
    line.classList.toggle('audio-reading', lineIndex === targetIndex);
  });
}

/* ===== Media Session ===== */
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !currentReciter || !reciterSurahs[currentSurahIndex]) return;
  const surah = reciterSurahs[currentSurahIndex];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `سورة ${removeTashkeelListen(surah.name)}`,
      artist: currentReciter.name,
      album: 'طريق الهدى'
    });
    const actions = {
      play: () => document.getElementById('audioElement')?.play(),
      pause: () => document.getElementById('audioElement')?.pause(),
      nexttrack: () => playNext(),
      previoustrack: () => playPrev()
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (error) {}
    });
  } catch (error) {
    console.warn('[Player] Media Session unavailable:', error);
  }
}

/* ===== استرجاع تلقائي عند التشغيل ===== */
window.addEventListener('load', () => {
  setTimeout(() => {
    const state = getSavedPlayerState();
    if (state && state.reciterId && state.surahNumber) {
      const player = document.getElementById('audioPlayer');
      if (player && !player.classList.contains('show')) {
        console.log('💾 يوجد جلسة محفوظة — روح للاستماع للاسترجاع');
      }
    }
  }, 2000);
});