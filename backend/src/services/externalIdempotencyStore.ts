import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { applyFirestoreSettingsOnce } from './openFinance/bankingConnectionStore';
import logger from '../config/logger';

const COLLECTION = 'external_idempotency';
const MAX_DOC_ID_LENGTH = 500;

// In-memory fallback used when Firestore is not configured (local dev / tests)
const memoryStore = new Map<string, string>();

let firestoreInstance: Firestore | null = null;
let firestoreInitAttempted = false;

function makeDocId(workspaceId: string, externalEventId: string): string {
  return `${workspaceId}__${externalEventId}`
    .replace(/\//g, '_')
    .slice(0, MAX_DOC_ID_LENGTH);
}

function isFirestoreConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_PROJECT_ID
      && process.env.FIREBASE_CLIENT_EMAIL
      && process.env.FIREBASE_PRIVATE_KEY)
    || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

async function getFirestoreOrNull(): Promise<Firestore | null> {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (firestoreInitAttempted) {
    return null;
  }

  firestoreInitAttempted = true;

  if (!isFirestoreConfigured()) {
    return null;
  }

  try {
    const existingApp = getApps()[0];
    const usingServiceAccount = Boolean(
      process.env.FIREBASE_PROJECT_ID
      && process.env.FIREBASE_CLIENT_EMAIL
      && process.env.FIREBASE_PRIVATE_KEY,
    );

    const app = existingApp || initializeApp(
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
    firestoreInstance = db;
    return db;
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      '[ExternalIdempotency] Failed to initialize Firestore — falling back to memory store',
    );
    return null;
  }
}

export async function hasProcessedExternalEvent(
  workspaceId: string,
  externalEventId: string,
): Promise<boolean> {
  const db = await getFirestoreOrNull();

  if (!db) {
    logger.warn('[ExternalIdempotency] Firestore unavailable — using in-memory fallback. Duplicate detection will NOT survive restarts.');
    return memoryStore.has(`${workspaceId}::${externalEventId}`);
  }

  const docId = makeDocId(workspaceId, externalEventId);
  const snapshot = await db.collection(COLLECTION).doc(docId).get();
  return snapshot.exists;
}

export async function markExternalEventProcessed(
  workspaceId: string,
  externalEventId: string,
): Promise<void> {
  const db = await getFirestoreOrNull();
  const processedAt = new Date().toISOString();

  if (!db) {
    logger.warn('[ExternalIdempotency] Firestore unavailable — marking event in-memory only. Events may be reprocessed after restart.');
    memoryStore.set(`${workspaceId}::${externalEventId}`, processedAt);
    return;
  }

  const docId = makeDocId(workspaceId, externalEventId);
  await db.collection(COLLECTION).doc(docId).set({
    workspaceId,
    externalEventId,
    processedAt,
  });
}

/** Only for use in tests. Clears the in-memory fallback store. */
export function resetExternalIdempotencyStoreForTests(): void {
  memoryStore.clear();
  firestoreInstance = null;
  firestoreInitAttempted = false;
}
