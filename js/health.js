/* ===== فحص ذاتي + معالج أخطاء متطور — v2.0 ===== */
(function initAppHealth() {
  'use strict';

  /* ===== التحقق من الثيمات ===== */
  const validThemes = ['green', 'dark', 'light', 'ocean', 'rose', 'midnight'];
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme && !validThemes.includes(savedTheme)) {
    localStorage.removeItem('theme');
  }

  /* ===== Cache ذكي لتقليل الضغط ===== */
  const memory = new Map();
  const pending = new Map();

  window.appMemory = {
    async json(url, loader = () => fetch(url).then(response => response.json())) {
      if (memory.has(url)) return memory.get(url);
      if (pending.has(url)) return pending.get(url);
      const request = loader().then(value => {
        if (memory.size >= 40) memory.delete(memory.keys().next().value);
        memory.set(url, value);
        pending.delete(url);
        return value;
      }).catch(error => {
        pending.delete(url);
        throw error;
      });
      pending.set(url, request);
      return request;
    },
    clear() { memory.clear(); pending.clear(); }
  };

  /* ===== إصلاح الإعدادات التالفة ===== */
  const jsonKeys = ['prayer_settings', 'reading_settings', 'user_stats', 'tariq_dev_settings', 'tariq_features_v1'];
  jsonKeys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value && value !== 'null' && value !== 'undefined') {
        JSON.parse(value);
      } else if (value) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      localStorage.removeItem(key);
      console.warn(`[Health] تم إصلاح ${key} التالف`);
    }
  });

  /* ============================================
     معالج الأخطاء الشامل — Error Handler v2.0
     ============================================ */
  const ERROR_LOG_KEY = 'tariq_error_log_v1';
  const MAX_LOGS = 30;

  window.ErrorHandler = {
    logs: [],
    isDevelopment: localStorage.getItem('developerUnlocked') === 'true',

    /* تسجيل خطأ */
    log(error, context = {}) {
      const log = {
        message: error?.message || String(error),
        stack: error?.stack?.split('\n').slice(0, 3).join('\n') || '',
        context,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent.slice(0, 100)
      };

      this.logs.unshift(log);
      if (this.logs.length > MAX_LOGS) this.logs.pop();

      try {
        localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(this.logs.slice(0, 10)));
      } catch (e) {}

      if (this.isDevelopment) {
        console.group('🔴 Error Handler');
        console.error('Message:', log.message);
        console.error('Context:', context);
        console.error('Stack:', log.stack);
        console.groupEnd();
      }

      return log;
    },

    /* الحصول على السجل */
    getLogs() {
      try {
        return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
      } catch {
        return [];
      }
    },

    /* مسح السجل */
    clear() {
      this.logs = [];
      localStorage.removeItem(ERROR_LOG_KEY);
    },

    /* معالج آمن لأي دالة */
    safe(fn, fallback = null) {
      return function (...args) {
        try {
          const result = fn.apply(this, args);
          if (result && typeof result.catch === 'function') {
            return result.catch(error => {
              window.ErrorHandler.log(error, { function: fn.name, args });
              return fallback;
            });
          }
          return result;
        } catch (error) {
          window.ErrorHandler.log(error, { function: fn.name, args });
          return fallback;
        }
      };
    },

    /* محاولة إعادة */
    async retry(fn, maxAttempts = 3, delay = 500) {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === maxAttempts - 1) throw error;
          await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
      }
    }
  };

  /* ===== التقاط الأخطاء العامة ===== */
  window.addEventListener('error', event => {
    window.ErrorHandler.log(event.error || new Error(event.message), {
      type: 'runtime',
      source: event.filename,
      line: event.lineno,
      col: event.colno
    });
    document.body?.classList.add('app-has-warning');
  });

  window.addEventListener('unhandledrejection', event => {
    window.ErrorHandler.log(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { type: 'promise-rejection' }
    );
  });

  /* ===== حماية الدوال الحساسة ===== */
  const safeFunctions = [
    'showHome', 'showQuran', 'showListen', 'showPrayer',
    'showQibla', 'showNames', 'showZiyarat', 'showIstikhara', 'showStats',
    'openDeveloperPanel', 'saveDeveloperEvent', 'saveDeveloperAd',
    'renderHomeEvents', 'renderHomeAds', 'renderDeveloperEvents', 'renderDeveloperAds',
    'createUserAccount', 'loginUser', 'renderAuthWidget',
    'startQibla', 'toggleARCamera', 'showIstikhara', 'resetIstikhara'
  ];

  setTimeout(() => {
    safeFunctions.forEach(name => {
      if (typeof window[name] === 'function' && !window[name].__safe) {
        const original = window[name];
        const wrapped = window.ErrorHandler.safe(original);
        wrapped.__safe = true;
        wrapped.__original = original;
        window[name] = wrapped;
      }
    });
  }, 1500);

  /* ===== أداء محسّن: passive listeners ===== */
  if ('addEventListener' in window) {
    const passiveEvents = ['scroll', 'touchstart', 'touchmove', 'wheel'];
    passiveEvents.forEach(event => {
      window.addEventListener(event, () => {}, { passive: true });
    });
  }

  /* ===== تخفيف الضغط: Idle Callback ===== */
  window.idleTask = (task, timeout = 2000) => {
    if ('requestIdleCallback' in window) {
      return requestIdleCallback(task, { timeout });
    }
    return setTimeout(task, 1);
  };

  /* ===== Throttle + Debounce ===== */
  window.throttle = (fn, wait = 100) => {
    let lastTime = 0;
    let timeout;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - lastTime);
      if (remaining <= 0) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        lastTime = now;
        fn.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastTime = Date.now();
          timeout = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  };

  window.debounce = (fn, wait = 300) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  /* ===== Lazy Loading محسّن للصور ===== */
  window.lazyLoadImages = () => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });

      document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
    }
  };

  /* ===== تنظيف الذاكرة الدوري ===== */
  setInterval(() => {
    if (window.appMemory && memory.size > 30) {
      const keys = [...memory.keys()];
      keys.slice(0, 10).forEach(key => memory.delete(key));
    }
  }, 60000);

  console.log('✅ Health System v2.0 loaded');
})();