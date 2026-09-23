/* ===== إحصائيات المستخدم ===== */

const STATS_KEY = 'user_stats';

/* ===== الهيكل الافتراضي ===== */
function getDefaultStats() {
  return {
    ayahsRead: 0,
    totalSeconds: 0,
    surahsListened: [],
    completedSurahs: [],
    surahCounts: {},
    reciterCounts: {},
    dailyMinutes: {},
    currentStreak: 0,
    lastVisitDate: null,
    lastListenedDate: null
  };
}

/* ===== تحميل الإحصائيات ===== */
function loadStats() {
  try {
    const saved = localStorage.getItem(STATS_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      return { ...getDefaultStats(), ...data };
    }
  } catch (err) {
    console.error('خطأ في تحميل الإحصائيات:', err);
  }
  return getDefaultStats();
}

/* ===== حفظ الإحصائيات ===== */
function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    // ✅ تحديث الملف الشخصي تلقائياً
    if (typeof populateProfileStats === 'function') {
      populateProfileStats();
    }
  } catch (err) {
    console.error('خطأ في حفظ الإحصائيات:', err);
  }
}

/* ===== التاريخ بصيغة YYYY-MM-DD ===== */
function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ===== فرق الأيام ===== */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff;
}

/* ===== تحديث Streak ===== */
function updateStreak(stats) {
  const today = getTodayKey();

  if (!stats.lastVisitDate) {
    stats.currentStreak = 1;
    stats.lastVisitDate = today;
  } else if (stats.lastVisitDate === today) {
    // نفس اليوم
  } else {
    const diff = daysBetween(stats.lastVisitDate, today);
    if (diff === 1) {
      stats.currentStreak = (stats.currentStreak || 0) + 1;
    } else if (diff > 1) {
      stats.currentStreak = 1;
    }
    stats.lastVisitDate = today;
  }
}

/* ===== تسجيل استماع ===== */
let listenedSecondsBuffer = 0;

function trackListening(seconds = 1, surahNumber = null, reciter = null) {
  const stats = loadStats();

  stats.totalSeconds = (stats.totalSeconds || 0) + seconds;

  const today = getTodayKey();
  if (!stats.dailyMinutes) stats.dailyMinutes = {};
  const currentMinutes = stats.dailyMinutes[today] || 0;
  stats.dailyMinutes[today] = currentMinutes + (seconds / 60);

  if (surahNumber) {
    if (!stats.surahsListened) stats.surahsListened = [];
    if (!stats.surahsListened.includes(surahNumber)) {
      stats.surahsListened.push(surahNumber);
    }

    if (!stats.surahCounts) stats.surahCounts = {};
    stats.surahCounts[surahNumber] = (stats.surahCounts[surahNumber] || 0) + seconds;
  }

  if (reciter && reciter.id) {
    if (!stats.reciterCounts) stats.reciterCounts = {};
    if (!stats.reciterCounts[reciter.id]) {
      stats.reciterCounts[reciter.id] = { name: reciter.name, count: 0 };
    }
    stats.reciterCounts[reciter.id].count += seconds;
  }

  saveStats(stats);
}

/* ===== تسجيل قراءة آية ===== */
function trackAyahRead() {
  const stats = loadStats();
  stats.ayahsRead = (stats.ayahsRead || 0) + 1;
  saveStats(stats);
}

/* ===== تسجيل إكمال سورة ===== */
function trackSurahCompleted(surahNumber) {
  const stats = loadStats();
  if (!stats.completedSurahs) stats.completedSurahs = [];
  if (!stats.completedSurahs.includes(surahNumber)) {
    stats.completedSurahs.push(surahNumber);
  }
  saveStats(stats);
}

/* ===== تتبع ===== */
let currentStatsReciter = null;
let currentStatsSurah = null;
let statsIntervalTimer = null;

function startStatsTracking(surahNumber, reciter) {
  currentStatsSurah = surahNumber;
  currentStatsReciter = reciter;

  if (statsIntervalTimer) clearInterval(statsIntervalTimer);

  statsIntervalTimer = setInterval(() => {
    const audio = document.getElementById('audioElement');
    if (audio && !audio.paused && !audio.ended) {
      trackListening(1, currentStatsSurah, currentStatsReciter);
    }
  }, 1000);
}

function stopStatsTracking() {
  if (statsIntervalTimer) {
    clearInterval(statsIntervalTimer);
    statsIntervalTimer = null;
  }
}

