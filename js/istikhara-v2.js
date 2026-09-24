/* ============================================
   Istikhara v2.0 — نظام الاستخارة المتطور
   ============================================
   ✅ 7 فئات (بدل 5)
   ✅ 200+ آية
   ✅ حكم شرعية + إرشادات عملية
   ✅ سجل الاستخارات (آخر 20)
   ✅ مشاركة محسّنة
   ✅ تأثيرات سلسة
   ============================================ */

const IstikharaV2 = (() => {
  'use strict';

  const ISTIKHARA_STATE_KEY = 'tariq_istikhara_state';
  const HISTORY_KEY = 'tariq_istikhara_history';
  const SALAWAT_TARGET = 3;
  const MAX_HISTORY = 20;

  let data = null;
  let state = {
    stage: 1,
    question: '',
    salawatCount: 0,
    result: null
  };

  /* ============================================
     تحميل البيانات
     ============================================ */
  async function loadData() {
    if (data) return data;

    try {
      // جرب enhanced أولاً
      let res = await fetch('data/istikhara-enhanced.json');
      if (!res.ok) throw new Error('Enhanced not found');
      data = await res.json();
      console.log('✅ Loaded enhanced data (' + Object.keys(data.categories).length + ' categories)');
      return data;
    } catch (e) {
      // Fallback
      try {
        const res = await fetch('data/istikhara.json');
        data = await res.json();
        console.log('✅ Loaded legacy data');
        return data;
      } catch (e2) {
        console.error('[Istikhara] Load failed:', e2);
        return null;
      }
    }
  }

  /* ============================================
     عرض الصفحة
     ============================================ */
  function showIstikhara() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('istikharaView')?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    initIstikhara();
        // ✅ عرض السجل
    if (window.IstikharaHistory) {
      setTimeout(() => window.IstikharaHistory.renderHistory(), 200);
    }

    if (typeof trackEvent === 'function') {
      trackEvent('istikhara_opened');
    }
  }

  /* ============================================
     التهيئة
     ============================================ */
  async function initIstikhara() {
    createStars();
    await loadData();
    resetIstikhara(true);
  }

  /* ============================================
     نجوم الخلفية
     ============================================ */
  function createStars() {
    const container = document.querySelector('.istikhara-stars');
    if (!container || container.childElementCount > 0) return;

    for (let i = 0; i < 25; i++) {
      const star = document.createElement('span');
      star.className = 'istikhara-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
      star.style.animationDuration = `${(2 + Math.random() * 2)}s`;
      container.appendChild(star);
    }
  }

  /* ============================================
     إعادة تعيين
     ============================================ */
  function resetIstikhara(silent = false) {
    state = {
      stage: 1,
      question: '',
      salawatCount: 0,
      result: null
    };

    const textarea = document.getElementById('istikharaQuestion');
    if (textarea) textarea.value = '';

    const counterEl = document.getElementById('istikharaCounterNum');
    if (counterEl) counterEl.textContent = '0';

    updateCharCount();
    updateProgress();
    showStage(1);

    if (!silent && typeof showToast === 'function') {
      showToast('تم إعادة الاستخارة');
    }
  }

  /* ============================================
     شريط التقدم
     ============================================ */
  function updateProgress() {
    document.querySelectorAll('.istikhara-step-dot').forEach((dot, i) => {
      const stepNum = i + 1;
      dot.classList.toggle('active', stepNum === state.stage);
      dot.classList.toggle('done', stepNum < state.stage);
    });
  }

  /* ============================================
     عرض مرحلة
     ============================================ */
  function showStage(num) {
    document.querySelectorAll('.istikhara-stage').forEach(stage => {
      stage.classList.toggle('active', Number(stage.dataset.stage) === num);
    });
    state.stage = num;
    updateProgress();
  }

  /* ============================================
     المرحلة 1 → 2
     ============================================ */
  function goToQuestionStage() {
    showStage(2);
    setTimeout(() => {
      document.getElementById('istikharaQuestion')?.focus();
    }, 300);
  }

  /* ============================================
     عدّاد الأحرف
     ============================================ */
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

  /* ============================================
     المرحلة 2 → 3
     ============================================ */
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

    state.question = question;
    state.salawatCount = 0;

    const counterEl = document.getElementById('istikharaCounterNum');
    if (counterEl) counterEl.textContent = '0';

    const btn = document.getElementById('istikharaSalawatBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="istikhara-btn-icon">🤲</span> صليت — أعد مرة أخرى';
    }

    showStage(3);
  }

  /* ============================================
     المرحلة 3 → 4: الصلاة على النبي
     ============================================ */
  function incrementSalawat() {
    if (state.stage !== 3) return;

    state.salawatCount += 1;

    const counterEl = document.getElementById('istikharaCounterNum');
    if (counterEl) {
      counterEl.textContent = state.salawatCount;
      counterEl.classList.remove('bump');
      void counterEl.offsetWidth;
      counterEl.classList.add('bump');
    }

    if (navigator.vibrate) navigator.vibrate(30);

    if (state.salawatCount >= SALAWAT_TARGET) {
      const btn = document.getElementById('istikharaSalawatBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="istikhara-btn-icon">✨</span> جارٍ الكشف...';
      }
      setTimeout(showResultStage, 700);
    }
  }

  /* ============================================
     المرحلة 4: النتيجة
     ============================================ */
  function showResultStage() {
    state.result = generateResult();

    const badge = document.getElementById('istikharaBadge');
    const verseText = document.getElementById('istikharaVerseText');
    const verseRef = document.getElementById('istikharaVerseRef');
    const wisdom = document.getElementById('istikharaWisdom');

    if (badge) {
      badge.innerHTML = `<span class="istikhara-category-icon">${state.result.categoryIcon}</span> ${state.result.categoryLabel}`;
      badge.style.color = state.result.categoryColor;
      badge.style.borderColor = state.result.categoryColor;
    }
    if (verseText) verseText.textContent = state.result.verseText;
    if (verseRef) verseRef.textContent = `﴿ ${state.result.verseRef} ﴾`;
    if (wisdom) wisdom.textContent = state.result.wisdom;

    // ✅ الإرشادات العملية
    renderGuidance(state.result.guidance);

    // ✅ الحفظ
    saveToHistory(state.result);
    localStorage.setItem(ISTIKHARA_STATE_KEY, JSON.stringify(state.result));

    showStage(4);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

    if (typeof trackEvent === 'function') {
      trackEvent('istikhara_completed', {
        category: state.result.categoryKey
      });
    }
        // ✅ تحديث السجل
    if (window.IstikharaHistory) {
      setTimeout(() => window.IstikharaHistory.renderHistory(), 100);
    }
  }

  /* ============================================
     عرض الإرشادات
     ============================================ */
  function renderGuidance(guidance) {
    let container = document.getElementById('istikharaGuidance');

    if (!container) {
      // إنشاء العنصر إذا لم يكن موجوداً
      const stage4 = document.querySelector('.istikhara-stage[data-stage="4"]');
      if (!stage4) return;

      container = document.createElement('div');
      container.id = 'istikharaGuidance';
      container.className = 'istikhara-guidance';

      const actions = stage4.querySelector('.istikhara-actions');
      if (actions) {
        actions.parentNode.insertBefore(container, actions);
      } else {
        stage4.appendChild(container);
      }
    }

    if (!guidance || !guidance.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="istikhara-guidance-title">📋 إرشادات عملية</div>
      <ul class="istikhara-guidance-list">
        ${guidance.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
  }

  /* ============================================
     توليد النتيجة
     ============================================ */
  function generateResult() {
    const categories = Object.keys(data.categories);
    const categoryKey = categories[secureRandomInt(categories.length)];
    const category = data.categories[categoryKey];
    const verse = category.verses[secureRandomInt(category.verses.length)];

    return {
      categoryKey,
      categoryLabel: category.label,
      categoryColor: category.color,
      categoryIcon: category.icon,
      verseText: verse.text,
      verseRef: verse.ref,
      wisdom: category.wisdom || '',
      guidance: category.guidance || [],
      timestamp: Date.now(),
      question: state.question
    };
  }

  /* ============================================
     عشوائية آمنة
     ============================================ */
  function secureRandomInt(max) {
    if (max <= 0) return 0;
    if (window.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return arr[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  /* ============================================
     السجل
     ============================================ */
  function saveToHistory(result) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      history.unshift(result);
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function clearHistory() {
    if (!confirm('حذف سجل الاستخارات؟')) return;
    localStorage.removeItem(HISTORY_KEY);
    if (typeof showToast === 'function') showToast('تم حذف السجل');
  }

  /* ============================================
     مشاركة محسّنة
     ============================================ */
  async function shareIstikhara() {
    if (!state.result) return;

    const r = state.result;
    const title = 'استخارة — طريق الهدى';

    const text = `🕌 استخارة

${r.verseText}

﴿ ${r.verseRef} ﴾

${r.categoryIcon} ${r.categoryLabel}

💡 ${r.wisdom}

— طريق الهدى`;

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
      if (typeof showToast === 'function') showToast('✅ تم النسخ');
    } catch (e) {
      if (typeof showToast === 'function') showToast('تعذر النسخ');
    }
  }

  /* ============================================
     أدوات
     ============================================ */
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  /* ============================================
     ربط الأحداث
     ============================================ */
  document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('istikharaQuestion');
    if (textarea) {
      textarea.addEventListener('input', updateCharCount);
      textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          submitQuestion();
        }
      });
    }

    if (document.getElementById('istikharaView')) {
      createStars();
    }
  });

  /* ============================================
     التصدير
     ============================================ */
  return {
    show: showIstikhara,
    reset: resetIstikhara,
    goToQuestionStage,
    submitQuestion,
    incrementSalawat,
    shareIstikhara,
    getHistory,
    clearHistory
  };
})();

window.IstikharaV2 = IstikharaV2;

// ✅ دعم الكود القديم
window.showIstikhara = () => IstikharaV2.show();
window.resetIstikhara = (silent) => IstikharaV2.reset(silent);
window.goToQuestionStage = () => IstikharaV2.goToQuestionStage();
window.submitQuestion = () => IstikharaV2.submitQuestion();
window.incrementSalawat = () => IstikharaV2.incrementSalawat();
window.shareIstikhara = () => IstikharaV2.shareIstikhara();

console.log('✅ IstikharaV2 loaded');