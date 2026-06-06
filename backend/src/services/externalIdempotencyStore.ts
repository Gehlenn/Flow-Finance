import logger from '../config/logger';
import { getFirestoreOrNull } from '../utils/firestoreAdmin';

const COLLECTION = 'external_idempotency';
const MAX_DOC_ID_LENGTH = 500;

// In-memory fallback used when Firestore is not configured (local dev / tests)
const memoryStore = new Map<string, string>();

function makeDocId(workspaceId: string, externalEventId: string): string {
  return `${workspaceId}__${externalEventId}`
    .replace(/\//g, '_')
    .slice(0, MAX_DOC_ID_LENGTH);
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

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === 6
    || candidate.code === 'already-exists'
    || String(candidate.message || '').toLowerCase().includes('already exists');
}

export async function claimExternalEventProcessed(
  workspaceId: string,
  externalEventId: string,
): Promise<boolean> {
  const db = await getFirestoreOrNull();
  const processedAt = new Date().toISOString();

  if (!db) {
    logger.warn('[ExternalIdempotency] Firestore unavailable - claiming event in-memory only. Duplicate detection will NOT survive restarts.');
    const key = `${workspaceId}::${externalEventId}`;
    if (memoryStore.has(key)) {
      return false;
    }
    memoryStore.set(key, processedAt);
    return true;
  }

  const docId = makeDocId(workspaceId, externalEventId);
  try {
    await db.collection(COLLECTION).doc(docId).create({
      workspaceId,
      externalEventId,
      processedAt,
    });
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return false;
    }
    throw error;
  }
}

/** Only for use in tests. Clears the in-memory fallback store. */
export function resetExternalIdempotencyStoreForTests(): void {
  memoryStore.clear();
}
