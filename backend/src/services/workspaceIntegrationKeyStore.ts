import crypto from 'crypto';
import { getFirestoreOrNull } from '../utils/firestoreAdmin';

const KEY_PREFIX = 'flw_';
const KEY_RANDOM_BYTES = 24; // 48 hex chars

// In-memory fallback: workspaceId -> { keyHash, keyPrefix, createdAt }
interface KeyMeta { keyHash: string; keyPrefix: string; createdAt: string; }
const memoryStore = new Map<string, KeyMeta>();

const COLLECTION = 'workspace_integration_keys';

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/**
 * Generates a new integration key for the workspace.
 * Returns the plaintext key — shown only once. Stores only the hash.
 */
export async function generateIntegrationKey(workspaceId: string): Promise<string> {
  const random = crypto.randomBytes(KEY_RANDOM_BYTES).toString('hex');
  const plaintext = `${KEY_PREFIX}${random}`;
  const keyHash = hashKey(plaintext);
  const keyPrefix = plaintext.slice(0, KEY_PREFIX.length + 6);
  const createdAt = new Date().toISOString();

  const db = await getFirestoreOrNull();
  if (db) {
    await db.collection(COLLECTION).doc(workspaceId).set({ workspaceId, keyHash, keyPrefix, createdAt });
  } else {
    memoryStore.set(workspaceId, { keyHash, keyPrefix, createdAt });
  }

  return plaintext;
}

/**
 * Returns display metadata (prefix + createdAt) for the workspace key, or null if not set.
 */
export async function getIntegrationKeyMeta(
  workspaceId: string,
): Promise<{ keyPrefix: string; createdAt: string } | null> {
  const db = await getFirestoreOrNull();
  if (db) {
    const doc = await db.collection(COLLECTION).doc(workspaceId).get();
    if (!doc.exists) return null;
    const data = doc.data() as KeyMeta;
    return { keyPrefix: data.keyPrefix, createdAt: data.createdAt };
  }
  const entry = memoryStore.get(workspaceId);
  if (!entry) return null;
  return { keyPrefix: entry.keyPrefix, createdAt: entry.createdAt };
}

/**
 * Verifies a provided plaintext key against the stored hash for the workspace.
 */
export async function verifyIntegrationKey(workspaceId: string, providedKey: string): Promise<boolean> {
  const db = await getFirestoreOrNull();
  let storedHash: string | null = null;

  if (db) {
    const doc = await db.collection(COLLECTION).doc(workspaceId).get();
    if (!doc.exists) return false;
    storedHash = (doc.data() as KeyMeta).keyHash;
  } else {
    storedHash = memoryStore.get(workspaceId)?.keyHash ?? null;
  }

  if (!storedHash) return false;
  return safeCompare(hashKey(providedKey), storedHash);
}

/**
 * Deletes the integration key for the workspace.
 */
export async function revokeIntegrationKey(workspaceId: string): Promise<void> {
  const db = await getFirestoreOrNull();
  if (db) {
    await db.collection(COLLECTION).doc(workspaceId).delete();
  } else {
    memoryStore.delete(workspaceId);
  }
}

/** Test helper only. */
export function resetIntegrationKeyStoreForTests(): void {
  memoryStore.clear();
}
