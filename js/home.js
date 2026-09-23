/* ===== الصفحة الرئيسية ===== */

const AYAHS_OF_DAY = [
  { text: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾', ref: 'سورة طه — الآية ١١٤' },
  { text: '﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾', ref: 'سورة الرعد — الآية ٢٨' },
  { text: '﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾', ref: 'سورة الشرح — الآية ٦' },
  { text: '﴿ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ﴾', ref: 'سورة الطلاق — الآية ٣' },
  { text: '﴿ وَاذْكُر رَّبَّكَ إِذَا نَسِيتَ ﴾', ref: 'سورة الكهف — الآية ٢٤' },
  { text: '﴿ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ ﴾', ref: 'سورة البقرة — الآية ١٥٣' },
  { text: '﴿ وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ ﴾', ref: 'سورة الحديد — الآية ٤' },
  { text: '﴿ فَاذْكُرُونِي أَذْكُرْكُمْ ﴾', ref: 'سورة البقرة — الآية ١٥٢' },
  { text: '﴿ وَبَشِّرِ الصَّابِرِينَ ﴾', ref: 'سورة البقرة — الآية ١٥٥' },
  { text: '﴿ رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً ﴾', ref: 'سورة البقرة — الآية ٢٠١' },
  { text: '﴿ إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ ﴾', ref: 'سورة النحل — الآية ٩٠' },
  { text: '﴿ وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ﴾', ref: 'سورة هود — الآية ٨٨' }
];

/* ===== عرض الصفحة الرئيسية ===== */
function showHome() {
  if (typeof stopAutoScroll === 'function') stopAutoScroll();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('homeView').classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  if (items[0]) items[0].classList.add('active');

  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  loadHomeContent();
  if (typeof updateGlobalBackBtn === 'function') updateGlobalBackBtn();
}

/* ===== تحميل محتوى الصفحة ===== */
async function loadHomeContent() {
  loadAyahOfDay();
  loadHomeNextPrayer();
  loadLastPlayed();
  if (typeof renderHomeEvents === 'function') await renderHomeEvents();
  if (typeof renderHomeAds === 'function') await renderHomeAds();
  if (typeof renderSiteBanner === 'function') renderSiteBanner();
  if (typeof renderDevMessages === 'function') renderDevMessages();
}

/* ===== آية اليوم ===== */
function loadAyahOfDay() {
  const textEl = document.getElementById('homeAyahText');
  const refEl = document.getElementById('homeAyahRef');
  if (!textEl || !refEl) return;

  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % AYAHS_OF_DAY.length;
  const ayah = AYAHS_OF_DAY[index];

  textEl.style.opacity = '0';
  refEl.style.opacity = '0';

  setTimeout(() => {
    textEl.textContent = ayah.text;
    refEl.textContent = ayah.ref;
    textEl.style.transition = 'opacity 0.6s ease';
    refEl.style.transition = 'opacity 0.6s ease';
    textEl.style.opacity = '1';
    refEl.style.opacity = '1';
  }, 200);
}

/* ===== الصلاة القادمة ===== */
function loadHomeNextPrayer() {
  const nameEl = document.getElementById('homeNextPrayerName');
  const timeEl = document.getElementById('homeNextPrayerTime');
  const remainEl = document.getElementById('homeNextPrayerRemaining');
  const card = document.getElementById('homePrayerCard');
  if (!nameEl || !timeEl || !remainEl) return;

  if (typeof prayerTimes === 'undefined' || !prayerTimes || Object.keys(prayerTimes).length === 0) {
    nameEl.textContent = 'اضغط للعرض';
    timeEl.textContent = '—';
    remainEl.textContent = '—';

    if (card) {
      card.onclick = () => { if (typeof showPrayer === 'function') showPrayer(); };
      card.style.cursor = 'pointer';
    }

    if (typeof fetchPrayerTimes === 'function') {
      fetchPrayerTimes().then(() => updateHomePrayerDisplay()).catch(() => {});
    }
    return;
  }

  updateHomePrayerDisplay();

  if (card) {
    card.onclick = () => { if (typeof showPrayer === 'function') showPrayer(); };
    card.style.cursor = 'pointer';
  }
}

function updateHomePrayerDisplay() {
  const nameEl = document.getElementById('homeNextPrayerName');
  const timeEl = document.getElementById('homeNextPrayerTime');
  const remainEl = document.getElementById('homeNextPrayerRemaining');
  if (!nameEl || !timeEl || !remainEl) return;
  if (typeof getNextPrayer !== 'function') return;

  const next = getNextPrayer();
  if (!next) return;

  const prayerName = typeof getPrayerNameAr === 'function' ? getPrayerNameAr(next.key) : next.key;
  const icon = typeof getPrayerIcon === 'function' ? getPrayerIcon(next.key) : '🕐';

  nameEl.textContent = `${icon} ${prayerName}`;
  timeEl.textContent = next.displayTime;
  updateHomePrayerRemaining(next.time);
}

function updateHomePrayerRemaining(targetTime) {
  const remainEl = document.getElementById('homeNextPrayerRemaining');
  if (!remainEl) return;
  const now = new Date();
  const diff = targetTime - now;
  if (diff <= 0) { remainEl.textContent = 'الآن'; return; }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const lang = localStorage.getItem('lang') || 'ar';
  const toAr = (t) => t.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  remainEl.textContent = lang === 'ar' ? `متبقي ${toAr(timeStr)}` : `Remaining ${timeStr}`;
}

let homePrayerInterval = null;

function startHomePrayerTimer() {
  if (homePrayerInterval) clearInterval(homePrayerInterval);
  homePrayerInterval = setInterval(() => {
    const homeView = document.getElementById('homeView');
    if (homeView && homeView.classList.contains('active')) {
      if (typeof getNextPrayer === 'function' && typeof prayerTimes !== 'undefined' && prayerTimes && Object.keys(prayerTimes).length > 0) {
        const next = getNextPrayer();
        if (next) {
          updateHomePrayerRemaining(next.time);
          const nameEl = document.getElementById('homeNextPrayerName');
          const timeEl = document.getElementById('homeNextPrayerTime');
          if (nameEl && typeof getPrayerNameAr === 'function') {
            nameEl.textContent = `${getPrayerIcon(next.key)} ${getPrayerNameAr(next.key)}`;
          }
          if (timeEl) timeEl.textContent = next.displayTime;
        }
      }
    }
  }, 1000);
}

/* ===== آخر سورة ===== */
function loadLastPlayed() {
  const container = document.getElementById('homeLastPlayed');
  const nameEl = document.getElementById('homeLastSurahName');
  const reciterEl = document.getElementById('homeLastReciterName');
  if (!container || !nameEl || !reciterEl) return;

  try {
    const saved = localStorage.getItem('lastPlayed');
    if (!saved) { container.style.display = 'none'; return; }
    const data = JSON.parse(saved);
    if (!data.surahNumber) { container.style.display = 'none'; return; }

    const lang = localStorage.getItem('lang') || 'ar';
    let surahName = `سورة ${data.surahNumber}`;

    if (typeof allQuranSurahs !== 'undefined' && allQuranSurahs.length > 0) {
      const surah = allQuranSurahs.find(s => s.number === data.surahNumber);
      if (surah) {
        surahName = lang === 'ar'
          ? (typeof removeTashkeelListen === 'function' ? removeTashkeelListen(surah.name) : surah.name)
          : surah.englishName;
      }
    } else if (typeof allSurahs !== 'undefined' && allSurahs.length > 0) {
      const surah = allSurahs.find(s => s.number === data.surahNumber);
      if (surah) {
        surahName = lang === 'ar'
          ? (typeof removeTashkeel === 'function' ? removeTashkeel(surah.name) : surah.name)
          : surah.englishName;
      }
    }

    nameEl.textContent = surahName;
    reciterEl.textContent = data.reciterName || '';
    container.style.display = 'block';
  } catch (err) {
    console.error('خطأ في تحميل آخر سورة:', err);
    container.style.display = 'none';
  }
}

function resumeLastPlayed() {
  try {
    const saved = localStorage.getItem('lastPlayed');
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!data.surahNumber || !data.reciterId) return;

    if (typeof showListen === 'function') {
      showListen();
      setTimeout(() => {
        const reciter = allReciters.find(r => r.id === data.reciterId);
        if (reciter) {
          openReciter(reciter.id);
          setTimeout(() => openReciterSurah(data.surahNumber), 1000);
        }
      }, 1500);
    }
  } catch (err) {
    console.error('خطأ في المتابعة:', err);
  }
}

