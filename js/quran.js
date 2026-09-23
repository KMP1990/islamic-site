let allSurahs = [];
let filteredSurahs = [];
let currentFilter = 'all';

let currentSurahNumber = null;
let currentAyahNumber = null;
let currentTafsir = 'ar.miqbas';

let bookmarks = [];
let ayahSearchTimer = null;

const API_BASE = 'https://api.alquran.cloud/v1';
const BOOKMARKS_KEY = 'quran_bookmarks';
const IDB_TTL_SURAHS = 7 * 24 * 60 * 60 * 1000;
const IDB_TTL_AYAHS = 30 * 24 * 60 * 60 * 1000;

/* ===== إزالة التشكيل ===== */
function removeTashkeel(text) {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/ٱ/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArabicNumber(num) {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function normalizeSearchNumber(value) {
  return String(value)
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
}

/* ===== تحميل الإشارات ===== */
function loadBookmarks() {
  try {
    const saved = localStorage.getItem(BOOKMARKS_KEY);
    if (saved) bookmarks = JSON.parse(saved);
  } catch (err) {
    console.error('خطأ في تحميل الإشارات:', err);
    bookmarks = [];
  }
  updateBookmarksCount();
}

function saveBookmarks() {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch (err) {
    console.error('خطأ في حفظ الإشارات:', err);
  }
  updateBookmarksCount();
}

function updateBookmarksCount() {
  const el = document.getElementById('bookmarksCount');
  if (el) el.textContent = toArabicNumber(bookmarks.length);
}

/* ============================================
   تحميل السور (مع IndexedDB)
   ============================================ */
async function loadSurahs() {
  try {
    let data;
    if (window.idbHelper) {
      data = await window.idbHelper.fetch(`${API_BASE}/surah`, 'surahs', IDB_TTL_SURAHS);
    } else {
      const res = await fetch(`${API_BASE}/surah`);
      data = await res.json();
    }
    allSurahs = data.data;
    filteredSurahs = [...allSurahs];
    renderSurahs();
  } catch (err) {
    console.error('خطأ في تحميل السور:', err);
    document.getElementById('surahsList').innerHTML =
      '<div class="loading">تعذر تحميل السور. تحقق من الإنترنت.</div>';
  }
}

/* ===== عرض السور ===== */
function renderSurahs() {
  const list = document.getElementById('surahsList');
  if (!list) return;

  const lang = localStorage.getItem('lang') || 'ar';

  if (filteredSurahs.length === 0) {
    list.innerHTML = '<div class="loading">لا توجد نتائج</div>';
    return;
  }

  list.innerHTML = filteredSurahs.map((surah, i) => {
    const rawName = lang === 'ar' ? surah.name : surah.englishName;
    const name = lang === 'ar' ? removeTashkeel(rawName) : rawName;
    const type = surah.revelationType === 'Meccan'
      ? (lang === 'ar' ? 'مكية' : 'Meccan')
      : (lang === 'ar' ? 'مدنية' : 'Medinan');
    const ayahsText = lang === 'ar' ? 'آية' : 'verses';
    const numberDisplay = lang === 'ar'
      ? toArabicNumber(surah.number)
      : surah.number;

    return `
      <div class="surah-item" style="animation-delay: ${i * 0.015}s" onclick="openSurah(${surah.number})">
        <div class="surah-item-number">${numberDisplay}</div>
        <div class="surah-item-name">${name}</div>
        <div class="surah-item-meta">
          <span class="type">${type}</span>
          <span>${surah.numberOfAyahs} ${ayahsText}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== البحث في السور ===== */
function filterSurahs() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const numericQuery = normalizeSearchNumber(query);

  filteredSurahs = allSurahs.filter(s => {
    const cleanName = removeTashkeel(s.name).toLowerCase();
    const matchSearch =
      cleanName.includes(query) ||
      s.name.toLowerCase().includes(query) ||
      s.englishName.toLowerCase().includes(query) ||
      s.number.toString() === numericQuery;

    const matchFilter =
      currentFilter === 'all' ||
      (currentFilter === 'makkah' && s.revelationType === 'Meccan') ||
      (currentFilter === 'madinah' && s.revelationType === 'Medinan');

    return matchSearch && matchFilter;
  });

  renderSurahs();
}

function focusSearch() {
  const input = document.getElementById('searchInput');
  input.focus();
  filterSurahs();
}

/* ===== الفلاتر ===== */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (!btn.classList.contains('filter-bookmarks')) {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    }
  });
  filterSurahs();
}

/* ===== بحث الآيات (debounced) ===== */
function searchAyahsDebounced(query) {
  clearTimeout(ayahSearchTimer);
  ayahSearchTimer = setTimeout(() => {
    searchAyahs(query);
  }, 400);
}

/* ===== بحث الآيات (محلي داخل السورة) ===== */
function searchAyahs(query) {
  const resultsBox = document.getElementById('ayahSearchResults');
  if (!resultsBox) return;

  query = query.trim();

  const normalizedNumberQuery = normalizeSearchNumber(query);
  if (!query || (query.length < 2 && !/^\d+$/.test(normalizedNumberQuery))) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    return;
  }

  const ayahsContainer = document.getElementById('ayahsContainer');
  if (!ayahsContainer) return;

  resultsBox.style.display = 'block';
  resultsBox.innerHTML = '<div class="loading">جارٍ البحث...</div>';

  try {
    const lang = localStorage.getItem('lang') || 'ar';
    const cleanQuery = removeTashkeel(query).toLowerCase();
    const ayahLines = ayahsContainer.querySelectorAll('.ayah-line');

    if (ayahLines.length === 0) {
      resultsBox.innerHTML = `
        <div class="ayah-search-empty">
          لا توجد آيات للبحث فيها
        </div>
      `;
      return;
    }

    const results = [];

    ayahLines.forEach((line) => {
      const ayahTextEl = line.querySelector('.ayah-text');
      if (!ayahTextEl) return;

      const ayahText = ayahTextEl.textContent || '';
      const cleanAyahText = removeTashkeel(ayahText).toLowerCase();

      if (cleanAyahText.includes(cleanQuery) || (normalizedNumberQuery && String(line.dataset.ayah) === normalizedNumberQuery)) {
        const numEl = line.querySelector('.ayah-number');
        const ayahNum = numEl ? numEl.textContent.trim() : '';
        const ayahNumRaw = line.dataset.ayah || '';

        results.push({
          text: ayahText,
          ayahNum: ayahNum,
          ayahNumRaw: ayahNumRaw
        });
      }
    });

    if (results.length === 0) {
      resultsBox.innerHTML = `
        <div class="ayah-search-empty">
          لا توجد نتائج لـ "${query}" في هذه السورة
        </div>
      `;
      return;
    }

    const surah = allSurahs.find(s => s.number === currentSurahNumber);
    const surahName = surah
      ? (lang === 'ar' ? removeTashkeel(surah.name) : surah.englishName)
      : '';

    const countText = lang === 'ar'
      ? `${toArabicNumber(results.length)} نتيجة`
      : `${results.length} results`;

    const resultsHtml = results.map(r => {
      let highlighted = r.text;
      try {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        highlighted = r.text.replace(regex, '<span style="color: var(--gold); font-weight: 700;">$1</span>');
      } catch (e) {
        console.warn('خطأ في التظليل:', e);
      }

      return `
        <div class="ayah-result-item" onclick="scrollToAyah(${r.ayahNumRaw})">
          <div class="ayah-result-surah">
            <span>سورة ${surahName}</span>
            <span>•</span>
            <span>الآية ${r.ayahNum}</span>
          </div>
          <div class="ayah-result-text">${highlighted}</div>
        </div>
      `;
    }).join('');

    resultsBox.innerHTML = `
      <div class="ayah-search-count">${countText}</div>
      ${resultsHtml}
    `;
  } catch (err) {
    console.error('❌ خطأ في البحث:', err);

    resultsBox.innerHTML = `
      <div class="ayah-search-empty">
        تعذر البحث.
      </div>
    `;
  }
}

function performAyahSearch() {
  const input = document.getElementById('ayahSearchInput');
  if (input) searchAyahs(input.value);
}

/* ===== التمرير لآية معينة ===== */
function scrollToAyah(ayahNum) {
  const resultsBox = document.getElementById('ayahSearchResults');
  if (resultsBox) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
  }

  const input = document.getElementById('ayahSearchInput');
  if (input) input.value = '';

  const target = document.getElementById(`ayah-${ayahNum}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transition = 'background 0.5s ease';
    target.style.background = 'rgba(212, 175, 55, 0.3)';
    setTimeout(() => {
      target.style.background = '';
    }, 2500);
  }
}

/* ===== الانتقال لآية من قائمة المفضلة ===== */
function goToAyah(surahNumber, ayahNumber) {
  const resultsBox = document.getElementById('ayahSearchResults');
  if (resultsBox) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
  }

  const input = document.getElementById('ayahSearchInput');
  if (input) input.value = '';

  openSurah(surahNumber, ayahNumber);
}

/* ===== الإشارات ===== */
function isBookmarked(surah, ayah) {
  return bookmarks.some(b => b.surah === surah && b.ayah === ayah);
}

function toggleBookmark(surah, ayah, surahName, ayahText) {
  const index = bookmarks.findIndex(b => b.surah === surah && b.ayah === ayah);
  const lang = localStorage.getItem('lang') || 'ar';

  if (index >= 0) {
    bookmarks.splice(index, 1);
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? 'تم إزالة الإشارة' : 'Bookmark removed');
    }
  } else {
    bookmarks.push({
      surah, ayah, surahName, ayahText,
      timestamp: Date.now()
    });
    if (typeof showToast === 'function') {
      showToast(lang === 'ar' ? 'تم حفظ الإشارة' : 'Bookmarked');
    }
    if (typeof trackEvent === 'function') trackEvent('ayah_bookmarked');
  }

  saveBookmarks();

  document.querySelectorAll(`.ayah-bookmark-btn[data-surah="${surah}"][data-ayah="${ayah}"]`).forEach(btn => {
    btn.classList.toggle('bookmarked', isBookmarked(surah, ayah));
  });
}

