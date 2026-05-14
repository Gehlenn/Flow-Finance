import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  reportError: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../src/config/sentry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/sentry')>();
  return {
    ...actual,
    reportError: sentryMocks.reportError,
  };
});

vi.mock('../../src/utils/logger', () => ({
  logWarn: loggerMocks.logWarn,
  logError: loggerMocks.logError,
}));

describe('client observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports server-side ApiRequestError with request context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        get: (name: string) => (name === 'x-request-id' ? 'req-500' : null),
      },
      json: async () => ({
        message: 'Exploded',
        requestId: 'req-body-500',
        routeScope: 'ai',
        details: { provider: 'gemini' },
      }),
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { apiRequest } = await import('../../src/config/api.config');

    await expect(apiRequest('/api/ai/cfo', { retries: 0 })).rejects.toMatchObject({
      statusCode: 500,
      requestId: 'req-body-500',
      routeScope: 'ai',
    });

    expect(sentryMocks.reportError).toHaveBeenCalledTimes(1);
    const [error, context] = sentryMocks.reportError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(context).toMatchObject({
      endpoint: '/api/ai/cfo',
      statusCode: 500,
      requestId: 'req-body-500',
      routeScope: 'ai',
      provider: 'gemini',
    });
  });

  it('does not report deterministic 4xx errors to Sentry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get: () => null,
      },
      json: async () => ({
        message: 'Missing',
        requestId: 'req-404',
        routeScope: 'workspace',
      }),
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { apiRequest } = await import('../../src/config/api.config');

    await expect(apiRequest('/api/workspace', { retries: 0 })).rejects.toMatchObject({
      statusCode: 404,
      requestId: 'req-404',
      routeScope: 'workspace',
    });

    expect(sentryMocks.reportError).not.toHaveBeenCalled();
  });

  it('auto-recovers workspace context and retries request once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: () => null,
        },
        json: async () => ({
          error: 'WorkspaceId obrigatorio',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        json: async () => ({
          workspaces: [{ workspaceId: 'ws-recovered' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null,
        },
        json: async () => ({
          answer: 'ok' }),
      });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { apiRequest, ACTIVE_WORKSPACE_STORAGE_KEY } = await import('../../src/config/api.config');
    const result = await apiRequest<{ answer: string }>('/api/ai/cfo', { retries: 0 });

    expect(result.answer).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws-recovered');
    expect(sentryMocks.reportError).not.toHaveBeenCalled();
  });

  it('registra aviso quando o payload de erro nao pode ser parseado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: {
        get: () => null,
      },
      json: async () => {
        throw new Error('invalid json');
      },
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { apiRequest } = await import('../../src/config/api.config');

    await expect(apiRequest('/api/ai/cfo', { retries: 0 })).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining('Internal Server Error'),
    });

    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[API] Failed to parse error payload',
      expect.objectContaining({
        endpoint: '/api/ai/cfo',
        status: 500,
        statusText: 'Internal Server Error',
        error: expect.any(Error),
        fallback: 'api-error-payload-parse-failed',
      }),
    );
  });

  it('registra aviso quando a recuperacao de workspace falha', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: () => null,
        },
        json: async () => ({
          error: 'WorkspaceId obrigatorio',
        }),
      })
      .mockRejectedValueOnce(new Error('recovery offline'));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { apiRequest } = await import('../../src/config/api.config');

    await expect(apiRequest('/api/ai/cfo', { retries: 0 })).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[API] Workspace recovery request failed',
      expect.objectContaining({
        endpoint: '/api/ai/cfo',
        error: expect.any(Error),
        fallback: 'workspace-recovery-request-failed',
      }),
    );
  });

  it('uses VITE_APP_VERSION in X-Client-Version header', async () => {
    vi.stubEnv('VITE_APP_VERSION', '9.9.9-test');

    const { getAuthHeaders } = await import('../../src/config/api.config');
    const headers = getAuthHeaders({ includeWorkspace: false });

    expect(headers['X-Client-Version']).toBe('9.9.9-test');
  });

  it('falls back to default client version when VITE_APP_VERSION is empty', async () => {
    vi.stubEnv('VITE_APP_VERSION', '');

    const { getAuthHeaders, CLIENT_APP_VERSION } = await import('../../src/config/api.config');
    const headers = getAuthHeaders({ includeWorkspace: false });

    expect(CLIENT_APP_VERSION).toBe('0.9.6');
    expect(headers['X-Client-Version']).toBe('0.9.6');
  });

  it('keeps initSentry quiet when no DSN is configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');

    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(false);
    initSentry();
    initSentry();
  });

  it('warns and falls back to web platform when Capacitor detection fails', async () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', hostname: 'localhost' },
      Capacitor: {
        isNativePlatform: () => {
          throw new Error('capability check failed');
        },
      },
    } as unknown as Window & typeof globalThis);

    const { getAuthHeaders } = await import('../../src/config/api.config');
    const headers = getAuthHeaders({ includeWorkspace: false });

    expect(headers['X-Client-Platform']).toBe('web');
    expect(loggerMocks.logWarn).toHaveBeenCalledWith(
      '[API] Failed to detect client platform; falling back to web',
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'client-platform-detection-failed',
      }),
    );
  });
});
