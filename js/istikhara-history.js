/* ============================================
   Istikhara History — v1.0
   سجل الاستخارات + الإحصائيات + المشاركة
   ============================================
   ✅ عرض سجل الاستخارات (آخر 20)
   ✅ إعادة قراءة أي استخارة
   ✅ حذف استخارة منفردة
   ✅ إحصائيات الاستخارات
   ✅ مشاركة كصورة (Canvas)
   ============================================ */

const IstikharaHistory = (() => {
  'use strict';

  const HISTORY_KEY = 'tariq_istikhara_history';

  /* ============================================
     قراءة السجل
     ============================================ */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (e) {}
  }

  /* ============================================
     حذف استخارة
     ============================================ */
  function deleteEntry(timestamp) {
    if (!confirm('حذف هذه الاستخارة من السجل؟')) return;

    const history = getHistory().filter(h => h.timestamp !== timestamp);
    saveHistory(history);

    if (typeof showToast === 'function') showToast('✅ تم الحذف');
    renderHistory();
  }

  /* ============================================
     مسح السجل
     ============================================ */
  function clearAll() {
    if (!confirm('حذف كل سجل الاستخارات؟')) return;
    if (!confirm('تأكيد نهائي؟')) return;

    localStorage.removeItem(HISTORY_KEY);

    if (typeof showToast === 'function') showToast('✅ تم مسح السجل');
    renderHistory();
  }

  /* ============================================
     إعادة قراءة استخارة
     ============================================ */
  function reloadEntry(timestamp) {
    const entry = getHistory().find(h => h.timestamp === timestamp);
    if (!entry) return;

    // تحويل لمرحلة النتيجة مباشرة
    if (window.IstikharaV2) {
      // استخدام الطريقة الداخلية
      const stage4 = document.querySelector('.istikhara-stage[data-stage="4"]');
      if (!stage4) return;

      // تعيين النتيجة في الحالة الداخلية
      window.__lastIstikharaResult = entry;

      // عرض النتيجة
      renderResult(entry);

      // الانتقال
      document.querySelectorAll('.istikhara-stage').forEach(s => {
        s.classList.toggle('active', s.dataset.stage === '4');
      });

      document.querySelectorAll('.istikhara-step-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === 3);
        dot.classList.toggle('done', i < 3);
      });

      if (typeof showToast === 'function') showToast('📖 عرض الاستخارة السابقة');
    }
  }

  function renderResult(result) {
    const badge = document.getElementById('istikharaBadge');
    const verseText = document.getElementById('istikharaVerseText');
    const verseRef = document.getElementById('istikharaVerseRef');
    const wisdom = document.getElementById('istikharaWisdom');

    if (badge) {
      badge.innerHTML = `<span class="istikhara-category-icon">${result.categoryIcon}</span> ${result.categoryLabel}`;
      badge.style.color = result.categoryColor;
      badge.style.borderColor = result.categoryColor;
    }
    if (verseText) verseText.textContent = result.verseText;
    if (verseRef) verseRef.textContent = `﴿ ${result.verseRef} ﴾`;
    if (wisdom) wisdom.textContent = result.wisdom;

    // الإرشادات
    renderGuidance(result.guidance);
  }

  function renderGuidance(guidance) {
    let container = document.getElementById('istikharaGuidance');

    if (!container) {
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
     عرض السجل
     ============================================ */
  function renderHistory() {
    const container = document.getElementById('istikharaHistoryContainer');
    if (!container) return;

    const history = getHistory();

    if (!history.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const stats = getStats(history);

    container.innerHTML = `
      <div class="istikhara-history-header">
        <h3>📜 استخاراتي السابقة</h3>
        <span class="istikhara-history-count">${history.length} / 20</span>
      </div>

      <div class="istikhara-history-stats">
        <div class="istikhara-stat-item">
          <div class="istikhara-stat-value">${stats.total}</div>
          <div class="istikhara-stat-label">الإجمالي</div>
        </div>
        <div class="istikhara-stat-item">
          <div class="istikhara-stat-value" style="color:${stats.topCategoryColor};">${stats.topCategoryIcon}</div>
          <div class="istikhara-stat-label">${stats.topCategoryLabel}</div>
        </div>
        <div class="istikhara-stat-item">
          <div class="istikhara-stat-value">${stats.lastDate}</div>
          <div class="istikhara-stat-label">الأخيرة</div>
        </div>
      </div>

      <div class="istikhara-history-list">
        ${history.map((entry, i) => renderHistoryItem(entry, i)).join('')}
      </div>

      <div class="istikhara-history-actions">
        <button class="istikhara-btn istikhara-btn-secondary" onclick="IstikharaHistory.clearAll()">
          <span>🗑️</span>
          <span>مسح السجل</span>
        </button>
      </div>
    `;

    // ربط الأحداث
    container.querySelectorAll('[data-reload]').forEach(btn => {
      btn.addEventListener('click', () => {
        reloadEntry(Number(btn.dataset.reload));
      });
    });

    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteEntry(Number(btn.dataset.delete));
      });
    });

    container.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = history.find(h => h.timestamp === Number(btn.dataset.share));
        if (entry) shareAsImage(entry);
      });
    });
  }

  function renderHistoryItem(entry, index) {
    const time = formatTimeAgo(entry.timestamp);
    const question = entry.question || 'استخارة';

    return `
      <div class="istikhara-history-item" style="animation-delay: ${index * 0.05}s">
        <div class="istikhara-history-badge" style="color: ${entry.categoryColor}; border-color: ${entry.categoryColor};">
          ${entry.categoryIcon} ${entry.categoryLabel}
        </div>

        <div class="istikhara-history-question">
          ${escapeHtml(question.slice(0, 100))}${question.length > 100 ? '...' : ''}
        </div>

        <div class="istikhara-history-verse">
          ${escapeHtml(entry.verseText.slice(0, 80))}...
        </div>

        <div class="istikhara-history-ref">
          ﴿ ${escapeHtml(entry.verseRef)} ﴾
        </div>

        <div class="istikhara-history-meta">
          <span class="istikhara-history-time">${time}</span>

          <div class="istikhara-history-buttons">
            <button class="istikhara-mini-btn" data-share="${entry.timestamp}" title="شارك كصورة">📸</button>
            <button class="istikhara-mini-btn" data-reload="${entry.timestamp}" title="إعادة قراءة">📖</button>
            <button class="istikhara-mini-btn danger" data-delete="${entry.timestamp}" title="حذف">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================
     الإحصائيات
     ============================================ */
  function getStats(history = null) {
    const h = history || getHistory();
    if (!h.length) {
      return {
        total: 0,
        topCategoryLabel: '—',
        topCategoryIcon: '?',
        topCategoryColor: '#d4af37',
        lastDate: '—'
      };
    }

    // أكثر فئة
    const counts = {};
    h.forEach(e => {
      counts[e.categoryKey] = (counts[e.categoryKey] || 0) + 1;
    });

    const topKey = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const topEntry = h.find(e => e.categoryKey === topKey) || {};

    // آخر تاريخ
    const lastEntry = h[0];
    const lastDate = formatDateShort(lastEntry.timestamp);

    return {
      total: h.length,
      topCategoryLabel: topEntry.categoryLabel || '—',
      topCategoryIcon: topEntry.categoryIcon || '?',
      topCategoryColor: topEntry.categoryColor || '#d4af37',
      lastDate
    };
  }

  /* ============================================
     تنسيقات
     ============================================ */
  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `قبل ${Math.floor(diff / 60000)} دقيقة`;
    if (diff < 86400000) return `قبل ${Math.floor(diff / 3600000)} ساعة`;

    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return `أمس ${date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}`;
    }

    if (diff < 604800000) {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return days[date.getDay()];
    }

    return date.toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit' });
  }

  function formatDateShort(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 86400000) return 'اليوم';
    if (diff < 172800000) return 'أمس';

    const date = new Date(timestamp);
    return date.toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit' });
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  /* ============================================
     ✅ مشاركة كصورة (Canvas)
     ============================================ */
  async function shareAsImage(entry) {
    if (!entry) return;

    if (typeof showToast === 'function') showToast('📸 جارٍ إنشاء الصورة...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1620;
      const ctx = canvas.getContext('2d');

      // خلفية متدرجة
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0d3b2e');
      gradient.addColorStop(0.5, '#1a6b52');
      gradient.addColorStop(1, '#0d3b2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // إطار ذهبي
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

      // إطار داخلي رفيع
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

      // النجمة العلوية
      ctx.font = '60px serif';
      ctx.fillStyle = '#d4af37';
      ctx.textAlign = 'center';
      ctx.fillText('✦', canvas.width / 2, 180);

      // العنوان
      ctx.font = 'bold 55px Cairo, Arial';
      ctx.fillStyle = '#d4af37';
      ctx.fillText('استخارة', canvas.width / 2, 260);

      // خط تحت العنوان
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 80, 290);
      ctx.lineTo(canvas.width / 2 + 80, 290);
      ctx.stroke();

      // الفئة
      ctx.font = 'bold 40px Cairo, Arial';
      ctx.fillStyle = entry.categoryColor || '#d4af37';
      ctx.fillText(`${entry.categoryIcon || ''} ${entry.categoryLabel || ''}`, canvas.width / 2, 380);

      // السؤال (اختياري)
      if (entry.question) {
        ctx.font = '32px Cairo, Arial';
        ctx.fillStyle = 'rgba(245, 241, 232, 0.6)';
        const q = entry.question.length > 40 ? entry.question.slice(0, 40) + '...' : entry.question;
        ctx.fillText(`«${q}»`, canvas.width / 2, 450);
      }

      // الآية — مع كسر الأسطر
      ctx.font = 'bold 50px "Amiri Quran", Cairo, serif';
      ctx.fillStyle = '#f5f1e8';

      const verseLines = wrapText(ctx, entry.verseText, canvas.width - 200);
      const verseStartY = 620;
      verseLines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, verseStartY + i * 80);
      });

      // المرجع
      const refY = verseStartY + verseLines.length * 80 + 40;
      ctx.font = 'bold 38px Cairo, Arial';
      ctx.fillStyle = '#d4af37';
      ctx.fillText(`﴿ ${entry.verseRef} ﴾`, canvas.width / 2, refY);

      // الحكمة
      if (entry.wisdom) {
        ctx.font = 'italic 32px Cairo, Arial';
        ctx.fillStyle = 'rgba(245, 241, 232, 0.85)';
        const wisdomLines = wrapText(ctx, entry.wisdom, canvas.width - 200);
        const wisdomY = refY + 100;
        wisdomLines.slice(0, 3).forEach((line, i) => {
          ctx.fillText(line, canvas.width / 2, wisdomY + i * 55);
        });
      }

      // التوقيع السفلي
      ctx.font = 'bold 36px Cairo, Arial';
      ctx.fillStyle = '#d4af37';
      ctx.fillText('طريق الهدى', canvas.width / 2, canvas.height - 180);

      ctx.font = '28px Cairo, Arial';
      ctx.fillStyle = 'rgba(245, 241, 232, 0.6)';
      ctx.fillText('tariq-alhuda.com', canvas.width / 2, canvas.height - 130);

      // نجمة سفلية
      ctx.font = '50px serif';
      ctx.fillStyle = '#d4af37';
      ctx.fillText('✦', canvas.width / 2, canvas.height - 70);

      // تحويل لصورة
      canvas.toBlob(async (blob) => {
        if (!blob) {
          if (typeof showToast === 'function') showToast('تعذر إنشاء الصورة');
          return;
        }

        const file = new File([blob], `istikhara-${entry.timestamp}.png`, { type: 'image/png' });

        // مشاركة
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'استخارة — طريق الهدى',
              text: `${entry.verseText}\n\n﴿ ${entry.verseRef} ﴾`
            });
            return;
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }

        // تحميل مباشر
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `istikhara-${entry.timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (typeof showToast === 'function') showToast('✅ تم حفظ الصورة');
      }, 'image/png', 0.95);

    } catch (err) {
      console.error('[Istikhara] Share image failed:', err);
      if (typeof showToast === 'function') showToast('تعذر إنشاء الصورة');
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) lines.push(current);
    return lines;
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    getHistory,
    renderHistory,
    reloadEntry,
    deleteEntry,
    clearAll,
    getStats,
    shareAsImage
  };
})();

window.IstikharaHistory = IstikharaHistory;
console.log('✅ IstikharaHistory loaded');