function showBookmarks() {
  const list = document.getElementById('surahsList');
  const lang = localStorage.getItem('lang') || 'ar';

  if (!list) return;

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  const bookmarkBtn = document.querySelector('.filter-bookmarks');
  if (bookmarkBtn) bookmarkBtn.classList.add('active');

  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="loading">لا توجد إشارات مرجعية</div>';
    return;
  }

  const sorted = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);

  list.innerHTML = sorted.map((b, i) => {
    const surahName = b.surahName || `سورة ${b.surah}`;
    const ayahNum = lang === 'ar' ? toArabicNumber(b.ayah) : b.ayah;

    return `
      <div class="surah-item" style="animation-delay: ${i * 0.03}s" onclick="goToAyah(${b.surah}, ${b.ayah})">
        <div class="surah-item-number">🔖</div>
        <div class="surah-item-name">
          ${surahName} — الآية ${ayahNum}
        </div>
        <button class="ayah-bookmark-btn bookmarked" onclick="event.stopPropagation(); removeBookmarkFromList(${b.surah}, ${b.ayah})" style="opacity: 1; position: static; width: 32px; height: 32px;">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

function removeBookmarkFromList(surah, ayah) {
  bookmarks = bookmarks.filter(b => !(b.surah === surah && b.ayah === ayah));
  saveBookmarks();
  showBookmarks();
}

/* ============================================
   فتح السورة (مع IndexedDB)
   ============================================ */
async function openSurah(number, scrollToAyahTarget = null) {
  const lang = localStorage.getItem('lang') || 'ar';
  const surah = allSurahs.find(s => s.number === number);
  if (!surah) return;

  currentSurahNumber = number;

  const nameEl = document.getElementById('surahViewName');
  const infoEl = document.getElementById('surahViewInfo');
  const ayahsEl = document.getElementById('ayahsContainer');
  const basmala = document.getElementById('basmala');

  const rawName = lang === 'ar' ? surah.name : surah.englishName;
  const name = lang === 'ar' ? removeTashkeel(rawName) : rawName;
  const type = surah.revelationType === 'Meccan'
    ? (lang === 'ar' ? 'مكية' : 'Meccan')
    : (lang === 'ar' ? 'مدنية' : 'Medinan');
  const ayahsText = lang === 'ar' ? 'آية' : 'verses';

  nameEl.textContent = name;
  infoEl.textContent = `${type} • ${surah.numberOfAyahs} ${ayahsText}`;

  basmala.style.display = (number === 1 || number === 9) ? 'none' : 'block';

  ayahsEl.innerHTML = '<div class="loading">جارٍ التحميل...</div>';

  document.getElementById('surahsView').classList.remove('active');
  document.getElementById('surahView').classList.add('active');

  const floatingBtn = document.getElementById('floatingBackBtn');
  if (floatingBtn) floatingBtn.classList.add('show');

  const searchResults = document.getElementById('ayahSearchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
  }
  const searchInput = document.getElementById('ayahSearchInput');
  if (searchInput) searchInput.value = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    let data;
    if (window.idbHelper) {
      data = await window.idbHelper.fetch(`${API_BASE}/surah/${number}/ar.alafasy`, 'ayahs', IDB_TTL_AYAHS);
    } else {
      const res = await fetch(`${API_BASE}/surah/${number}/ar.alafasy`);
      data = await res.json();
    }
    const ayahs = data.data.ayahs;

    let translations = [];
    if (lang === 'en') {
      try {
        if (window.idbHelper) {
          const transData = await window.idbHelper.fetch(`${API_BASE}/surah/${number}/en.sahih`, 'ayahs', IDB_TTL_AYAHS);
          translations = transData.data.ayahs;
        } else {
          const transRes = await fetch(`${API_BASE}/surah/${number}/en.sahih`);
          const transData = await transRes.json();
          translations = transData.data.ayahs;
        }
      } catch (err) {
        console.error('خطأ في تحميل الترجمة:', err);
      }
    }

    const surahNameClean = removeTashkeel(surah.name);

    const text = ayahs.map((ayah, i) => {
      const numDisplay = lang === 'ar'
        ? toArabicNumber(ayah.numberInSurah)
        : ayah.numberInSurah;

      let translationHtml = '';
      if (lang === 'en' && translations[i]) {
        translationHtml = `<div class="ayah-translation">${translations[i].text}</div>`;
      }

      const ayahTextEscaped = ayah.text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const bookmarked = isBookmarked(number, ayah.numberInSurah);

      return `
        <div class="ayah-line" id="ayah-${ayah.numberInSurah}" data-ayah="${ayah.numberInSurah}">
          <span class="ayah-text" onclick="openTafsir(${number}, ${ayah.numberInSurah})">${ayah.text}</span>
          <span class="ayah-number" onclick="openTafsir(${number}, ${ayah.numberInSurah})">${numDisplay}</span>
          <button class="ayah-bookmark-btn ${bookmarked ? 'bookmarked' : ''}"
                  data-surah="${number}"
                  data-ayah="${ayah.numberInSurah}"
                  onclick="event.stopPropagation(); toggleBookmark(${number}, ${ayah.numberInSurah}, '${surahNameClean}', '${ayahTextEscaped}')"
                  title="حفظ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="ayah-share-btn"
                  onclick="event.stopPropagation(); shareAyahGlobal(${number}, ${ayah.numberInSurah}, '${ayahTextEscaped}', '${surahNameClean}')"
                  title="مشاركة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          ${translationHtml}
        </div>
      `;
    }).join('');

    ayahsEl.innerHTML = text;

    if (typeof trackEvent === 'function') {
      trackEvent('surah_opened', { surah: number, surahName: surahNameClean });
    }

    if (scrollToAyahTarget) {
      setTimeout(() => {
        const target = document.getElementById(`ayah-${scrollToAyahTarget}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.transition = 'background 0.5s ease';
          target.style.background = 'rgba(212, 175, 55, 0.3)';
          setTimeout(() => {
            target.style.background = '';
          }, 2500);
        }
      }, 400);
    }
  } catch (err) {
    console.error('خطأ في تحميل الآيات:', err);
    ayahsEl.innerHTML = '<div class="loading">تعذر تحميل الآيات.</div>';
  }
}

