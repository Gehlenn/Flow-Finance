import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapBackendSessionFromFirebase } from '../../src/services/backendSession';

const loggerMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: loggerMocks.logWarn,
}));

describe('bootstrapBackendSessionFromFirebase', () => {
  afterEach(() => {
    vi.clearAllMocks();
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

  it('falha com mensagem explicita quando o backend retorna JSON invalido na troca firebase', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(
      bootstrapBackendSessionFromFirebase({
        idToken: 'firebase-id-token',
        userId: 'u1',
        email: 'u1@test.dev',
        isDevelopment: false,
      }),
    ).rejects.toThrow(/Invalid session payload returned by backend/i);

    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[BackendSession] Firebase session exchange returned invalid JSON',
      expect.objectContaining({
        status: 200,
        error: expect.any(Error),
        fallback: 'backend-session-firebase-json-invalid',
      }),
    );
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
