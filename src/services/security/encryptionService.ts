/**
 * ENCRYPTION SERVICE — Secure localStorage encryption
 *
 * Uses Web Crypto API to encrypt sensitive financial data before storage.
 * The encryption key is kept only in memory for the current runtime session.
 *
 * WARNING: This is defense in depth for local persistence, not protection against an active XSS.
 * Always use HTTPS in production and avoid storing secrets in browser storage.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'flow_encrypted_';
const ENCRYPTION_VERSION = '1';
const ALGORITHM = {
  name: 'AES-GCM',
  length: 256,
};
const HASH_ALGORITHM = 'SHA-256';

// ─── Encryption Key Management ────────────────────────────────────────────────

let cachedKey: CryptoKey | null = null;

/**
 * Derives an encryption key from user password or app secret.
 * For production, use deviceId + userId + server salt.
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  // Return cached key if available
  if (cachedKey) return cachedKey;

  cachedKey = await crypto.subtle.generateKey(ALGORITHM, true, ['encrypt', 'decrypt']);
  return cachedKey;
}

// ─── Encryption / Decryption ──────────────────────────────────────────────────

export async function encryptData<T>(data: T): Promise<string> {
  try {
    const key = await getOrCreateEncryptionKey();

    // Serialize data
    const serialized = JSON.stringify(data);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(ALGORITHM, key, new TextEncoder().encode(serialized));

    // Combine IV + encrypted data + version
    const combined = new Uint8Array(iv.length + encrypted.byteLength + 1);
    combined[0] = parseInt(ENCRYPTION_VERSION);
    combined.set(iv, 1);
    combined.set(new Uint8Array(encrypted), iv.length + 1);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Encryption] Failed to encrypt data:', error);
    throw error;
  }
}

export async function decryptData<T>(encrypted: string): Promise<T | null> {
  try {
    const key = await getOrCreateEncryptionKey();

    // Decode from base64
    const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));

    // Extract version, IV, and encrypted data
    const version = combined[0];
    if (version !== parseInt(ENCRYPTION_VERSION)) {
      console.warn('[Encryption] Unsupported encryption version:', version);
      return null;
    }

    const iv = combined.slice(1, 13);
    const encryptedData = combined.slice(13);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(ALGORITHM, key, encryptedData);

    // Deserialize
    const serialized = new TextDecoder().decode(decrypted);
    return JSON.parse(serialized);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt data:', error);
    return null;
  }
}

// ─── Storage Wrappers ─────────────────────────────────────────────────────────

/**
 * Store encrypted data in localStorage
 */
export async function setEncryptedLocalStorage<T>(key: string, value: T): Promise<void> {
  try {
    const encrypted = await encryptData(value);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, encrypted);
  } catch (error) {
    console.error(`[Encryption] Failed to store encrypted data for key "${key}":`, error);
    // Fallback to unencrypted (for development only)
    if (import.meta.env.MODE === 'development') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

/**
 * Retrieve encrypted data from localStorage
 */
export async function getEncryptedLocalStorage<T>(key: string): Promise<T | null> {
  try {
    const encrypted = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    if (!encrypted) return null;

    return await decryptData<T>(encrypted);
  } catch (error) {
    console.error(`[Encryption] Failed to retrieve encrypted data for key "${key}":`, error);
    return null;
  }
}

/**
 * Remove encrypted data from localStorage
 */
export function removeEncryptedLocalStorage(key: string): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
}

/**
 * Clear all encrypted data from localStorage
 */
export function clearEncryptedLocalStorage(): void {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

// ─── Utility: Check if data needs encryption ──────────────────────────────────

export const SENSITIVE_KEYS = [
  'flow_user',
  'flow_transactions',
  'flow_accounts',
  'flow_financial_goals',
  'flow_ai_memory',
  'flow_financial_events',
  'flow_sync_status',
  'flow_settings',
];

export function isSensitiveData(key: string): boolean {
  return SENSITIVE_KEYS.some(k => key.includes(k));
}
