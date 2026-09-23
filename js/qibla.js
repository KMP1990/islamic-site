/* ===== بوصلة القبلة + كاميرا AR — v7 ===== */

const KAABA_COORDS = { latitude: 21.4225, longitude: 39.8262 };
const QIBLA_STORAGE_KEY = 'tariq_qibla_v7';

/* ===== الحالة ===== */
let qiblaBearing = 0;
let deviceHeading = null;
let smoothedHeading = null;
let currentLocation = null;
let isListening = false;
let cameraStream = null;
let arActive = false;
let lastVibrate = 0;
let lastLockState = false;
let compassAccuracy = 'unknown';
let orientationHandler = null;

/* ===== أدوات رياضية ===== */
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

/* ===== حساب اتجاه القبلة ===== */
function calculateBearing(lat1, lon1) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(KAABA_COORDS.latitude);
  const Δλ = toRad(KAABA_COORDS.longitude - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* ===== حساب المسافة (Haversine) ===== */
function calculateDistance(lat1, lon1) {
  const R = 6371;
  const dLat = toRad(KAABA_COORDS.latitude - lat1);
  const dLon = toRad(KAABA_COORDS.longitude - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(KAABA_COORDS.latitude)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===== أدوات UI ===== */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateStatus(text, type = 'info') {
  const el = document.getElementById('qiblaStatus');
  if (!el) return;
  const colors = {
    info: 'var(--gold-soft)',
    loading: 'var(--gold)',
    success: '#7fe8a8',
    error: '#ff8a7a'
  };
  el.textContent = text;
  el.style.color = colors[type] || colors.info;
  el.classList.toggle('aligned', type === 'success');
}

/* ===== بناء علامات التدريج (36 علامة كل 10° + كاردينالية) ===== */
function buildCompassTicks() {
  const g = document.getElementById('qiblaTicks');
  if (!g || g.childElementCount > 0) return;

  const NS = 'http://www.w3.org/2000/svg';
  const outerR = 168;
  const center = 180;

  for (let i = 0; i < 36; i++) {
    const angle = i * 10;
    const isCardinal = angle % 90 === 0;
    const isMid = angle % 30 === 0;
    const length = isCardinal ? 18 : (isMid ? 10 : 5);

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(center));
    line.setAttribute('y1', String(center - outerR));
    line.setAttribute('x2', String(center));
    line.setAttribute('y2', String(center - outerR + length));
    line.setAttribute('transform', `rotate(${angle} ${center} ${center})`);
    line.setAttribute('stroke',
      isCardinal ? 'rgba(212,175,55,0.85)' :
      isMid      ? 'rgba(212,175,55,0.5)'  :
                   'rgba(212,175,55,0.25)');
    line.setAttribute('stroke-width', isCardinal ? '2.4' : (isMid ? '1.6' : '1'));
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
  }
}

/* ===== الحفظ والاسترجاع ===== */
function saveState() {
  if (!currentLocation) return;
  try {
    localStorage.setItem(QIBLA_STORAGE_KEY, JSON.stringify({
      location: currentLocation,
      bearing: qiblaBearing,
      updated: Date.now()
    }));
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(QIBLA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/* ===== تحديث البيانات ===== */
function updateQiblaData() {
  if (!currentLocation) return;

  qiblaBearing = calculateBearing(currentLocation.latitude, currentLocation.longitude);
  const distance = calculateDistance(currentLocation.latitude, currentLocation.longitude);

  setText('qiblaDegree', `${Math.round(qiblaBearing)}°`);
  setText('qiblaDistance', `${distance.toFixed(0)} كم`);

  saveState();
  updateNeedle();
}

/* ===== عرض الصفحة ===== */
function showQibla() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('qiblaView')?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  initQibla();
}

/* ===== التهيئة ===== */
function initQibla() {
  buildCompassTicks();

  const saved = loadState();
  if (saved && saved.location) {
    currentLocation = saved.location;
    updateQiblaData();
  } else {
    updateStatus('اضغط "تفعيل البوصلة" للبدء', 'info');
  }

  updateAccuracyIndicator();
}

/* ===== تفعيل البوصلة ===== */
async function startQibla() {
  const btn = document.getElementById('qiblaStartBtn');
  const label = document.getElementById('qiblaStartLabel');
  const icon = btn?.querySelector('.qibla-btn-icon');

  const setBtnState = (iconText, labelText, isActive = false) => {
    if (icon) icon.textContent = iconText;
    if (label) label.textContent = labelText;
    if (btn) btn.classList.toggle('active', isActive);
  };

  setBtnState('⏳', 'جارٍ التفعيل...');

  try {
    if (!currentLocation) {
      await getLocation();
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') throw new Error('permission-denied');
    }

    setupOrientation();

    isListening = true;
    setBtnState('✅', 'البوصلة مفعّلة', true);
    updateStatus('وجّه الهاتف حتى يتحول السهم للأخضر', 'success');

  } catch (err) {
    console.error('[Qibla]', err);
    setBtnState('🔄', 'إعادة المحاولة');
    updateStatus('تعذر التفعيل — تأكد من الأذونات', 'error');
  }
}

/* ===== الموقع ===== */
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no-gps'));

    updateStatus('جارٍ تحديد موقعك...', 'loading');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        updateQiblaData();
        updateStatus(`✅ تم التحديد بدقة ${Math.round(pos.coords.accuracy)} متر`, 'success');
        resolve(currentLocation);
      },
      (err) => {
        console.error('[Qibla] GPS error:', err);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function requestQiblaLocation() {
  try {
    await getLocation();
  } catch (err) {
    updateStatus('تعذر تحديد الموقع — فعّل GPS', 'error');
  }
}

/* ===== مستمع الحساس ===== */
function setupOrientation() {
  if (orientationHandler) {
    window.removeEventListener('deviceorientationabsolute', orientationHandler, true);
    window.removeEventListener('deviceorientation', orientationHandler, true);
  }

  orientationHandler = handleOrientation;

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', orientationHandler, true);
    console.log('[Qibla] Using deviceorientationabsolute');
  } else {
    window.addEventListener('deviceorientation', orientationHandler, true);
    console.log('[Qibla] Using deviceorientation');
  }
}

/* ===== معالجة الاتجاه ===== */
function handleOrientation(e) {
  let heading = null;

  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
    heading = e.webkitCompassHeading;
    compassAccuracy = 'high';
  } else if (e.alpha !== null && !isNaN(e.alpha)) {
    heading = 360 - e.alpha;
    compassAccuracy = e.absolute ? 'high' : 'medium';
  }

  if (heading === null || isNaN(heading)) return;

  deviceHeading = heading;

  // تنعيم قوي
  if (smoothedHeading === null) {
    smoothedHeading = heading;
  } else {
    const diff = ((heading - smoothedHeading + 540) % 360) - 180;
    smoothedHeading = (smoothedHeading + diff * 0.2 + 360) % 360;
  }

  updateNeedle();
  checkAlignment();
  updateAccuracyIndicator();
}

/* ===== تحديث الإبرة — CSS rotate فقط ===== */
function updateNeedle() {
  const needle = document.getElementById('qiblaNeedle');
  if (!needle || smoothedHeading === null) return;

  const rotation = qiblaBearing - smoothedHeading;
  needle.style.transform = `rotate(${rotation}deg)`;
}

/* ===== نظام التحديد العنيف + مؤشر الكعبة ===== */
function checkAlignment() {
  if (smoothedHeading === null) return;

  const rawRotation = ((qiblaBearing - smoothedHeading + 540) % 360) - 180;
  const absRotation = Math.abs(rawRotation);

  const isAligned = absRotation < 5;   // قفل دقيق
  const isClose   = absRotation < 15;  // قريب

  /* --- تحديث البوصلة --- */
  const compass = document.getElementById('qiblaCompassSvg');
  if (compass) {
    compass.classList.toggle('aligned', isAligned);
    compass.classList.toggle('close', isClose && !isAligned);
  }

  /* --- crosshair الكاميرا --- */
  const crosshair = document.querySelector('.ar-crosshair');
  if (crosshair) crosshair.classList.toggle('aligned', isAligned);

  /* --- ✅ مؤشر الكعبة في الكاميرا --- */
  const kaabaIndicator = document.querySelector('.ar-kaaba-indicator');
  if (kaabaIndicator) {
    kaabaIndicator.classList.toggle('visible', isAligned && arActive);
  }

  /* --- ملصق الحالة في الكاميرا --- */
  const arLabel = document.querySelector('.ar-label');
  if (arLabel) {
    arLabel.classList.toggle('aligned', isAligned);
    arLabel.textContent = isAligned
      ? '✅ أنت الآن متجه نحو الكعبة'
      : '🕋 الكعبة في هذا الاتجاه';
  }

  /* --- مؤشر الإزاحة --- */
  updateOffsetDisplay(rawRotation, isAligned);

  /* --- اهتزاز --- */
  if (isAligned && !lastLockState && navigator.vibrate) {
    navigator.vibrate([80, 40, 80, 40, 160]);
    lastVibrate = Date.now();
  } else if (isAligned && Date.now() - lastVibrate > 3000 && navigator.vibrate) {
    navigator.vibrate(40);
    lastVibrate = Date.now();
  }
  lastLockState = isAligned;

  /* --- الحالة --- */
  if (isAligned) {
    updateStatus('🎯 أنت الآن متجه نحو الكعبة', 'success');
  } else if (isClose) {
    updateStatus('⚠️ اقتربت — عدّل الاتجاه قليلاً', 'info');
  } else if (isListening) {
    updateStatus('استمر في الدوران...', 'info');
  }
}

/* ===== مؤشر الإزاحة ===== */
function updateOffsetDisplay(rotation, isAligned) {
  const el = document.getElementById('qiblaOffset');
  if (!el) return;

  if (isAligned) {
    el.innerHTML = '<span class="arrow">🎯</span> LOCKED';
    el.classList.add('aligned');
    return;
  }

  el.classList.remove('aligned');
  const abs = Math.abs(Math.round(rotation));
  const isRight = rotation > 0;
  const arrow = isRight ? '→' : '←';
  const dirText = isRight ? 'يمين' : 'يسار';
  el.innerHTML = `<span class="arrow">${arrow}</span> ${abs}° ${dirText}`;
}

/* ===== مؤشر الدقة ===== */
function updateAccuracyIndicator() {
  const el = document.getElementById('qiblaAccuracy');
  if (!el) return;

  const labels = {
    high:    { text: '🎯 دقة عالية',  color: '#7fe8a8' },
    medium:  { text: '⚠️ دقة متوسطة', color: '#ffd166' },
    low:     { text: '🔴 دقة منخفضة', color: '#ff8a7a' },
    unknown: { text: 'اضغط للتفعيل',  color: 'var(--gold-soft)' }
  };

  const l = labels[compassAccuracy] || labels.unknown;
  el.textContent = l.text;
  el.style.color = l.color;
}

/* ===== إعادة المحاولة ===== */
function retryQibla() {
  smoothedHeading = null;
  deviceHeading = null;
  isListening = false;
  updateStatus('جارٍ إعادة المحاولة...', 'loading');
  setTimeout(() => startQibla(), 300);
}

/* ===== الكاميرا AR ===== */
async function toggleARCamera() {
  const view = document.getElementById('qiblaARView');
  const btn = document.getElementById('qiblaARBtn');
  const label = document.getElementById('qiblaARLabel');
  const icon = btn?.querySelector('.qibla-btn-icon');
  const video = document.getElementById('qiblaVideo');

  const setBtnState = (iconText, labelText, isActive = false) => {
    if (icon) icon.textContent = iconText;
    if (label) label.textContent = labelText;
    if (btn) btn.classList.toggle('active', isActive);
  };

  if (arActive) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    if (video) video.srcObject = null;
    if (view) view.classList.remove('active');

    // ✅ إخفاء مؤشر الكعبة عند إغلاق الكاميرا
    const kaabaIndicator = document.querySelector('.ar-kaaba-indicator');
    if (kaabaIndicator) kaabaIndicator.classList.remove('visible');

    setBtnState('📷', 'تشغيل الكاميرا', false);
    arActive = false;
    return;
  }

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('camera-not-supported');
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (video) {
      video.srcObject = cameraStream;
      await video.play();
    }

    if (view) view.classList.add('active');
    setBtnState('❌', 'إيقاف الكاميرا', true);
    arActive = true;

    // ✅ فحص فوري للمحاذاة
    checkAlignment();

  } catch (err) {
    console.error('[Qibla AR]', err);
    if (err.name === 'NotAllowedError') {
      updateStatus('تم رفض إذن الكاميرا', 'error');
    } else if (err.name === 'NotFoundError') {
      updateStatus('لا توجد كاميرا متوفرة', 'error');
    } else {
      updateStatus('تعذر تشغيل الكاميرا', 'error');
    }
  }
}

/* ===== إيقاف ===== */
function stopQibla() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
    arActive = false;
  }

  if (orientationHandler) {
    window.removeEventListener('deviceorientationabsolute', orientationHandler, true);
    window.removeEventListener('deviceorientation', orientationHandler, true);
  }

  isListening = false;
}

/* ===== تحميل ===== */
document.addEventListener('DOMContentLoaded', () => {
  initQibla();
});

window.addEventListener('pagehide', stopQibla);
window.addEventListener('beforeunload', stopQibla);

/* ===== تصدير ===== */
window.showQibla = showQibla;
window.startQibla = startQibla;
window.retryQibla = retryQibla;
window.requestQiblaLocation = requestQiblaLocation;
window.toggleARCamera = toggleARCamera;
window.stopQibla = stopQibla;