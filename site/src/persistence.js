const LOCAL_STORAGE_KEY = "sw-holocron-state-v1";
const FIREBASE_VERSION = "12.16.0";

function normalizeMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStatePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { figures: {}, sets: {} };
  }

  if ("figures" in value || "sets" in value) {
    return {
      figures: normalizeMap(value.figures),
      sets: normalizeMap(value.sets),
    };
  }

  return {
    figures: normalizeMap(value),
    sets: {},
  };
}

export async function createPersistence(config) {
  if (!hasFirebaseConfig(config)) {
    return createLocalPersistence("Firebase config missing. Running in local device mode.");
  }

  try {
    const [firebaseApp, firebaseAuth, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    ]);
    return createFirebasePersistence(config, firebaseApp, firebaseAuth, firestoreModule);
  } catch (error) {
    return createLocalPersistence(`Firebase SDK unavailable. Falling back to local mode. ${error.message}`);
  }
}

function hasFirebaseConfig(config) {
  return Boolean(
    config?.apiKey &&
      config?.authDomain &&
      config?.projectId &&
      config?.appId,
  );
}

function createLocalPersistence(reason) {
  let currentState = readLocalState();
  const listeners = new Set();
  const localSession = {
    mode: "local",
    authorized: true,
    userId: "local-owner",
    user: {
      displayName: "Local Holocron",
      email: "device@offline.local",
      photoURL: "",
    },
    reason,
  };

  return {
    mode: "local",
    reason,
    onSessionChange(callback) {
      callback(localSession);
      return () => {};
    },
    subscribeState(userId, callback) {
      callback(currentState);
      const listener = () => callback(currentState);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async saveState(userId, state) {
      currentState = normalizeStatePayload(state);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentState));
      listeners.forEach((listener) => listener());
    },
    async signIn() {
      return localSession;
    },
    async signOut() {
      return localSession;
    },
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? normalizeStatePayload(JSON.parse(raw)) : { figures: {}, sets: {} };
  } catch (error) {
    return { figures: {}, sets: {} };
  }
}

function createFirebasePersistence(config, appModule, authModule, firestoreModule) {
  const app = appModule.initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  }, config.appName || "star-wars-minifigure-holocron");

  const auth = authModule.getAuth(app);
  const db = firestoreModule.getFirestore(app);
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  return {
    mode: "firebase",
    reason: "Firebase sync active.",
    onSessionChange(callback) {
      return authModule.onAuthStateChanged(auth, (user) => {
        const ownerEmail = (config.ownerEmail || "").trim().toLowerCase();
        const userEmail = (user?.email || "").trim().toLowerCase();
        callback({
          mode: "firebase",
          authorized: Boolean(user) && (!ownerEmail || ownerEmail === userEmail),
          userId: user?.uid || null,
          user,
          reason: ownerEmail && user && ownerEmail !== userEmail
            ? `Signed in as ${user.email}, but ownerEmail is set to ${config.ownerEmail}.`
            : "Firebase sync active.",
        });
      });
    },
    subscribeState(userId, callback) {
      const stateRef = firestoreModule.doc(db, "users", userId, "state", "main");
      return firestoreModule.onSnapshot(stateRef, (snapshot) => {
        callback(normalizeStatePayload(snapshot.exists() ? snapshot.data() : null));
      });
    },
    async saveState(userId, state) {
      const normalized = normalizeStatePayload(state);
      const stateRef = firestoreModule.doc(db, "users", userId, "state", "main");
      await firestoreModule.setDoc(stateRef, {
        figures: normalized.figures,
        sets: normalized.sets,
        updatedAt: firestoreModule.serverTimestamp(),
      }, { merge: true });
    },
    async signIn() {
      await authModule.signInWithPopup(auth, provider);
    },
    async signOut() {
      await authModule.signOut(auth);
    },
  };
}