/* ============================================
   ✅ زر الرجوع الدائمي — Global Back Button
   ============================================ */

function goToHomeFromAnywhere() {
  // إذا كان في الرئيسية → لا تفعل شيء
  const homeView = document.getElementById('homeView');
  if (homeView && homeView.classList.contains('active')) return;

  // إغلاق أي نوافذ مفتوحة
  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  if (typeof closeTafsir === 'function') closeTafsir();
  if (typeof closeAvatarModal === 'function') closeAvatarModal();
  if (typeof closeDeveloperLoginModal === 'function') closeDeveloperLoginModal();

  // العودة للرئيسية
  showHome();
}

function updateGlobalBackBtn() {
  const btn = document.getElementById('globalBackBtn');
  if (!btn) return;

  // ✅ فحص ميزة الرجوع
  if (typeof isFeatureEnabled === 'function' && !isFeatureEnabled('global_back_btn')) {
    btn.classList.remove('visible');
    return;
  }

  const homeView = document.getElementById('homeView');
  const isHome = homeView && homeView.classList.contains('active');

  // إخفاء في الرئيسية، إظهار في باقي الأقسام
  btn.classList.toggle('visible', !isHome);
}

/* ===== بدء ===== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('homeView')) {
    loadHomeContent();
    startHomePrayerTimer();
  }

  // ربط زر الرجوع الدائمي
  updateGlobalBackBtn();

  // فحص دوري خفيف كل ثانية
  setInterval(updateGlobalBackBtn, 800);

  // فحص عند أي نقرة
  document.addEventListener('click', () => {
    setTimeout(updateGlobalBackBtn, 100);
  });
});

window.goToHomeFromAnywhere = goToHomeFromAnywhere;
window.updateGlobalBackBtn = updateGlobalBackBtn;