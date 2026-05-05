/**
 * Shared Firebase Admin / Firestore initialization helpers.
 * Used by backend services that need optional Firestore access with a
 * memory-fallback when credentials are not configured.
 */

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import logger from '../config/logger';

// ─── Settings guard ───────────────────────────────────────────────────────────

let firestoreSettingsConfigured = false;

export function applyFirestoreSettingsOnce(
  firestore: { settings: (options: { ignoreUndefinedProperties: boolean }) => void },
): void {
  if (firestoreSettingsConfigured) return;
  firestore.settings({ ignoreUndefinedProperties: true });
  firestoreSettingsConfigured = true;
}

/** Only for use in tests — resets the settings guard between test cases. */
export function _resetFirestoreSettingsForTests(): void {
  firestoreSettingsConfigured = false;
}

// ─── Credential detection ────────────────────────────────────────────────────

export function isServiceAccountConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function isFirebaseConfigured(): boolean {
  return isServiceAccountConfigured() || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

// ─── Lazy singleton initializer ──────────────────────────────────────────────

let _sharedFirestore: Firestore | null = null;
let _initAttempted = false;

/**
 * Returns the shared Firestore instance, or null when Firebase is not
 * configured (e.g. local dev without credentials). Never throws.
 */
export async function getFirestoreOrNull(callerLabel = 'FirestoreAdmin'): Promise<Firestore | null> {
  if (_sharedFirestore) return _sharedFirestore;
  if (_initAttempted) return null;
  _initAttempted = true;

  if (!isFirebaseConfigured()) return null;

  try {
    const existingApp = getApps()[0];
    const usingServiceAccount = isServiceAccountConfigured();

    const app =
      existingApp ||
      initializeApp(
        usingServiceAccount
          ? {
              credential: cert({
                projectId: String(process.env.FIREBASE_PROJECT_ID),
                clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL),
                privateKey: String(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
              }),
              projectId: String(process.env.FIREBASE_PROJECT_ID),
              databaseURL: process.env.FIREBASE_DATABASE_URL,
            }
          : {
              credential: applicationDefault(),
              projectId: process.env.FIREBASE_PROJECT_ID,
              databaseURL: process.env.FIREBASE_DATABASE_URL,
            },
      );

    const db = getFirestore(app);
    applyFirestoreSettingsOnce(db);
    _sharedFirestore = db;
    return db;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      `[${callerLabel}] Firestore init failed — using memory fallback`,
    );
    return null;
  }
}

/** Only for use in tests — resets the shared singleton between test cases. */
export function _resetFirestoreInstanceForTests(): void {
  _sharedFirestore = null;
  _initAttempted = false;
}
