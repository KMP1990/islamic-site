/* ============================================
   IndexedDB Helper — v1.0
   ============================================ */

const IDB_NAME = 'tariq_alhuda_v1';
const IDB_VERSION = 1;
const IDB_STORES = ['surahs', 'ayahs', 'reciters', 'tafsir'];
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000;

let idbInstance = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (idbInstance) return resolve(idbInstance);
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB not supported'));

    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      IDB_STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt');
        }
      });
    };

    request.onsuccess = () => {
      idbInstance = request.result;
      resolve(idbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, id) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result.expiresAt && result.expiresAt < Date.now()) {
          idbDelete(storeName, id).catch(() => {});
          resolve(null);
          return;
        }
        resolve(result ? result.value : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(storeName, id, value, ttl = DEFAULT_TTL) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put({
        id,
        value,
        cachedAt: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : null
      });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function idbDelete(storeName, id) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function idbCleanup() {
  try {
    const db = await openIDB();
    const now = Date.now();
    for (const storeName of IDB_STORES) {
      await new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        req.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            if (cursor.value.expiresAt && cursor.value.expiresAt < now) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });
    }
  } catch (e) {}
}

async function idbClear() {
  try {
    const db = await openIDB();
    for (const storeName of IDB_STORES) {
      await new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function idbFetch(url, storeName = 'ayahs', ttl = DEFAULT_TTL) {
  const cached = await idbGet(storeName, url);
  if (cached) {
    console.log('📦 IDB hit:', url);
    return cached;
  }

  console.log('🌐 IDB miss — fetching:', url);
  const response = await fetch(url);
  const data = await response.json();
  await idbSet(storeName, url, data, ttl);
  return data;
}

setInterval(idbCleanup, 60 * 60 * 1000);
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(idbCleanup, 5000);
});

window.idbHelper = {
  get: idbGet,
  set: idbSet,
  delete: idbDelete,
  clear: idbClear,
  cleanup: idbCleanup,
  fetch: idbFetch,
  open: openIDB
};