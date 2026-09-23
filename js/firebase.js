/* ===== Firebase Initialization + Helpers (v3) ===== */

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDB = null;
let firebaseReady = false;
let firebaseAuthModule = null;
let firebaseFirestoreModule = null;

const FIREBASE_SDK_VERSION = '10.12.0';
const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

async function initFirebase() {
  if (firebaseReady) return { auth: firebaseAuth, db: firebaseDB };
  if (typeof FIREBASE_CONFIG === 'undefined') {
    console.warn('[Firebase] Config missing');
    return null;
  }

  try {
    const [{ initializeApp }, authModule, firestoreModule] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`),
      import(`${FIREBASE_CDN}/firebase-auth.js`),
      import(`${FIREBASE_CDN}/firebase-firestore.js`)
    ]);

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = authModule.getAuth(firebaseApp);
    firebaseDB = firestoreModule.getFirestore(firebaseApp);
    firebaseAuthModule = authModule;
    firebaseFirestoreModule = firestoreModule;

    await authModule.setPersistence(firebaseAuth, authModule.browserLocalPersistence);

    firebaseReady = true;
    console.log('✅ Firebase ready');
    return { auth: firebaseAuth, db: firebaseDB };
  } catch (error) {
    console.error('❌ Firebase init failed:', error);
    return null;
  }
}

function whenFirebaseReady() {
  return new Promise((resolve) => {
    if (firebaseReady) return resolve({ auth: firebaseAuth, db: firebaseDB });
    const check = setInterval(() => {
      if (firebaseReady) {
        clearInterval(check);
        resolve({ auth: firebaseAuth, db: firebaseDB });
      }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      if (!firebaseReady) resolve(null);
    }, 10000);
  });
}

async function fbSignUp(email, password, displayName) {
  const { auth } = await whenFirebaseReady();
  if (!auth) throw new Error('Firebase not ready');
  const credential = await firebaseAuthModule.createUserWithEmailAndPassword(auth, email, password);
  if (displayName && credential.user) {
    await firebaseAuthModule.updateProfile(credential.user, { displayName });
  }
  return credential;
}

async function fbSignIn(email, password) {
  const { auth } = await whenFirebaseReady();
  if (!auth) throw new Error('Firebase not ready');
  return await firebaseAuthModule.signInWithEmailAndPassword(auth, email, password);
}

async function fbSignOut() {
  const { auth } = await whenFirebaseReady();
  if (!auth) return;
  await firebaseAuthModule.signOut(auth);
}

async function fbGetCurrentUser() {
  const { auth } = await whenFirebaseReady();
  if (!auth) return null;
  return auth.currentUser;
}

async function fbOnAuthStateChanged(callback) {
  const { auth } = await whenFirebaseReady();
  if (!auth) return () => {};
  return firebaseAuthModule.onAuthStateChanged(auth, callback);
}

async function fbSendPasswordReset(email) {
  const { auth } = await whenFirebaseReady();
  if (!auth) throw new Error('Firebase not ready');
  return await firebaseAuthModule.sendPasswordResetEmail(auth, email);
}

async function fbGetCollection(name, options = {}) {
  const { db } = await whenFirebaseReady();
  if (!db) return [];
  const { collection, query, orderBy, where, getDocs, limit } = firebaseFirestoreModule;

  let q = collection(db, name);
  const constraints = [];
  if (options.where) options.where.forEach(w => constraints.push(where(w[0], w[1], w[2])));
  if (options.orderBy) constraints.push(orderBy(options.orderBy[0], options.orderBy[1] || 'desc'));
  if (options.limit) constraints.push(limit(options.limit));

  if (constraints.length) q = query(q, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fbAddDoc(name, data) {
  const { db } = await whenFirebaseReady();
  if (!db) throw new Error('Firebase not ready');
  const { collection, addDoc, serverTimestamp } = firebaseFirestoreModule;
  return await addDoc(collection(db, name), { ...data, createdAt: serverTimestamp() });
}

async function fbSetDoc(name, id, data) {
  const { db } = await whenFirebaseReady();
  if (!db) throw new Error('Firebase not ready');
  const { doc, setDoc, serverTimestamp } = firebaseFirestoreModule;
  return await setDoc(doc(db, name, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

async function fbUpdateDoc(name, id, data) {
  const { db } = await whenFirebaseReady();
  if (!db) throw new Error('Firebase not ready');
  const { doc, updateDoc, serverTimestamp } = firebaseFirestoreModule;
  return await updateDoc(doc(db, name, id), { ...data, updatedAt: serverTimestamp() });
}

async function fbGetDoc(name, id) {
  const { db } = await whenFirebaseReady();
  if (!db) return null;
  const { doc, getDoc } = firebaseFirestoreModule;
  const snap = await getDoc(doc(db, name, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function fbDeleteDoc(name, id) {
  const { db } = await whenFirebaseReady();
  if (!db) throw new Error('Firebase not ready');
  const { doc, deleteDoc } = firebaseFirestoreModule;
  return await deleteDoc(doc(db, name, id));
}

async function fbListenCollection(name, callback, options = {}) {
  const { db } = await whenFirebaseReady();
  if (!db) return () => {};
  const { collection, query, orderBy, onSnapshot, limit } = firebaseFirestoreModule;

  let q = collection(db, name);
  const constraints = [];
  if (options.orderBy) constraints.push(orderBy(options.orderBy[0], options.orderBy[1] || 'desc'));
  if (options.limit) constraints.push(limit(options.limit));
  if (constraints.length) q = query(q, ...constraints);

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, (error) => {
    console.error(`[Firestore] ${name} listen error:`, error);
  });
}

async function fbListenDoc(name, id, callback) {
  const { db } = await whenFirebaseReady();
  if (!db) return () => {};
  const { doc, onSnapshot } = firebaseFirestoreModule;

  return onSnapshot(doc(db, name, id), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`[Firestore] ${name}/${id} listen error:`, error);
  });
}

async function verifyDevPassword(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  try {
    const stored = await fbGetDoc('settings', 'devPassword');
    if (stored && stored.hash) {
      return hashHex === stored.hash;
    }
  } catch (e) {}

  if (typeof DEV_PASSWORD_HASH !== 'undefined' && DEV_PASSWORD_HASH) {
    return hashHex === DEV_PASSWORD_HASH;
  }

  return false;
}

async function setDevPassword(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  await fbSetDoc('settings', 'devPassword', {
    hash: hashHex,
    updatedAt: new Date().toISOString()
  });

  return hashHex;
}

window.firebaseHelpers = {
  initFirebase,
  whenFirebaseReady,
  fbSignUp,
  fbSignIn,
  fbSignOut,
  fbGetCurrentUser,
  fbOnAuthStateChanged,
  fbSendPasswordReset,
  fbGetCollection,
  fbGetDoc,
  fbAddDoc,
  fbSetDoc,
  fbUpdateDoc,
  fbDeleteDoc,
  fbListenCollection,
  fbListenDoc,
  verifyDevPassword,
  setDevPassword,
  get isReady() { return firebaseReady; }
};

if (typeof FIREBASE_CONFIG !== 'undefined') {
  initFirebase();
}