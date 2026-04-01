import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { googleOAuthCallbackController, startGoogleOAuthController } from '../../backend/src/controllers/oauthController';
import { resetOAuthStateStoreForTests } from '../../backend/src/services/auth/oauthStateStore';
import { resetRefreshStoreForTests } from '../../backend/src/services/auth/refreshTokenStore';
import env from '../../backend/src/config/env';

vi.mock('../../backend/src/config/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockRequest(query: Record<string, unknown> = {}) {
  return {
    query,
    body: {},
    headers: {},
  };
}

function createMockResponse() {
  return {
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  };
}

async function flushAsyncHandler() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('OAuth Controller (Google scaffold)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOAuthStateStoreForTests();
    resetRefreshStoreForTests();
  });

  it('startGoogleOAuthController retorna authUrl, state e expiresIn', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    startGoogleOAuthController(req as any, res as any, vi.fn());
    await flushAsyncHandler();

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.provider).toBe('google');
    expect(typeof payload.state).toBe('string');
    expect(payload.state.length).toBeGreaterThan(10);
    expect(typeof payload.authUrl).toBe('string');
    expect(payload.expiresIn).toBeGreaterThan(0);
  });

  it('callback retorna tokens e user quando code/state válidos', async () => {
    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();

    const started = startRes.json.mock.calls[0][0];
    const callbackReq = createMockRequest({
      code: 'mock_code_123',
      state: started.state,
    });
    const callbackRes = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(callbackReq as any, callbackRes as any, next);
    await flushAsyncHandler();

    expect(next).not.toHaveBeenCalled();
    expect(callbackRes.json).toHaveBeenCalled();

    const payload = callbackRes.json.mock.calls[0][0];
    expect(payload.accessToken).toBeTruthy();
    expect(payload.refreshToken).toBeTruthy();
    expect(payload.user).toBeDefined();
    expect(payload.user.email).toContain('@');
    expect(payload.oauth.provider).toBe('google');
  });

  it('callback falha com 400 quando falta code', async () => {
    const req = createMockRequest({ state: 'x' });
    const res = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(req as any, res as any, next);
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });

  it('callback falha com 401 para state inválido', async () => {
    const req = createMockRequest({ code: 'mock_code_123', state: 'state-invalido' });
    const res = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(req as any, res as any, next);
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  it('state é single-use (segundo callback com mesmo state falha)', async () => {
    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();

    const state = startRes.json.mock.calls[0][0].state;

    const firstReq = createMockRequest({ code: 'mock_code_first', state });
    const firstRes = createMockResponse();
    const firstNext = vi.fn();
    googleOAuthCallbackController(firstReq as any, firstRes as any, firstNext);
    await flushAsyncHandler();
    expect(firstNext).not.toHaveBeenCalled();

    const secondReq = createMockRequest({ code: 'mock_code_second', state });
    const secondRes = createMockResponse();
    const secondNext = vi.fn();
    googleOAuthCallbackController(secondReq as any, secondRes as any, secondNext);
    await flushAsyncHandler();

    expect(secondNext).toHaveBeenCalled();
    const err = secondNext.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});

// ─── Testes de troca real com Google (fetch mockado) ─────────────────────────

describe('OAuth Google — troca real de código (C2.1)', () => {
  let originalClientId: string;
  let originalClientSecret: string;
  let originalMockMode: string;
  let originalNodeEnv: string;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOAuthStateStoreForTests();
    resetRefreshStoreForTests();

    // Salvar valores originais e sobrescrever para modo não-mock
    originalClientId = env.GOOGLE_OAUTH_CLIENT_ID;
    originalClientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
    originalMockMode = env.OAUTH_MOCK_MODE;
    originalNodeEnv = env.NODE_ENV;

    env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
    env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    env.OAUTH_MOCK_MODE = 'false';
    env.NODE_ENV = 'production';
  });

  afterEach(() => {
    env.GOOGLE_OAUTH_CLIENT_ID = originalClientId;
    env.GOOGLE_OAUTH_CLIENT_SECRET = originalClientSecret;
    env.OAUTH_MOCK_MODE = originalMockMode;
    env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('troca real: fetch chamado para token endpoint e userinfo', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'goog_access_token_xyz',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'google_uid_123',
          email: 'usuario@gmail.com',
          name: 'Usuário Teste',
          picture: 'https://lh3.googleusercontent.com/foto.jpg',
        }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    // Obtém state via start (startGoogleOAuth terá GOOGLE_OAUTH_CLIENT_ID preenchido)
    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();
    const state = startRes.json.mock.calls[0][0].state;

    const callbackReq = createMockRequest({ code: 'real_code_abc', state });
    const callbackRes = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(callbackReq as any, callbackRes as any, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Primeira chamada: token endpoint
    const [tokenUrl, tokenOpts] = mockFetch.mock.calls[0];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(tokenOpts.method).toBe('POST');

    // Segunda chamada: userinfo
    const [userInfoUrl] = mockFetch.mock.calls[1];
    expect(userInfoUrl).toBe('https://www.googleapis.com/oauth2/v2/userinfo');

    // Resposta do controller deve ter o perfil real
    const payload = callbackRes.json.mock.calls[0][0];
    expect(payload.user.userId).toBe('google_uid_123');
    expect(payload.user.email).toBe('usuario@gmail.com');
    expect(payload.user.name).toBe('Usuário Teste');
    expect(payload.accessToken).toBeTruthy();
    expect(payload.refreshToken).toBeTruthy();
  });

  it('troca real: erro no token endpoint propaga como 500', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      }),
    } as Response);

    vi.stubGlobal('fetch', mockFetch);

    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();
    const state = startRes.json.mock.calls[0][0].state;

    const callbackReq = createMockRequest({ code: 'expired_code', state });
    const callbackRes = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(callbackReq as any, callbackRes as any, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(err.message).toContain('Authorization code expired');
  });

  it('troca real: erro no userinfo propaga como 500', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'valid_access', token_type: 'Bearer' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid Credentials' } }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();
    const state = startRes.json.mock.calls[0][0].state;

    const callbackReq = createMockRequest({ code: 'valid_code', state });
    const callbackRes = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(callbackReq as any, callbackRes as any, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
  });

  it('troca real: body inclui client_id, client_secret, redirect_uri e code', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', token_type: 'Bearer' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'uid_check',
          email: 'check@gmail.com',
          name: 'Check User',
        }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    const startReq = createMockRequest();
    const startRes = createMockResponse();
    startGoogleOAuthController(startReq as any, startRes as any, vi.fn());
    await flushAsyncHandler();
    const state = startRes.json.mock.calls[0][0].state;

    const callbackReq = createMockRequest({ code: 'code-to-check', state });
    googleOAuthCallbackController(callbackReq as any, createMockResponse() as any, vi.fn());
    await new Promise((r) => setTimeout(r, 10));

    const bodyStr = mockFetch.mock.calls[0][1].body as string;
    const params = new URLSearchParams(bodyStr);
    expect(params.get('code')).toBe('code-to-check');
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('client_secret')).toBe('test-client-secret');
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('redirect_uri')).toBeTruthy();
  });
});
