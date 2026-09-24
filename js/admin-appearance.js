/* ============================================
   Admin Appearance — v1.1
   تحكم كامل بمظهر الموقع
   ============================================
   ✅ تغيير الألوان الحية
   ✅ ثيمات جاهزة (6 ثيمات)
   ✅ حفظ دائم في Firestore
   ✅ تطبيق فوري
   ✅ استعادة الافتراضي
   ✅ تصدير الإعدادات
   ============================================ */

const AdminAppearance = (() => {
  'use strict';

  const APPEARANCE_KEY = 'tariq_appearance_settings';
  const FIRESTORE_COLLECTION = 'settings';
  const FIRESTORE_DOC = 'appearance';

  /* ============================================
     الإعدادات الافتراضية
     ============================================ */
  const DEFAULT_APPEARANCE = {
    primary: '#0d3b2e',
    secondary: '#1a6b52',
    accent: '#d4af37',
    accentSoft: '#e6c869',
    text: '#f5f1e8',
    bgStart: '#0d3b2e',
    bgEnd: '#1a6b52',
    preset: 'default'
  };

  /* ============================================
     الثيمات الجاهزة
     ============================================ */
  const PRESETS = {
    default: {
      name: 'الأخضر الافتراضي',
      colors: {
        primary: '#0d3b2e',
        secondary: '#1a6b52',
        accent: '#d4af37',
        accentSoft: '#e6c869',
        text: '#f5f1e8',
        bgStart: '#0d3b2e',
        bgEnd: '#1a6b52'
      },
      colors2: ['#0d3b2e', '#1a6b52']
    },
    midnight: {
      name: 'منتصف الليل',
      colors: {
        primary: '#111629',
        secondary: '#202b4a',
        accent: '#9ec5ff',
        accentSoft: '#c8dcff',
        text: '#f1f5ff',
        bgStart: '#111629',
        bgEnd: '#202b4a'
      },
      colors2: ['#111629', '#202b4a']
    },
    ocean: {
      name: 'المحيط',
      colors: {
        primary: '#071f2b',
        secondary: '#0c4354',
        accent: '#62d6d3',
        accentSoft: '#a1ece2',
        text: '#eefcfb',
        bgStart: '#071f2b',
        bgEnd: '#0c4354'
      },
      colors2: ['#071f2b', '#0c4354']
    },
    rose: {
      name: 'الوردي',
      colors: {
        primary: '#321c2b',
        secondary: '#63324d',
        accent: '#f2b880',
        accentSoft: '#ffd7ac',
        text: '#fff5ed',
        bgStart: '#321c2b',
        bgEnd: '#63324d'
      },
      colors2: ['#321c2b', '#63324d']
    },
    royal: {
      name: 'الملكي',
      colors: {
        primary: '#2b1d3d',
        secondary: '#4c2e6b',
        accent: '#c8a8ff',
        accentSoft: '#dbc8ff',
        text: '#f5edff',
        bgStart: '#2b1d3d',
        bgEnd: '#4c2e6b'
      },
      colors2: ['#2b1d3d', '#4c2e6b']
    },
    emerald: {
      name: 'الزمرد',
      colors: {
        primary: '#0a2818',
        secondary: '#1a5233',
        accent: '#7fe8a8',
        accentSoft: '#b8f5cf',
        text: '#e8fff0',
        bgStart: '#0a2818',
        bgEnd: '#1a5233'
      },
      colors2: ['#0a2818', '#1a5233']
    }
  };

  let state = {
    settings: { ...DEFAULT_APPEARANCE },
    saveTimeout: null
  };

  /* ============================================
     تحميل الإعدادات من localStorage
     ============================================ */
  function load() {
    try {
      const raw = localStorage.getItem(APPEARANCE_KEY);
      if (raw) {
        state.settings = { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[Appearance] Load failed:', e);
      state.settings = { ...DEFAULT_APPEARANCE };
    }

    return state.settings;
  }

  /* ============================================
     حفظ الإعدادات محلياً + سحابياً
     ============================================ */
  async function save(settings = null) {
    if (settings) state.settings = { ...state.settings, ...settings };

    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.settings));

      // مزامنة سحابية
      if (window.firebaseHelpers) {
        await window.firebaseHelpers.fbSetDoc(FIRESTORE_COLLECTION, FIRESTORE_DOC, {
          ...state.settings,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }

      apply();
      return true;
    } catch (e) {
      console.warn('[Appearance] Save failed:', e);
      return false;
    }
  }

  /* ============================================
     مزامنة من السحابة
     ============================================ */
  async function syncFromCloud() {
    if (!window.firebaseHelpers) return;

    try {
      const cloud = await window.firebaseHelpers.fbGetDoc(FIRESTORE_COLLECTION, FIRESTORE_DOC);
      if (cloud) {
        const { updatedAt, ...settings } = cloud;
        state.settings = { ...DEFAULT_APPEARANCE, ...settings };
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.settings));
        apply();
        console.log('☁️ Appearance synced from cloud');
      }
    } catch (e) {
      console.warn('[Appearance] Sync failed:', e);
    }
  }

  /* ============================================
     تطبيق الإعدادات على الموقع
     ============================================ */
  function apply() {
    const s = state.settings;
    const root = document.documentElement;

    // تطبيق الألوان كـ CSS variables
    root.style.setProperty('--tariq-primary', s.primary);
    root.style.setProperty('--tariq-secondary', s.secondary);
    root.style.setProperty('--tariq-accent', s.accent);
    root.style.setProperty('--tariq-accent-soft', s.accentSoft);
    root.style.setProperty('--tariq-text', s.text);

    // تطبيق على متغيرات الموقع العامة
    if (s.primary) root.style.setProperty('--green-deep', s.primary);
    if (s.secondary) root.style.setProperty('--green-main', s.secondary);
    if (s.accent) root.style.setProperty('--gold', s.accent);
    if (s.accentSoft) root.style.setProperty('--gold-soft', s.accentSoft);
    if (s.text) root.style.setProperty('--cream', s.text);

    if (s.bgStart) root.style.setProperty('--bg-gradient-start', s.bgStart);
    if (s.bgEnd) root.style.setProperty('--bg-gradient-end', s.bgEnd);

    // حفظ كمرجع عام
    window.__tariqAppearance = { ...s };
  }

  /* ============================================
     تغيير لون معين
     ============================================ */
  function setColor(key, value) {
    state.settings[key] = value;
    apply();

    // تحديث القيمة المعروضة
    const valueEl = document.querySelector(`[data-color-value="${key}"]`);
    if (valueEl) valueEl.textContent = value;

    // حفظ بعد فترة قصيرة (debounced)
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
      save();
    }, 500);
  }

  /* ============================================
     تطبيق Preset
     ============================================ */
  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) {
      console.warn('[Appearance] Preset not found:', presetKey);
      return;
    }

    state.settings = {
      ...state.settings,
      ...preset.colors,
      preset: presetKey
    };

    save();
    render();

    if (typeof showToast === 'function') {
      showToast(`🎨 تم تطبيق: ${preset.name}`);
    }
  }

  /* ============================================
     استعادة الافتراضي
     ============================================ */
  function reset() {
    if (!confirm('استعادة المظهر الافتراضي؟')) return;

    state.settings = { ...DEFAULT_APPEARANCE };
    save();
    render();

    if (typeof showToast === 'function') showToast('↺ تم استعادة الافتراضي');
  }

  /* ============================================
     تصدير الإعدادات
     ============================================ */
  function exportAppearance() {
    try {
      const data = JSON.stringify(state.settings, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `appearance-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      if (typeof showToast === 'function') showToast('✅ تم التصدير');
    } catch (e) {
      if (typeof showToast === 'function') showToast('تعذر التصدير');
    }
  }

  /* ============================================
     ✅ العرض — النسخة المصححة
     ============================================ */
  function render() {
    const container = document.getElementById('adminAppearanceContent');
    if (!container) {
      console.warn('[Appearance] Container not found');
      return;
    }

    console.log('[Appearance] Rendering UI...');

    const s = state.settings;

    const colorFields = [
      { key: 'primary', label: '🟢 اللون الأساسي (Primary)' },
      { key: 'secondary', label: '🟢 اللون الثانوي (Secondary)' },
      { key: 'accent', label: '🟡 اللون الذهبي (Accent)' },
      { key: 'accentSoft', label: '🟡 الذهبي الفاتح' },
      { key: 'text', label: '⚪ لون النص' },
      { key: 'bgStart', label: '🌌 خلفية البداية' },
      { key: 'bgEnd', label: '🌌 خلفية النهاية' }
    ];

    container.innerHTML = `
      <!-- Presets -->
      <div class="admin-appearance-card" style="margin-bottom: 20px;">
        <div class="admin-appearance-title">🎨 ثيمات جاهزة</div>
        <div class="admin-preset-grid">
          ${Object.entries(PRESETS).map(([key, preset]) => `
            <div
              class="admin-preset-btn ${s.preset === key ? 'active' : ''}"
              onclick="AdminAppearance.applyPreset('${key}')"
              title="${preset.name}"
              style="background: linear-gradient(135deg, ${preset.colors2[0]}, ${preset.colors2[1]});"></div>
          `).join('')}
        </div>
        <p style="font-size: 0.75rem; color: rgba(245, 241, 232, 0.5); margin: 8px 0 0; text-align: center;">
          اضغط على ثيم لتطبيقه فوراً على الموقع
        </p>
      </div>

      <!-- Colors -->
      <div class="admin-appearance-card">
        <div class="admin-appearance-title">🌈 الألوان المخصصة</div>
        ${colorFields.map(field => `
          <div class="admin-color-row">
            <span class="admin-color-label">${field.label}</span>
            <div class="admin-color-input-wrapper">
              <input
                type="color"
                class="admin-color-input"
                value="${s[field.key] || '#000000'}"
                data-color-key="${field.key}"
                oninput="AdminAppearance.setColor('${field.key}', this.value)"
              />
              <span class="admin-color-value" data-color-value="${field.key}">${s[field.key] || '#000000'}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Actions -->
      <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
        <button class="admin-action-btn" onclick="AdminAppearance.exportAppearance()" style="flex: 1; min-width: 140px;">
          📥 تصدير الإعدادات
        </button>
        <button class="admin-action-btn danger" onclick="AdminAppearance.reset()" style="flex: 1; min-width: 140px;">
          ↺ استعادة الافتراضي
        </button>
      </div>

      <!-- Preview -->
      <div class="admin-appearance-card" style="margin-top: 20px;">
        <div class="admin-appearance-title">👁️ معاينة مباشرة</div>
        <div style="padding: 24px; background: linear-gradient(135deg, ${s.bgStart}, ${s.bgEnd}); border-radius: 14px; text-align: center; border: 1px solid ${s.accent}40;">
          <div style="color: ${s.accent}; font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; text-shadow: 0 0 20px ${s.accent}50;">
            طريق الهدى
          </div>
          <div style="color: ${s.text}; font-size: 0.85rem; opacity: 0.9; margin-bottom: 16px;">
            طريقك إلى النور
          </div>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <span style="padding: 8px 16px; background: ${s.accent}; color: ${s.primary}; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">
              زر أساسي
            </span>
            <span style="padding: 8px 16px; background: ${s.secondary}; color: ${s.text}; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">
              زر ثانوي
            </span>
            <span style="padding: 8px 16px; background: transparent; color: ${s.accent}; border: 1.5px solid ${s.accent}; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">
              زر مفرغ
            </span>
          </div>
        </div>
      </div>

      <!-- Info -->
      <div style="margin-top: 16px; padding: 14px; background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 12px; font-size: 0.78rem; color: rgba(245, 241, 232, 0.7); line-height: 1.6;">
        💡 <strong>ملاحظة:</strong> التغييرات تُحفظ تلقائياً وتُطبَّق على الموقع فوراً لجميع الزوار.
      </div>
    `;

    console.log('✅ Appearance UI rendered');
  }

  /* ============================================
     ✅ عند فتح التبويب — النسخة المصححة
     ============================================ */
  async function onTabOpen() {
    try {
      // 1. تحميل الإعدادات من localStorage
      load();

      // 2. عرض الواجهة فوراً
      render();

      // 3. مزامنة سحابية في الخلفية (بدون انتظار)
      syncFromCloud().then(() => {
        // إعادة العرض بعد المزامنة
        render();
      }).catch((err) => {
        console.warn('[Appearance] Background sync failed:', err);
      });
    } catch (err) {
      console.error('[Appearance] onTabOpen failed:', err);
      // محاولة عرض حتى مع الأخطاء
      try { render(); } catch (e) {}
    }
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    load,
    save,
    apply,
    setColor,
    applyPreset,
    reset,
    exportAppearance,
    syncFromCloud,
    onTabOpen,
    render
  };
})();

window.AdminAppearance = AdminAppearance;
console.log('✅ AdminAppearance v1.1 loaded');

/* ============================================
   تطبيق المظهر تلقائياً عند تحميل الصفحة
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      AdminAppearance.load();
      AdminAppearance.apply();
      console.log('✅ Appearance applied to page');
    } catch (e) {
      console.warn('[Appearance] Auto-apply failed:', e);
    }
  }, 500);
});

/* ============================================
   تطبيق فوري (بدون انتظار DOMContentLoaded)
   ============================================ */
try {
  AdminAppearance.load();
  AdminAppearance.apply();
} catch (e) {
  console.warn('[Appearance] Initial apply failed:', e);
}