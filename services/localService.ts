import { Transaction, Alert, Reminder, Goal } from '../types';
import { Account } from '../models/Account';

// basic types for the in‑memory auth and firestore mocks
export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string | null;
}

export type AuthInstance = typeof auth;
export interface Provider { providerId: string; }
export type AuthCallback = (user: User | null) => void;

// generic event emitter can carry any data payload
type EventCallback<T = unknown> = (data: T) => void;

// --- Accounts Storage ---
const STORAGE_KEY_ACCOUNTS = 'flow_accounts';

export const getAccounts = async (userId: string): Promise<Account[]> => {
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  const all: Account[] = raw ? JSON.parse(raw) : [];
  return all.filter(a => a.user_id === userId);
};

export const createAccount = async (account: Account): Promise<void> => {
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  const all: Account[] = raw ? JSON.parse(raw) : [];
  all.push(account);
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(all));
};

export const updateAccount = async (account: Account): Promise<void> => {
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  const all: Account[] = raw ? JSON.parse(raw) : [];
  const updated = all.map(a => a.id === account.id ? account : a);
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(updated));
};

export const deleteAccount = async (accountId: string): Promise<void> => {
  const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
  const all: Account[] = raw ? JSON.parse(raw) : [];
  const filtered = all.filter(a => a.id !== accountId);
  localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(filtered));
};

// --- Event Bus for Local Updates ---
const listeners: Record<string, Function[]> = {};
const authListeners: Function[] = [];

function emit<T = unknown>(event: string, data: T) {
  if (listeners[event]) {
    listeners[event].forEach(cb => cb(data));
  }
}

function on<T = unknown>(event: string, cb: EventCallback<T>) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb as Function);
  return () => {
    listeners[event] = listeners[event].filter(l => l !== cb);
  };
}

// --- Constants ---
const STORAGE_KEY_USER = 'flow_currentUser';
const STORAGE_KEY_DATA = 'flow_data';

// --- Auth Mock ---

export const auth = {
  get currentUser() {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    return stored ? JSON.parse(stored) : null;
  },
  signOut: async () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    notifyAuthChange(null);
  }
};

function notifyAuthChange(user: User | null) {
  authListeners.forEach(cb => cb(user));
}

export const onAuthStateChanged = (authInstance: AuthInstance, callback: AuthCallback) => {
  authListeners.push(callback as Function);
  // Initial check
  const user = authInstance.currentUser as User | null;
  callback(user);
  return () => {
    const idx = authListeners.indexOf(callback as Function);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const googleProvider = { providerId: 'google.com' };
export const appleProvider = { providerId: 'apple.com' };

export const signInWithPopup = async (authInstance: AuthInstance, provider: Provider) => {
  // Simulate Google/User provider
  const user: User = {
    uid: 'local-google-user',
    email: 'usuario@google.com',
    displayName: 'Usuário Google Local',
    photoURL: null
  };
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  notifyAuthChange(user);
  return { user };
};

export const linkWithPopup = async (user: User, provider: Provider) => {
    // Simulate linking
    console.log(`Linking ${provider.providerId} to user ${user.uid}`);
    return { user };
};

export const signInWithEmailAndPassword = async (auth: AuthInstance, email: string, pass: string) => {
    const user: User = { 
        uid: 'local-email-' + email.replace(/[^a-zA-Z0-9]/g, ''), 
        email, 
        displayName: email.split('@')[0] 
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    notifyAuthChange(user);
    return { user };
}

export const createUserWithEmailAndPassword = async (auth: AuthInstance, email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
}

export const sendPasswordResetEmail = async (auth: AuthInstance, email: string) => { return true; }


// --- Firestore Mock ---

export const db = {}; // Dummy object

export const doc = (dbInstance: unknown, collection: string, id: string) => {
  return { path: `${collection}/${id}`, id };
};

export const setDoc = async <T extends Record<string, any>>(docRef: { path: string }, data: T, options?: { merge: boolean }) => {

  const allData: Record<string, any> = JSON.parse(localStorage.getItem(STORAGE_KEY_DATA) || '{}');
  const currentDoc: Record<string, any> = allData[docRef.path] || {};
  
  const newData = options?.merge ? { ...currentDoc, ...data } : data;

  
  allData[docRef.path] = newData;
  localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(allData));
  
  // Emit snapshot event
  emit(docRef.path, {
    exists: () => true,
    data: () => newData
  });
};

export const onSnapshot = (docRef: { path: string }, callback: EventCallback, errorCallback?: EventCallback) => {
  // Initial call
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEY_DATA) || '{}');
  const currentDoc = allData[docRef.path];
  
  callback({
    exists: () => !!currentDoc,
    data: () => currentDoc || undefined
  });

  // Subscribe
  return on(docRef.path, callback);
};
