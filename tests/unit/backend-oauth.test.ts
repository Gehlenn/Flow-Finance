import { beforeEach, describe, expect, it, vi } from 'vitest';

import { googleOAuthCallbackController, startGoogleOAuthController } from '../../backend/src/controllers/oauthController';
import { resetOAuthStateStoreForTests } from '../../backend/src/services/auth/oauthStateStore';
import { resetRefreshStoreForTests } from '../../backend/src/services/auth/refreshTokenStore';

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
