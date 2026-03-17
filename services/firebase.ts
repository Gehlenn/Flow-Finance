// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, linkWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Configuração do projeto: komodo-flow
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth usando o padrão Web (getAuth detecta persistência automaticamente)
const auth = getAuth(app);

// Inicializa o Firestore
const db = getFirestore(app);

// Provedores de Autenticação
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const appleProvider = new OAuthProvider("apple.com");

export {
  auth,
  db,
  googleProvider,
  appleProvider,
  signInWithPopup,
  onAuthStateChanged,
  linkWithPopup
};