import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, linkWithPopup, Auth } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch, onSnapshot, Firestore } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from "firebase/storage";

/**
 * Firebase Configuration - Optimized for Production
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your_firebase_web_api_key_here",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:yourfirebaseappid",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Lazy initialization
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

const initializeFirebase = () => {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
};

const getFirebaseAuth = (): Auth => {
  if (!auth) {
    const initializedApp = initializeFirebase()!;
    auth = getAuth(initializedApp);
  }
  return auth;
};

const getFirebaseDb = (): Firestore => {
  if (!db) {
    const initializedApp = initializeFirebase()!;
    db = getFirestore(initializedApp);
  }
  return db;
};

const getFirebaseStorage = (): FirebaseStorage => {
  if (!storage) {
    const initializedApp = initializeFirebase()!;
    storage = getStorage(initializedApp);
  }
  return storage;
};

// ─── OPTIMIZED FIREBASE OPERATIONS ──────────────────────────────────────────

// Cache for frequently accessed data
type FirebaseRecord = Record<string, unknown> & { id: string };
type AccountRecord = FirebaseRecord & { user_id: string };
type TransactionRecord = FirebaseRecord & { user_id: string };

const dataCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = <T,>(key: string): T | null => {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }
  dataCache.delete(key);
  return null;
};

const setCachedData = (key: string, data: unknown, ttl = CACHE_TTL) => {
  dataCache.set(key, { data, timestamp: Date.now(), ttl });
};

// ─── ACCOUNTS OPERATIONS ────────────────────────────────────────────────────

export const getAccounts = async (userId: string): Promise<FirebaseRecord[]> => {
  const cacheKey = `accounts_${userId}`;
  const cached = getCachedData<FirebaseRecord[]>(cacheKey);
  if (cached) return cached;

  const db = getFirebaseDb();
  const q = query(collection(db, 'accounts'), where('user_id', '==', userId));
  const snapshot = await getDocs(q);
  const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirebaseRecord[];

  setCachedData(cacheKey, accounts);
  return accounts;
};

export const createAccount = async (account: Record<string, unknown> & { user_id: string }): Promise<void> => {
  const db = getFirebaseDb();
  const docRef = doc(collection(db, 'accounts'));
  await setDoc(docRef, { ...account, id: docRef.id, created_at: new Date() });

  // Invalidate cache
  dataCache.delete(`accounts_${account.user_id}`);
};

export const updateAccount = async (account: AccountRecord): Promise<void> => {
  const db = getFirebaseDb();
  const docRef = doc(db, 'accounts', account.id);
  await updateDoc(docRef, { ...account, updated_at: new Date() });

  // Invalidate cache
  dataCache.delete(`accounts_${account.user_id}`);
};

export const deleteAccount = async (accountId: string, userId: string): Promise<void> => {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'accounts', accountId));

  // Invalidate cache
  dataCache.delete(`accounts_${userId}`);
};

// ─── TRANSACTIONS OPERATIONS (BATCHED) ──────────────────────────────────────

export const getTransactions = async (userId: string, limitCount = 100): Promise<FirebaseRecord[]> => {
  const cacheKey = `transactions_${userId}_${limitCount}`;
  const cached = getCachedData<FirebaseRecord[]>(cacheKey);
  if (cached) return cached;

  const db = getFirebaseDb();
  const q = query(
    collection(db, 'transactions'),
    where('user_id', '==', userId),
    orderBy('date', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirebaseRecord[];

  setCachedData(cacheKey, transactions, 2 * 60 * 1000); // 2 minutes cache
  return transactions;
};

export const batchCreateTransactions = async (transactions: TransactionRecord[]): Promise<void> => {
  if (transactions.length === 0) return;

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  transactions.forEach(transaction => {
    const docRef = doc(collection(db, 'transactions'));
    batch.set(docRef, { ...transaction, id: docRef.id, created_at: new Date() });
  });

  await batch.commit();

  // Invalidate cache
  const userId = transactions[0].user_id;
  dataCache.delete(`transactions_${userId}_100`);
};

export const batchUpdateTransactions = async (transactions: TransactionRecord[]): Promise<void> => {
  if (transactions.length === 0) return;

  const db = getFirebaseDb();
  const batch = writeBatch(db);

  transactions.forEach(transaction => {
    const docRef = doc(db, 'transactions', transaction.id);
    batch.update(docRef, { ...transaction, updated_at: new Date() });
  });

  await batch.commit();

  // Invalidate cache
  const userId = transactions[0].user_id;
  dataCache.delete(`transactions_${userId}_100`);
};

// ─── REAL-TIME SUBSCRIPTIONS ────────────────────────────────────────────────

export const subscribeToTransactions = (userId: string, callback: (transactions: FirebaseRecord[]) => void) => {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'transactions'),
    where('user_id', '==', userId),
    orderBy('date', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirebaseRecord[];
    callback(transactions);
  });
};

export const subscribeToAccounts = (userId: string, callback: (accounts: FirebaseRecord[]) => void) => {
  const db = getFirebaseDb();
  const q = query(collection(db, 'accounts'), where('user_id', '==', userId));

  return onSnapshot(q, (snapshot) => {
    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FirebaseRecord[];
    callback(accounts);
  });
};

// ─── STORAGE OPERATIONS ─────────────────────────────────────────────────────

export const uploadReceiptImage = async (userId: string, file: File): Promise<string> => {
  const storage = getFirebaseStorage();
  const fileName = `${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `receipts/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  return downloadURL;
};

export const deleteReceiptImage = async (imageUrl: string): Promise<void> => {
  const storage = getFirebaseStorage();
  const imageRef = ref(storage, imageUrl);
  await deleteObject(imageRef);
};

// ─── AUTH PROVIDERS ─────────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const appleProvider = new OAuthProvider("apple.com");

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export {
  getFirebaseAuth as auth,
  getFirebaseDb as db,
  getFirebaseStorage as storage,
  googleProvider,
  appleProvider,
  signInWithPopup,
  onAuthStateChanged,
  linkWithPopup,
};
