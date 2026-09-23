/* ============================================
   نظام المزامنة السحابية — Cloud Sync v1.0
   ============================================
   مزامنة كل الإعدادات مع Firebase:
   - الميزات
   - الرسائل
   - الأجهزة المحظورة
   - إعدادات المطور
   ============================================ */

const SYNC_VERSION = '1.0.0';

/* ===== الحالة ===== */
let syncState = {
  features: null,
  messages: null,
  bannedDevices: null,
  devSettings: null,
  initialized: false,
  isDeveloper: false
};

let syncListeners = [];
let featuresUnsubscribe = null;
let messagesUnsubscribe = null;
let bannedUnsubscribe = null;
let devSettingsUnsubscribe = null;

/* ============================================
   الميزات — Features
   ============================================ */
async function loadFeaturesFromCloud() {
  try {
    const data = await window.firebaseHelpers.fbGetDoc('settings', 'features');
    if (data && data.values) {
      syncState.features = data.values;
      localStorage.setItem('tariq_features_v1', JSON.stringify(data.values));
      return data.values;
    }
    return null;
  } catch (err) {
    console.warn('[Sync] Failed to load features:', err);
    return null;
  }
}

async function saveFeaturesToCloud(features) {
  try {
    await window.firebaseHelpers.fbSetDoc('settings', 'features', {
      values: features,
      updatedAt: new Date().toISOString(),
      updatedBy: window.authApi?.getCurrentUser()?.email || 'developer'
    });
    console.log('☁️ Features synced to cloud');
    return true;
  } catch (err) {
    console.error('[Sync] Failed to save features:', err);
    return false;
  }
}

function listenToFeatures(callback) {
  if (featuresUnsubscribe) featuresUnsubscribe();
  featuresUnsubscribe = window.firebaseHelpers.fbListenDoc('settings', 'features', (data) => {
    if (data && data.values) {
      syncState.features = data.values;
      localStorage.setItem('tariq_features_v1', JSON.stringify(data.values));
      if (typeof applyFeatures === 'function') applyFeatures();
      callback?.(data.values);
    }
  });
  return featuresUnsubscribe;
}

/* ============================================
   الرسائل — Messages
   ============================================ */
async function loadMessagesFromCloud() {
  try {
    const messages = await window.firebaseHelpers.fbGetCollection('messages');
    syncState.messages = messages;
    localStorage.setItem('tariq_dev_messages_v1', JSON.stringify(messages));
    return messages;
  } catch (err) {
    console.warn('[Sync] Failed to load messages:', err);
    return [];
  }
}

async function addMessageToCloud(message) {
  try {
    await window.firebaseHelpers.fbAddDoc('messages', message);
    console.log('☁️ Message added to cloud');
    return true;
  } catch (err) {
    console.error('[Sync] Failed to add message:', err);
    return false;
  }
}

async function updateMessageInCloud(id, updates) {
  try {
    await window.firebaseHelpers.fbSetDoc('messages', id, updates);
    return true;
  } catch (err) {
    console.error('[Sync] Failed to update message:', err);
    return false;
  }
}

async function deleteMessageFromCloud(id) {
  try {
    await window.firebaseHelpers.fbDeleteDoc('messages', id);
    return true;
  } catch (err) {
    console.error('[Sync] Failed to delete message:', err);
    return false;
  }
}

function listenToMessages(callback) {
  if (messagesUnsubscribe) messagesUnsubscribe();
  messagesUnsubscribe = window.firebaseHelpers.fbListenCollection('messages', (messages) => {
    syncState.messages = messages;
    localStorage.setItem('tariq_dev_messages_v1', JSON.stringify(messages));
    if (typeof renderDevMessages === 'function') renderDevMessages();
    callback?.(messages);
  });
  return messagesUnsubscribe;
}

/* ============================================
   الأجهزة المحظورة — Banned Devices
   ============================================ */
async function loadBannedDevicesFromCloud() {
  try {
    const devices = await window.firebaseHelpers.fbGetCollection('bannedDevices');
    syncState.bannedDevices = devices;
    localStorage.setItem('tariq_banned_devices_v1', JSON.stringify(devices));
    return devices;
  } catch (err) {
    console.warn('[Sync] Failed to load banned devices:', err);
    return [];
  }
}

async function addBannedDeviceToCloud(device) {
  try {
    await window.firebaseHelpers.fbAddDoc('bannedDevices', device);
    console.log('☁️ Device banned in cloud');
    return true;
  } catch (err) {
    console.error('[Sync] Failed to ban device:', err);
    return false;
  }
}

async function removeBannedDeviceFromCloud(id) {
  try {
    await window.firebaseHelpers.fbDeleteDoc('bannedDevices', id);
    return true;
  } catch (err) {
    console.error('[Sync] Failed to unban device:', err);
    return false;
  }
}

