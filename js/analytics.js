/* ============================================
   Analytics System — v1.0
   ============================================ */

const ANALYTICS_KEY = 'tariq_analytics_v1';
const ANALYTICS_MAX_EVENTS = 200;
const ANALYTICS_SESSION_KEY = 'tariq_session_id';

let analyticsQueue = [];
let analyticsFlushTimer = null;

function getSessionId() {
  try {
    let sid = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(ANALYTICS_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'sess_unknown';
  }
}

function trackEvent(name, props = {}) {
  if (!name) return;

  const event = {
    name,
    props: sanitizeProps(props),
    sessionId: getSessionId(),
    timestamp: Date.now(),
    url: window.location.pathname,
    referrer: document.referrer || null
  };

  analyticsQueue.push(event);
  if (analyticsQueue.length > 50) analyticsQueue.shift();

  saveAnalytics();
  scheduleFlush();

  if (localStorage.getItem('developerUnlocked') === 'true') {
    console.log('📊 Track:', name, props);
  }
}

function sanitizeProps(props) {
  const clean = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.length > 200) {
      clean[key] = value.slice(0, 200);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    } else if (typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

function saveAnalytics() {
  try {
    const existing = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
    const merged = [...existing, ...analyticsQueue].slice(-ANALYTICS_MAX_EVENTS);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(merged));
    analyticsQueue = [];
  } catch (e) {}
}

function getAnalytics(limit = 100) {
  try {
    const all = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
    return all.slice(-limit);
  } catch {
    return [];
  }
}

function getAnalyticsSummary() {
  const events = getAnalytics(500);
  const byName = {};
  events.forEach(e => {
    byName[e.name] = (byName[e.name] || 0) + 1;
  });
  return {
    total: events.length,
    byName,
    lastEvent: events[events.length - 1] || null,
    sessionId: getSessionId()
  };
}

function clearAnalytics() {
  try {
    localStorage.removeItem(ANALYTICS_KEY);
    analyticsQueue = [];
    return true;
  } catch {
    return false;
  }
}

function scheduleFlush() {
  if (analyticsFlushTimer) return;
  analyticsFlushTimer = setTimeout(async () => {
    analyticsFlushTimer = null;
    const user = window.authApi?.getCurrentUser?.();
    if (!user || !window.firebaseHelpers) return;

    try {
      const batch = getAnalytics(50);
      if (!batch.length) return;

      await window.firebaseHelpers.fbSetDoc('analytics', user.uid, {
        events: batch.slice(-50),
        lastSync: new Date().toISOString(),
        sessionId: getSessionId()
      });
    } catch (e) {}
  }, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
  trackEvent('page_view', {
    title: document.title,
    path: window.location.pathname
  });
});

window.addEventListener('beforeunload', () => {
  trackEvent('session_end', {});
  saveAnalytics();
});

window.trackEvent = trackEvent;
window.getAnalytics = getAnalytics;
window.getAnalyticsSummary = getAnalyticsSummary;
window.clearAnalytics = clearAnalytics;

window.analyticsApi = {
  track: trackEvent,
  getAll: getAnalytics,
  summary: getAnalyticsSummary,
  clear: clearAnalytics
};