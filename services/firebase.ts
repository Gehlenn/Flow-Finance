import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup as firebaseSignInWithPopup,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  linkWithPopup as firebaseLinkWithPopup,
  type Auth,
  type NextOrObserver,
  type Unsubscribe,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Configuração do projeto: komodo-flow
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'your_firebase_web_api_key_here',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:yourfirebaseappid',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const PLACEHOLDER_VALUES = new Set([
  '',
  'your_firebase_web_api_key_here',
  'your-project.firebaseapp.com',
  'your-project-id',
  'your-project.appspot.com',
  '000000000000',
  '1:000000000000:web:yourfirebaseappid',
]);

function isMeaningfulFirebaseValue(value: string | undefined): boolean {
  return Boolean(value && !PLACEHOLDER_VALUES.has(value.trim()));
}

export const isFirebaseConfigured = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
].every((value) => isMeaningfulFirebaseValue(value));

const app = isFirebaseConfigured
  ? (getApps()[0] || initializeApp(firebaseConfig))
  : null;

const auth = (isFirebaseConfigured && app
  ? getAuth(app)
  : {
      currentUser: null,
      signOut: async () => undefined,
    }) as Auth;

const db = (isFirebaseConfigured && app
  ? getFirestore(app)
  : null) as Firestore;

const googleProvider = (isFirebaseConfigured
  ? new GoogleAuthProvider()
  : { providerId: 'google.com' }) as GoogleAuthProvider;
if (isFirebaseConfigured) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

const appleProvider = (isFirebaseConfigured
  ? new OAuthProvider('apple.com')
  : { providerId: 'apple.com' }) as OAuthProvider;

const configurationError = Object.assign(new Error('Firebase auth is not configured for this environment.'), {
  code: 'auth/configuration-not-found',
});

const signInWithPopup = (async (...args: Parameters<typeof firebaseSignInWithPopup>) => {
  if (!isFirebaseConfigured) {
    throw configurationError;
  }

  return firebaseSignInWithPopup(...args);
}) as typeof firebaseSignInWithPopup;

const onAuthStateChanged = ((currentAuth: Auth, nextOrObserver: NextOrObserver<User>): Unsubscribe => {
  if (!isFirebaseConfigured) {
    queueMicrotask(() => {
      if (typeof nextOrObserver === 'function') {
        nextOrObserver(null);
      } else {
        nextOrObserver.next?.(null);
      }
    });
    return () => undefined;
  }

  return firebaseOnAuthStateChanged(currentAuth, nextOrObserver);
}) as typeof firebaseOnAuthStateChanged;

const linkWithPopup = (async (...args: Parameters<typeof firebaseLinkWithPopup>): Promise<UserCredential> => {
  if (!isFirebaseConfigured) {
    throw configurationError;
  }

  return firebaseLinkWithPopup(...args);
}) as typeof firebaseLinkWithPopup;

export {
  auth,
  db,
  googleProvider,
  appleProvider,
  signInWithPopup,
  onAuthStateChanged,
  linkWithPopup,
};