function listenToBannedDevices(callback) {
  if (bannedUnsubscribe) bannedUnsubscribe();
  bannedUnsubscribe = window.firebaseHelpers.fbListenCollection('bannedDevices', (devices) => {
    syncState.bannedDevices = devices;
    localStorage.setItem('tariq_banned_devices_v1', JSON.stringify(devices));
    callback?.(devices);
  });
  return bannedUnsubscribe;
}

/* ============================================
   إعدادات المطور — Dev Settings
   ============================================ */
async function loadDevSettingsFromCloud() {
  try {
    const data = await window.firebaseHelpers.fbGetDoc('settings', 'developer');
    if (data && data.values) {
      syncState.devSettings = data.values;
      localStorage.setItem('tariq_dev_settings', JSON.stringify(data.values));
      return data.values;
    }
    return null;
  } catch (err) {
    console.warn('[Sync] Failed to load dev settings:', err);
    return null;
  }
}

async function saveDevSettingsToCloud(settings) {
  try {
    await window.firebaseHelpers.fbSetDoc('settings', 'developer', {
      values: settings,
      updatedAt: new Date().toISOString(),
      updatedBy: window.authApi?.getCurrentUser()?.email || 'developer'
    });
    console.log('☁️ Dev settings synced to cloud');
    return true;
  } catch (err) {
    console.error('[Sync] Failed to save dev settings:', err);
    return false;
  }
}

function listenToDevSettings(callback) {
  if (devSettingsUnsubscribe) devSettingsUnsubscribe();
  devSettingsUnsubscribe = window.firebaseHelpers.fbListenDoc('settings', 'developer', (data) => {
    if (data && data.values) {
      syncState.devSettings = data.values;
      localStorage.setItem('tariq_dev_settings', JSON.stringify(data.values));
      if (typeof refreshPublicSurfaces === 'function') refreshPublicSurfaces();
      callback?.(data.values);
    }
  });
  return devSettingsUnsubscribe;
}

/* ============================================
   التهيئة الشاملة
   ============================================ */
async function initCloudSync() {
  if (syncState.initialized) return;

  if (!window.firebaseHelpers) {
    console.warn('[Sync] Firebase not loaded, using localStorage only');
    return;
  }

  try {
    await window.firebaseHelpers.whenFirebaseReady();

    /* ✅ تحميل أولي */
    await Promise.all([
      loadFeaturesFromCloud(),
      loadMessagesFromCloud(),
      loadBannedDevicesFromCloud(),
      loadDevSettingsFromCloud()
    ]);

    /* ✅ تطبيق الميزات */
    if (typeof applyFeatures === 'function') applyFeatures();

    /* ✅ عرض الرسائل */
    if (typeof renderDevMessages === 'function') renderDevMessages();

    /* ✅ بدء الاستماع للتغييرات الحية */
    listenToFeatures((features) => {
      console.log('☁️ Features updated from cloud:', features);
      if (typeof applyFeatures === 'function') applyFeatures();
      if (typeof renderFeaturesGrid === 'function') renderFeaturesGrid();
    });

    listenToMessages((messages) => {
      console.log('☁️ Messages updated from cloud:', messages.length);
      if (typeof renderDevMessages === 'function') renderDevMessages();
      if (typeof renderDevMessagesList === 'function') renderDevMessagesList();
    });

    listenToBannedDevices((devices) => {
      console.log('☁️ Banned devices updated:', devices.length);
      if (typeof renderBannedDevices === 'function') renderBannedDevices();
      /* ✅ فحص فوري: هل جهازي محظور؟ */
      if (typeof isDeviceBanned === 'function' && isDeviceBanned()) {
        alert('🚫 تم حظر جهازك من استخدام التطبيق');
        window.location.href = 'index.html';
      }
    });

    listenToDevSettings((settings) => {
      console.log('☁️ Dev settings updated from cloud');
      if (typeof refreshPublicSurfaces === 'function') refreshPublicSurfaces();
      if (typeof renderMaintenance === 'function') renderMaintenance();
      if (typeof renderSiteBanner === 'function') renderSiteBanner();
    });

    syncState.initialized = true;
    console.log('✅ Cloud sync initialized');

  } catch (err) {
    console.error('[Sync] Failed to initialize:', err);
  }
}

/* ============================================
   معلومات الحالة
   ============================================ */
function getSyncState() {
  return {
    ...syncState,
    version: SYNC_VERSION
  };
}

/* ============================================
   تصدير
   ============================================ */
window.cloudSync = {
  init: initCloudSync,
  getState: getSyncState,

  /* Features */
  loadFeatures: loadFeaturesFromCloud,
  saveFeatures: saveFeaturesToCloud,

  /* Messages */
  loadMessages: loadMessagesFromCloud,
  addMessage: addMessageToCloud,
  updateMessage: updateMessageInCloud,
  deleteMessage: deleteMessageFromCloud,

  /* Banned */
  loadBanned: loadBannedDevicesFromCloud,
  addBanned: addBannedDeviceToCloud,
  removeBanned: removeBannedDeviceFromCloud,

  /* Dev Settings */
  loadDevSettings: loadDevSettingsFromCloud,
  saveDevSettings: saveDevSettingsToCloud
};