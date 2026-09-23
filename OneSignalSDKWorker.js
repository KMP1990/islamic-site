/* ===== OneSignal SDK Worker ===== */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

/* ✅ معالجة رسائل postMessage */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});