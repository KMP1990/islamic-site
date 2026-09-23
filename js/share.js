/* ===== مشاركة المحتوى ===== */

/* ===== مشاركة سورة (من صفحة القرآن) ===== */
async function shareSurah() {
  if (!currentSurahNumber) return;

  const surah = allSurahs.find(s => s.number === currentSurahNumber);
  if (!surah) return;

  const lang = localStorage.getItem('lang') || 'ar';
  const name = lang === 'ar' ? removeTashkeel(surah.name) : surah.englishName;

  const title = lang === 'ar' ? `سورة ${name}` : `Surah ${name}`;
  const text = lang === 'ar'
    ? `اقرأ سورة ${name} على طريق الهدى 📖`
    : `Read Surah ${name} on Tariq Al-Huda 📖`;

  const url = `${window.location.origin}${window.location.pathname}?surah=${currentSurahNumber}`;

  await shareContent({ title, text, url });
}

/* ===== مشاركة سورة (من صفحة الاستماع) ===== */
async function sharePlayingSurah() {
  if (currentSurahIndex < 0 || !reciterSurahs[currentSurahIndex]) return;

  const surah = reciterSurahs[currentSurahIndex];
  const lang = localStorage.getItem('lang') || 'ar';
  const name = lang === 'ar' ? removeTashkeelListen(surah.name) : surah.englishName;
  const reciterName = currentReciter?.name || '';

  const title = lang === 'ar' ? `سورة ${name}` : `Surah ${name}`;
  const text = lang === 'ar'
    ? `استمع إلى سورة ${name} بصوت ${reciterName} 🎧\nعلى طريق الهدى`
    : `Listen to Surah ${name} by ${reciterName} 🎧\nOn Tariq Al-Huda`;

  const url = `${window.location.origin}${window.location.pathname}?surah=${surah.number}&reciter=${currentReciter?.id || ''}`;

  await shareContent({ title, text, url });
}

/* ===== مشاركة آية ===== */
async function shareAyah(surahNumber, ayahNumber, ayahText, surahName) {
  const lang = localStorage.getItem('lang') || 'ar';

  const title = lang === 'ar'
    ? `آية ${ayahNumber} من سورة ${surahName}`
    : `Ayah ${ayahNumber} from Surah ${surahName}`;

  const text = lang === 'ar'
    ? `${ayahText}\n\n﴿ سورة ${surahName} - الآية ${ayahNumber} ﴾\n\nمن موقع طريق الهدى 📖`
    : `${ayahText}\n\n﴿ Surah ${surahName} - Ayah ${ayahNumber} ﴾\n\nFrom Tariq Al-Huda 📖`;

  const url = `${window.location.origin}${window.location.pathname}?surah=${surahNumber}&ayah=${ayahNumber}`;

  await shareContent({ title, text, url });
}

/* ===== مشاركة عامة ===== */
async function shareContent({ title, text, url }) {
  const lang = localStorage.getItem('lang') || 'ar';

  // ✅ Web Share API (على الجوال)
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      // المستخدم ألغى المشاركة أو خطأ
      if (err.name === 'AbortError') return;
      console.log('Web Share فشل:', err);
    }
  }

  // ✅ نسخ الرابط (على الكمبيوتر)
  await copyToClipboard(url, lang);
}

/* ===== نسخ للحافظة ===== */
async function copyToClipboard(text, lang) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(
      lang === 'ar' ? '✅ تم نسخ الرابط!' : '✅ Link copied!'
    );
  } catch (err) {
    // طريقة بديلة
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast(
        lang === 'ar' ? '✅ تم نسخ الرابط!' : '✅ Link copied!'
      );
    } catch (e) {
      showToast(
        lang === 'ar' ? '❌ تعذر النسخ' : '❌ Copy failed'
      );
    }
    document.body.removeChild(textarea);
  }
}

/* ===== إظهار إشعار Toast ===== */
function showToast(message) {
  // إزالة أي toast قديم
  const old = document.querySelector('.toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // إظهار
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // إخفاء بعد 2.5 ثانية
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

/* ===== مشاركة آية (للاستخدام من quran.js) ===== */
window.shareAyahGlobal = shareAyah;