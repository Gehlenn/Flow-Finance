import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, linkWithPopup } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, writeBatch, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/**
 * Firebase Configuration - Optimized for Production
 */
const firebaseConfig = {
  apiKey: "AIzaSyDoEJZbiGeC_tRum31PDlBuYUzlOaEmTrk",
  authDomain: "komodo-flow.firebaseapp.com",
  projectId: "komodo-flow",
  storageBucket: "komodo-flow.firebasestorage.app",
  messagingSenderId: "160845603769",
  appId: "1:160845603769:web:da3e9ac2fe80387357cc68",
  measurementId: "G-X9ZKDT6VK9"
};

// Lazy initialization
let app: any;
let auth: any;
let db: any;
let storage: any;

const initializeFirebase = () => {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
};

const getFirebaseAuth = () => {
  if (!auth) {
    initializeFirebase();
    auth = getAuth(app);
  }
  return auth;
};

const getFirebaseDb = () => {
  if (!db) {
    initializeFirebase();
    db = getFirestore(app);
  }
  return db;
};

const getFirebaseStorage = () => {
  if (!storage) {
    initializeFirebase();
    storage = getStorage(app);
  }
  return storage;
};

// ─── OPTIMIZED FIREBASE OPERATIONS ──────────────────────────────────────────

// Cache for frequently accessed data
const dataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key: string) => {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  dataCache.delete(key);
  return null;
};

const setCachedData = (key: string, data: any, ttl = CACHE_TTL) => {
  dataCache.set(key, { data, timestamp: Date.now(), ttl });
};

// ─── ACCOUNTS OPERATIONS ────────────────────────────────────────────────────

export const getAccounts = async (userId: string): Promise<any[]> => {
  const cacheKey = `accounts_${userId}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const db = getFirebaseDb();
  const q = query(collection(db, 'accounts'), where('user_id', '==', userId));
  const snapshot = await getDocs(q);
  const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  setCachedData(cacheKey, accounts);
  return accounts;
};

export const createAccount = async (account: any): Promise<void> => {
  const db = getFirebaseDb();
  const docRef = doc(collection(db, 'accounts'));
  await setDoc(docRef, { ...account, id: docRef.id, created_at: new Date() });

  // Invalidate cache
  dataCache.delete(`accounts_${account.user_id}`);
};

export const updateAccount = async (account: any): Promise<void> => {
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

export const getTransactions = async (userId: string, limitCount = 100): Promise<any[]> => {
  const cacheKey = `transactions_${userId}_${limitCount}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const db = getFirebaseDb();
  const q = query(
    collection(db, 'transactions'),
    where('user_id', '==', userId),
    orderBy('date', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  setCachedData(cacheKey, transactions, 2 * 60 * 1000); // 2 minutes cache
  return transactions;
};

export const batchCreateTransactions = async (transactions: any[]): Promise<void> => {
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

export const batchUpdateTransactions = async (transactions: any[]): Promise<void> => {
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

export const subscribeToTransactions = (userId: string, callback: (transactions: any[]) => void) => {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'transactions'),
    where('user_id', '==', userId),
    orderBy('date', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(transactions);
  });
};

export const subscribeToAccounts = (userId: string, callback: (accounts: any[]) => void) => {
  const db = getFirebaseDb();
  const q = query(collection(db, 'accounts'), where('user_id', '==', userId));

  return onSnapshot(q, (snapshot) => {
    const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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