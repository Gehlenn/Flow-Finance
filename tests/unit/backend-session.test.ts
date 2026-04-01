import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapBackendSessionFromFirebase } from '../../src/services/backendSession';

describe('bootstrapBackendSessionFromFirebase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa a troca segura via endpoint firebase quando disponivel', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-secure' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const payload = await bootstrapBackendSessionFromFirebase({
      idToken: 'firebase-id-token',
      userId: 'u1',
      email: 'u1@test.dev',
      isDevelopment: false,
    });

    expect(payload.token).toBe('jwt-secure');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('faz fallback para login legado apenas em desenvolvimento', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'not-configured' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-dev-fallback' }),
      });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const payload = await bootstrapBackendSessionFromFirebase({
      idToken: 'firebase-id-token',
      userId: 'u1',
      email: 'u1@test.dev',
      isDevelopment: true,
      allowLegacyDevelopmentFallback: true,
    });

    expect(payload.token).toBe('jwt-dev-fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não faz fallback legado sem opt-in explícito', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'not-configured' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(
      bootstrapBackendSessionFromFirebase({
        idToken: 'firebase-id-token',
        userId: 'u1',
        email: 'u1@test.dev',
        isDevelopment: true,
      }),
    ).rejects.toThrow(/not-configured/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
