import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockWarn = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mockWarn,
  },
}));

import {
  generateIntegrationKey,
  getIntegrationKeyMeta,
  revokeIntegrationKey,
  verifyIntegrationKey,
  resetIntegrationKeyStoreForTests,
} from '../../src/services/workspaceIntegrationKeyStore';

afterEach(() => {
    resetIntegrationKeyStoreForTests();
    mockWarn.mockClear();
  });

describe('workspaceIntegrationKeyStore', () => {
  it('generates a key with the flw_ prefix', async () => {
    const key = await generateIntegrationKey('ws-1');
    expect(key).toMatch(/^flw_[0-9a-f]{48}$/);
  });

  it('getIntegrationKeyMeta returns null before any key is generated', async () => {
    expect(await getIntegrationKeyMeta('ws-unknown')).toBeNull();
  });

  it('getIntegrationKeyMeta returns metadata after generation', async () => {
    await generateIntegrationKey('ws-1');
    const meta = await getIntegrationKeyMeta('ws-1');
    expect(meta).not.toBeNull();
    expect(meta!.keyPrefix).toMatch(/^flw_/);
    expect(typeof meta!.createdAt).toBe('string');
  });

  it('verifyIntegrationKey returns true for the correct plaintext key', async () => {
    const key = await generateIntegrationKey('ws-1');
    expect(await verifyIntegrationKey('ws-1', key)).toBe(true);
  });

  it('verifyIntegrationKey returns false for a wrong key', async () => {
    await generateIntegrationKey('ws-1');
    expect(await verifyIntegrationKey('ws-1', 'flw_wrongkey')).toBe(false);
  });

  it('verifyIntegrationKey returns false for a different workspace', async () => {
    const key = await generateIntegrationKey('ws-A');
    expect(await verifyIntegrationKey('ws-B', key)).toBe(false);
  });

  it('revokeIntegrationKey removes the key', async () => {
    await generateIntegrationKey('ws-1');
    await revokeIntegrationKey('ws-1');
    expect(await getIntegrationKeyMeta('ws-1')).toBeNull();
    expect(await verifyIntegrationKey('ws-1', 'any')).toBe(false);
  });

  it('generateIntegrationKey rotates the key (old plaintext no longer valid)', async () => {
    const oldKey = await generateIntegrationKey('ws-1');
    await generateIntegrationKey('ws-1');
    expect(await verifyIntegrationKey('ws-1', oldKey)).toBe(false);
  });

  it('registra aviso quando a comparacao segura falha e rejeita a chave', async () => {
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual').mockImplementation(() => {
      throw new Error('timing-safe failure');
    });

    await generateIntegrationKey('ws-1');

    await expect(verifyIntegrationKey('ws-1', 'flw_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).resolves.toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        providedLength: expect.any(Number),
        storedLength: expect.any(Number),
        fallback: 'workspace-integration-key-compare-failed',
      }),
      '[workspaceIntegrationKeyStore] timingSafeEqual failed; rejecting key comparison',
    );

    timingSafeEqualSpy.mockRestore();
  });

  it('does not leak keys across workspaces after reset', async () => {
    await generateIntegrationKey('ws-1');
    resetIntegrationKeyStoreForTests();
    expect(await getIntegrationKeyMeta('ws-1')).toBeNull();
  });
});