/* ===== إغلاق السورة ===== */
function closeSurah() {
  if (typeof stopAutoScroll === 'function') {
    stopAutoScroll();
  }

  const floatingBtn = document.getElementById('floatingBackBtn');
  if (floatingBtn) floatingBtn.classList.remove('show');

  const searchResults = document.getElementById('ayahSearchResults');
  if (searchResults) {
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
  }
  const searchInput = document.getElementById('ayahSearchInput');
  if (searchInput) searchInput.value = '';

  document.getElementById('surahView').classList.remove('active');
  document.getElementById('surahsView').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== فتح التفسير ===== */
async function openTafsir(surahNumber, ayahNumber) {
  if (typeof trackAyahRead === 'function') {
    trackAyahRead();
  }

  currentSurahNumber = surahNumber;
  currentAyahNumber = ayahNumber;

  if (typeof readingSettings !== 'undefined' && readingSettings.preferredTafsir) {
    currentTafsir = readingSettings.preferredTafsir;
  }

  const validTafsirs = ['ar.miqbas', 'ar.jalalayn', 'ar.muyassar', 'ar.qurtubi'];
  if (!validTafsirs.includes(currentTafsir)) {
    currentTafsir = 'ar.miqbas';
  }

  const modal = document.getElementById('tafsirModal');
  const title = document.getElementById('tafsirTitle');
  const ayahEl = document.getElementById('tafsirAyah');
  const textEl = document.getElementById('tafsirText');
  const lang = localStorage.getItem('lang') || 'ar';

  const surah = allSurahs.find(s => s.number === surahNumber);
  const surahName = surah ? removeTashkeel(surah.name) : '';

  if (lang === 'ar') {
    title.textContent = `الآية ${toArabicNumber(ayahNumber)} — ${surahName}`;
  } else {
    title.textContent = `Ayah ${ayahNumber} — ${surah?.englishName || ''}`;
  }

  textEl.innerHTML = '<div class="loading">جارٍ التحميل...</div>';
  modal.classList.add('open');
  ayahEl.textContent = '';

  document.querySelectorAll('.tafsir-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tafsir === currentTafsir);
  });

  loadTafsir(surahNumber, ayahNumber, currentTafsir);

  try {
    const res = await fetch(`${API_BASE}/ayah/${surahNumber}:${ayahNumber}/ar.alafasy`);
    const data = await res.json();
    ayahEl.textContent = data.data.text;
  } catch (err) {
    ayahEl.textContent = '';
  }
}

