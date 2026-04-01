import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleOAuthCallbackController, startGoogleOAuthController } from '../../backend/src/controllers/oauthController';
import { resetRefreshStoreForTests } from '../../backend/src/services/auth/refreshTokenStore';

const stateStore = new Set<string>();

vi.mock('../../backend/src/services/auth/googleOAuthService', () => ({
  startGoogleOAuth: vi.fn(() => {
    const state = `mock-state-${Math.random().toString(36).slice(2)}`;
    stateStore.add(state);
    return {
      provider: 'google',
      authUrl: 'https://mock-auth-url',
      state,
      expiresIn: 3600,
      mockMode: true,
    };
  }),
  completeGoogleOAuthCallback: vi.fn(async ({ state }: { state: string }) => {
    if (!stateStore.has(state)) {
      throw new Error('Invalid or expired OAuth state');
    }

    stateStore.delete(state);
    return {
      provider: 'google',
      providerUserId: 'mock-user-id',
      email: 'mock@flow.com',
      name: 'Mock User',
      picture: 'https://mock.com/avatar.png',
    };
  }),
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

describe('OAuth Controller', () => {
  beforeEach(() => {
    stateStore.clear();
    resetRefreshStoreForTests();
    vi.clearAllMocks();
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
    expect(payload.authUrl).toBe('https://mock-auth-url');
    expect(payload.expiresIn).toBe(3600);
  });

  it('callback retorna tokens e user quando code/state validos', async () => {
    const startRes = createMockResponse();
    startGoogleOAuthController(createMockRequest() as any, startRes as any, vi.fn());
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
    expect(payload.user.email).toBe('mock@flow.com');
    expect(payload.oauth.provider).toBe('google');
  });

  it('callback falha com 400 quando falta code', async () => {
    const res = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(createMockRequest({ state: 'x' }) as any, res as any, next);
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('callback falha com 401 para state invalido', async () => {
    const res = createMockResponse();
    const next = vi.fn();

    googleOAuthCallbackController(createMockRequest({ code: 'mock_code_123', state: 'state-invalido' }) as any, res as any, next);
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('state e single-use', async () => {
    const startRes = createMockResponse();
    startGoogleOAuthController(createMockRequest() as any, startRes as any, vi.fn());
    await flushAsyncHandler();

    const { state } = startRes.json.mock.calls[0][0];

    const firstNext = vi.fn();
    googleOAuthCallbackController(createMockRequest({ code: 'first', state }) as any, createMockResponse() as any, firstNext);
    await flushAsyncHandler();
    expect(firstNext).not.toHaveBeenCalled();

    const secondNext = vi.fn();
    googleOAuthCallbackController(createMockRequest({ code: 'second', state }) as any, createMockResponse() as any, secondNext);
    await flushAsyncHandler();
    expect(secondNext).toHaveBeenCalled();
    expect(secondNext.mock.calls[0][0].statusCode).toBe(401);
  });
});