/* ===== عرض الإحصائيات ===== */
function renderStats() {
  const stats = loadStats();

  updateStreak(stats);
  saveStats(stats);

  const lang = localStorage.getItem('lang') || 'ar';

  const streakEl = document.getElementById('streakNumber');
  if (streakEl) {
    streakEl.textContent = lang === 'ar'
      ? toArabicNumberListenStats(stats.currentStreak || 0)
      : (stats.currentStreak || 0);
  }

  const ayahsEl = document.getElementById('statsAyahsRead');
  if (ayahsEl) {
    ayahsEl.textContent = lang === 'ar'
      ? toArabicNumberListenStats(stats.ayahsRead || 0)
      : (stats.ayahsRead || 0);
  }

  const minutesEl = document.getElementById('statsMinutes');
  if (minutesEl) {
    const totalMin = Math.floor((stats.totalSeconds || 0) / 60);
    minutesEl.textContent = lang === 'ar'
      ? toArabicNumberListenStats(totalMin)
      : totalMin;
  }

  const surahsEl = document.getElementById('statsSurahs');
  if (surahsEl) {
    const count = (stats.surahsListened || []).length;
    surahsEl.textContent = lang === 'ar'
      ? toArabicNumberListenStats(count)
      : count;
  }

  const completedEl = document.getElementById('statsCompleted');
  if (completedEl) {
    const count = (stats.completedSurahs || []).length;
    completedEl.textContent = lang === 'ar'
      ? toArabicNumberListenStats(count)
      : count;
  }

  const topSurahEl = document.getElementById('statsTopSurah');
  if (topSurahEl) {
    const topSurah = getTopSurah(stats);
    topSurahEl.textContent = topSurah || '—';
  }

  const topReciterEl = document.getElementById('statsTopReciter');
  if (topReciterEl) {
    const topReciter = getTopReciter(stats);
    topReciterEl.textContent = topReciter || '—';
  }

  renderChart(stats);
}

/* ===== أكثر سورة ===== */
function getTopSurah(stats) {
  if (!stats.surahCounts || Object.keys(stats.surahCounts).length === 0) return null;

  let topId = null;
  let topCount = 0;

  for (const [id, count] of Object.entries(stats.surahCounts)) {
    if (count > topCount) {
      topCount = count;
      topId = parseInt(id);
    }
  }

  if (!topId) return null;

  if (typeof allQuranSurahs !== 'undefined' && allQuranSurahs.length > 0) {
    const surah = allQuranSurahs.find(s => s.number === topId);
    if (surah) {
      const lang = localStorage.getItem('lang') || 'ar';
      return lang === 'ar' ? removeTashkeelListen(surah.name) : surah.englishName;
    }
  }

  return `سورة ${topId}`;
}

/* ===== أكثر قارئ ===== */
function getTopReciter(stats) {
  if (!stats.reciterCounts || Object.keys(stats.reciterCounts).length === 0) return null;

  let topName = null;
  let topCount = 0;

  for (const data of Object.values(stats.reciterCounts)) {
    if (data.count > topCount) {
      topCount = data.count;
      topName = data.name;
    }
  }

  return topName;
}

/* ===== الرسم البياني ===== */
function renderChart(stats) {
  const chartEl = document.getElementById('statsChart');
  if (!chartEl) return;

  const days = getLast7Days();
  const dailyMinutes = stats.dailyMinutes || {};

  let maxMin = 1;
  days.forEach(day => {
    const min = dailyMinutes[day.key] || 0;
    if (min > maxMin) maxMin = min;
  });

  const lang = localStorage.getItem('lang') || 'ar';

  chartEl.innerHTML = days.map(day => {
    const minutes = dailyMinutes[day.key] || 0;
    const percent = (minutes / maxMin) * 100;
    const height = Math.max(percent, 4);

    const valueText = minutes > 0
      ? (lang === 'ar' ? toArabicNumberListenStats(Math.round(minutes)) : Math.round(minutes))
      : '';

    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar-value">${valueText}</div>
        <div class="chart-bar">
          <div class="chart-bar-fill ${minutes === 0 ? 'empty' : ''}" style="height: ${height}%"></div>
        </div>
        <div class="chart-bar-day">${day.label}</div>
      </div>
    `;
  }).join('');
}

/* ===== آخر 7 أيام ===== */
function getLast7Days() {
  const days = [];
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const lang = localStorage.getItem('lang') || 'ar';

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;

    days.push({
      key,
      label: lang === 'ar' ? dayNames[d.getDay()] : dayNamesEn[d.getDay()]
    });
  }

  return days;
}

/* ===== أرقام عربية ===== */
function toArabicNumberListenStats(num) {
  return num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/* ===== إعادة تعيين ===== */
function resetStats() {
  const lang = localStorage.getItem('lang') || 'ar';
  const confirmed = confirm(
    lang === 'ar'
      ? 'هل أنت متأكد من إعادة تعيين جميع الإحصائيات؟'
      : 'Are you sure you want to reset all statistics?'
  );

  if (confirmed) {
    localStorage.removeItem(STATS_KEY);
    renderStats();

    // ✅ تحديث الملف الشخصي أيضاً
    if (typeof populateProfileStats === 'function') {
      populateProfileStats();
    }
  }
}

/* ===== عرض صفحة الإحصائيات ===== */
function showStats() {
  stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('statsView').classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  if (items[8]) items[8].classList.add('active');

  closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderStats();
}

window.renderStats = renderStats;
window.resetStats = resetStats;
window.showStats = showStats;