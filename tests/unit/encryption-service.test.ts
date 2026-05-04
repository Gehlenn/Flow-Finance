import { beforeEach, describe, expect, it, vi } from 'vitest';

type EncryptCall = {
  algorithm: AesGcmParams;
  data: Uint8Array;
};

function decodeBase64(input: string): Uint8Array {
  return Uint8Array.from(atob(input), (char) => char.charCodeAt(0));
}

describe('encryption service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts payloads with a real IV in the envelope', async () => {
    const encryptCalls: EncryptCall[] = [];
    const decryptCalls: EncryptCall[] = [];

    const mockCrypto = {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        bytes.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        return array;
      },
      subtle: {
        generateKey: vi.fn().mockResolvedValue({} as CryptoKey),
        encrypt: vi.fn(async (algorithm: AesGcmParams, _key: CryptoKey, data: BufferSource) => {
          encryptCalls.push({ algorithm, data: new Uint8Array(data as ArrayBufferLike) });
          return new TextEncoder().encode('ciphertext').buffer;
        }),
        decrypt: vi.fn(async (algorithm: AesGcmParams, _key: CryptoKey, data: BufferSource) => {
          decryptCalls.push({ algorithm, data: new Uint8Array(data as ArrayBufferLike) });
          return new TextEncoder().encode(JSON.stringify({ ok: true })).buffer;
        }),
      },
    } as unknown as Crypto;

    vi.stubGlobal('crypto', mockCrypto);

    const { encryptData, decryptData } = await import('../../src/services/security/encryptionService');

    const encrypted = await encryptData({ account: 'main', amount: 42 });
    const payload = decodeBase64(encrypted);

    expect(payload[0]).toBe(1);
    expect(Array.from(payload.slice(1, 13))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(encryptCalls).toHaveLength(1);
    expect(encryptCalls[0].algorithm).toMatchObject({ name: 'AES-GCM' });
    expect(encryptCalls[0].algorithm.iv).toBeInstanceOf(Uint8Array);
    expect(Array.from(encryptCalls[0].algorithm.iv as Uint8Array)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const decrypted = await decryptData<{ ok: boolean }>(encrypted);
    expect(decrypted).toEqual({ ok: true });
    expect(decryptCalls).toHaveLength(1);
    expect(decryptCalls[0].algorithm).toMatchObject({ name: 'AES-GCM' });
    expect(Array.from(decryptCalls[0].algorithm.iv as Uint8Array)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('returns null for invalid encrypted payloads', async () => {
    const mockCrypto = {
      getRandomValues: vi.fn(),
      subtle: {
        generateKey: vi.fn().mockResolvedValue({} as CryptoKey),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
      },
    } as unknown as Crypto;

    vi.stubGlobal('crypto', mockCrypto);

    const { decryptData } = await import('../../src/services/security/encryptionService');

    await expect(decryptData('not-base64')).resolves.toBeNull();
  });

  it('falls back to plain JSON in development when encryption fails', async () => {
    vi.stubEnv('MODE', 'development');

    const mockCrypto = {
      getRandomValues: vi.fn(),
      subtle: {
        generateKey: vi.fn().mockResolvedValue({} as CryptoKey),
        encrypt: vi.fn().mockRejectedValue(new Error('crypto unavailable')),
        decrypt: vi.fn(),
      },
    } as unknown as Crypto;

    vi.stubGlobal('crypto', mockCrypto);

    const { setEncryptedLocalStorage, getEncryptedLocalStorage } = await import('../../src/services/security/encryptionService');

    await setEncryptedLocalStorage('settings', { theme: 'dark', pin: 1234 });

    expect(localStorage.getItem('flow_encrypted_settings')).toBe(JSON.stringify({ theme: 'dark', pin: 1234 }));

    await expect(getEncryptedLocalStorage<{ theme: string; pin: number }>('settings')).resolves.toEqual({
      theme: 'dark',
      pin: 1234,
    });
  });
});