/* ===== تحميل التفسير ===== */
async function loadTafsir(surahNumber, ayahNumber, tafsirId) {
  const textEl = document.getElementById('tafsirText');
  textEl.innerHTML = '<div class="loading">جارٍ التحميل...</div>';

  const lang = localStorage.getItem('lang') || 'ar';

  try {
    if (lang === 'en') {
      const res = await fetch(`${API_BASE}/ayah/${surahNumber}:${ayahNumber}/en.sahih`);
      const data = await res.json();
      if (data.data && data.data.text) {
        textEl.textContent = data.data.text;
      } else {
        textEl.innerHTML = '<div class="loading">No translation available.</div>';
      }
    } else {
      const res = await fetch(`${API_BASE}/ayah/${surahNumber}:${ayahNumber}/${tafsirId}`);

      if (!res.ok) {
        throw new Error('API Error');
      }

      const data = await res.json();

      const tafsirText = data.data && data.data.text ? data.data.text : '';

      const ayahRes = await fetch(`${API_BASE}/ayah/${surahNumber}:${ayahNumber}/ar.alafasy`);
      const ayahData = await ayahRes.json();
      const originalText = ayahData.data ? ayahData.data.text : '';

      if (!tafsirText || tafsirText.trim() === originalText.trim()) {
        textEl.innerHTML = '<div class="loading">لا يوجد تفسير متوفر لهذه الآية في هذا التفسير.</div>';
        return;
      }

      textEl.textContent = tafsirText;
    }
  } catch (err) {
    console.error('خطأ في تحميل التفسير:', err);
    textEl.innerHTML = '<div class="loading">تعذر تحميل التفسير.</div>';
  }
}

function switchTafsir(tafsirId) {
  currentTafsir = tafsirId;

  if (typeof readingSettings !== 'undefined') {
    readingSettings.preferredTafsir = tafsirId;
    if (typeof saveReadingSettings === 'function') saveReadingSettings();

    const select = document.getElementById('preferredTafsir');
    if (select) select.value = tafsirId;
  }

  document.querySelectorAll('.tafsir-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tafsir === tafsirId);
  });

  if (currentSurahNumber && currentAyahNumber) {
    loadTafsir(currentSurahNumber, currentAyahNumber, tafsirId);
  }
}

function closeTafsir() {
  document.getElementById('tafsirModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('tafsirModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'tafsirModal') closeTafsir();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTafsir();
  });
});

/* ===== Sidebar ===== */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

function goHome() {
  window.location.href = 'index.html';
}

function showQuran() {
  if (typeof stopAutoScroll === 'function') {
    stopAutoScroll();
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('surahsView').classList.add('active');

  updateSidebarActive('quran');
  closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.openTafsirQuran = openTafsir;

/* ===== تشغيل ===== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('surahsList')) {
    loadBookmarks();
    loadSurahs();
  }
});