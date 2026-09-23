/* ===== نظام الاستخارة الذكية — v1 =====
   عشوائية رياضية بحتة — موزونة على 5 فئات متساوية
   لا ذكاء اصطناعي، لا قواعد معنوية
*/

const ISTIKHARA_STATE_KEY = 'tariq_istikhara_state';
const ISTIKHARA_SALAWAT_TARGET = 3;

let istikharaData = null;
let istikharaState = {
  stage: 1,
  question: '',
  salawatCount: 0,
  result: null
};

/* ===== تحميل البيانات ===== */
async function loadIstikharaData() {
  if (istikharaData) return istikharaData;
  try {
    const res = await fetch('data/istikhara.json');
    istikharaData = await res.json();
    return istikharaData;
  } catch (err) {
    console.error('[Istikhara] فشل تحميل البيانات:', err);
    return null;
  }
}

/* ===== توليد أرقام عشوائية آمنة ===== */
function secureRandomInt(max) {
  if (max <= 0) return 0;
  // crypto.getRandomValues أكثر عشوائية من Math.random
  if (window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/* ===== اختيار الفئة بشكل موزون (كل فئة 20%) ===== */
function pickWeightedCategory() {
  const categories = Object.keys(istikharaData.categories);
  // توزيع متساوٍ تماماً — عشوائية نقية
  return categories[secureRandomInt(categories.length)];
}

/* ===== اختيار آية عشوائية من فئة ===== */
function pickRandomVerse(categoryKey) {
  const verses = istikharaData.categories[categoryKey].verses;
  return verses[secureRandomInt(verses.length)];
}

/* ===== توليد النتيجة (عشوائية كاملة) ===== */
function generateIstikharaResult() {
  const categoryKey = pickWeightedCategory();
  const verse = pickRandomVerse(categoryKey);
  const category = istikharaData.categories[categoryKey];

  return {
    categoryKey,
    categoryLabel: category.label,
    categoryColor: category.color,
    categoryIcon: category.icon,
    verseText: verse.text,
    verseRef: verse.ref,
    wisdom: istikharaData.wisdom[categoryKey] || '',
    timestamp: Date.now(),
    question: istikharaState.question
  };
}

/* ===== عرض الصفحة ===== */
function showIstikhara() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('istikharaView')?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  initIstikhara();
}

/* ===== التهيئة ===== */
async function initIstikhara() {
  createStars();
  await loadIstikharaData();
  resetIstikhara(true);
}

/* ===== نجوم الخلفية ===== */
function createStars() {
  const container = document.querySelector('.istikhara-stars');
  if (!container || container.childElementCount > 0) return;

  for (let i = 0; i < 18; i++) {
    const star = document.createElement('span');
    star.className = 'istikhara-star';
    star.style.left = `${secureRandomInt(100)}%`;
    star.style.top = `${secureRandomInt(100)}%`;
    star.style.animationDelay = `${(secureRandomInt(3000) / 1000).toFixed(2)}s`;
    star.style.animationDuration = `${(2000 + secureRandomInt(2000))}ms`;
    container.appendChild(star);
  }
}

/* ===== إعادة تعيين ===== */
function resetIstikhara(silent = false) {
  istikharaState = {
    stage: 1,
    question: '',
    salawatCount: 0,
    result: null
  };

  const textarea = document.getElementById('istikharaQuestion');
  if (textarea) textarea.value = '';

  updateCharCount();
  updateProgress();
  showStage(1);

  if (!silent && typeof showToast === 'function') {
    showToast('تم إعادة الاستخارة');
  }
}

/* ===== شريط التقدم ===== */
function updateProgress() {
  document.querySelectorAll('.istikhara-step-dot').forEach((dot, i) => {
    const stepNum = i + 1;
    dot.classList.toggle('active', stepNum === istikharaState.stage);
    dot.classList.toggle('done', stepNum < istikharaState.stage);
  });
}

/* ===== عرض مرحلة ===== */
function showStage(num) {
  document.querySelectorAll('.istikhara-stage').forEach(stage => {
    stage.classList.toggle('active', Number(stage.dataset.stage) === num);
  });
  istikharaState.stage = num;
  updateProgress();
}

/* ===== المرحلة 1 → 2 ===== */
function goToQuestionStage() {
  showStage(2);
  setTimeout(() => {
    document.getElementById('istikharaQuestion')?.focus();
  }, 300);
}

/* ===== عدّاد الأحرف ===== */
function updateCharCount() {
  const textarea = document.getElementById('istikharaQuestion');
  const counter = document.getElementById('istikharaCharCount');
  if (!textarea || !counter) return;

  const len = textarea.value.length;
  const max = 500;
  counter.textContent = `${len} / ${max}`;

  if (len > max) {
    textarea.value = textarea.value.slice(0, max);
    counter.textContent = `${max} / ${max}`;
  }
}

/* ===== المرحلة 2 → 3 ===== */
function submitQuestion() {
  const textarea = document.getElementById('istikharaQuestion');
  const question = textarea?.value.trim() || '';

  if (question.length < 5) {
    if (typeof showToast === 'function') {
      showToast('اكتب حاجتك بوضوح (5 أحرف على الأقل)');
    }
    textarea?.focus();
    return;
  }

  istikharaState.question = question;
  istikharaState.salawatCount = 0;

  const counterEl = document.getElementById('istikharaCounterNum');
  if (counterEl) counterEl.textContent = '0';

  const btn = document.getElementById('istikharaSalawatBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="istikhara-btn-icon">🤲</span> صليت — أعد مرة أخرى';
  }

  showStage(3);
}

/* ===== المرحلة 3: عداد الصلاة ===== */
function incrementSalawat() {
  if (istikharaState.stage !== 3) return;

  istikharaState.salawatCount += 1;

  const counterEl = document.getElementById('istikharaCounterNum');
  if (counterEl) {
    counterEl.textContent = istikharaState.salawatCount;
    counterEl.classList.remove('bump');
    // force reflow لإعادة تشغيل الأنيميشن
    void counterEl.offsetWidth;
    counterEl.classList.add('bump');
  }

  if (navigator.vibrate) navigator.vibrate(30);

  if (istikharaState.salawatCount >= ISTIKHARA_SALAWAT_TARGET) {
    const btn = document.getElementById('istikharaSalawatBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="istikhara-btn-icon">✨</span> جارٍ الكشف...';
    }
    setTimeout(showResultStage, 700);
  }
}

/* ===== المرحلة 3 → 4: النتيجة ===== */
function showResultStage() {
  istikharaState.result = generateIstikharaResult();

  const badge = document.getElementById('istikharaBadge');
  const verseText = document.getElementById('istikharaVerseText');
  const verseRef = document.getElementById('istikharaVerseRef');
  const wisdom = document.getElementById('istikharaWisdom');

  if (badge) {
    badge.innerHTML = `<span class="istikhara-category-icon">${istikharaState.result.categoryIcon}</span> ${istikharaState.result.categoryLabel}`;
    badge.style.color = istikharaState.result.categoryColor;
  }
  if (verseText) verseText.textContent = istikharaState.result.verseText;
  if (verseRef) verseRef.textContent = `﴿ ${istikharaState.result.verseRef} ﴾`;
  if (wisdom) wisdom.textContent = istikharaState.result.wisdom;

  // ✅ حفظ آخر استخارة محلياً
  try {
    localStorage.setItem(ISTIKHARA_STATE_KEY, JSON.stringify(istikharaState.result));
  } catch (e) {}

  showStage(4);

  // اهتزاز كشف النتيجة
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

  // ✅ تسجيل في الإحصائيات
  if (typeof trackIstikhara === 'function') trackIstikhara();
}

/* ===== مشاركة النتيجة ===== */
async function shareIstikhara() {
  if (!istikharaState.result) return;
  const r = istikharaState.result;
  const title = 'استخارة — طريق الهدى';
  const text = `${r.verseText}\n\n﴿ ${r.verseRef} ﴾\n\n— ${r.categoryLabel}`;
  const url = `${window.location.origin}${window.location.pathname}#istikhara`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    if (typeof showToast === 'function') showToast('تم نسخ النتيجة');
  } catch (e) {
    if (typeof showToast === 'function') showToast('تعذر النسخ');
  }
}

/* ===== ربط الأحداث ===== */
document.addEventListener('DOMContentLoaded', () => {
  // عدّاد الأحرف
  const textarea = document.getElementById('istikharaQuestion');
  if (textarea) {
    textarea.addEventListener('input', updateCharCount);
    textarea.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter للإرسال السريع
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitQuestion();
      }
    });
  }

  // إنشاء النجوم عند فتح الصفحة
  if (document.getElementById('istikharaView')) {
    createStars();
  }
});

/* ===== تسجيل في الإحصائيات ===== */
function trackIstikhara() {
  try {
    const key = 'user_stats';
    const stats = JSON.parse(localStorage.getItem(key) || '{}');
    stats.istikharaCount = (stats.istikharaCount || 0) + 1;
    stats.lastIstikhara = Date.now();
    localStorage.setItem(key, JSON.stringify(stats));
  } catch (e) {}
}

/* ===== تصدير ===== */
window.showIstikhara = showIstikhara;
window.resetIstikhara = resetIstikhara;
window.goToQuestionStage = goToQuestionStage;
window.submitQuestion = submitQuestion;
window.incrementSalawat = incrementSalawat;
window.shareIstikhara = shareIstikhara;