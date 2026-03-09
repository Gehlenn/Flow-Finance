// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, linkWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Configuração do projeto: komodo-flow
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

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