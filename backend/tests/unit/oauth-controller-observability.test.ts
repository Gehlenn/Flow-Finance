import { describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  startGoogleOAuth: vi.fn(),
  completeGoogleOAuthCallback: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('../../src/services/auth/googleOAuthService', () => ({
  startGoogleOAuth: controllerMocks.startGoogleOAuth,
  completeGoogleOAuthCallback: controllerMocks.completeGoogleOAuthCallback,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: controllerMocks.loggerError,
    info: controllerMocks.loggerInfo,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { AppError } from '../../src/middleware/errorHandler';
import {
  googleOAuthCallbackController,
  startGoogleOAuthController,
} from '../../src/controllers/oauthController';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('oauthController observability', () => {
  it('registra contexto ao falhar ao iniciar OAuth do Google', async () => {
    controllerMocks.startGoogleOAuth.mockImplementationOnce(() => {
      throw new Error('Invalid OAuth redirect URI');
    });

    const req: any = {
      path: '/api/auth/oauth/google/start',
      query: { redirectUri: 'https://evil.example.com/callback' },
    };
    const res = makeRes();
    const next = vi.fn();

    startGoogleOAuthController(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    const forwardedError = next.mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect(forwardedError.statusCode).toBe(400);
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: 'https://evil.example.com/callback',
        path: '/api/auth/oauth/google/start',
        hasRedirectOverride: true,
        fallback: 'google-oauth-start-failed',
      }),
      'Falha ao iniciar OAuth do Google',
    );
  });

  it('registra contexto ao falhar no callback OAuth do Google', async () => {
    controllerMocks.completeGoogleOAuthCallback.mockRejectedValueOnce(new Error('OAuth callback failed'));

    const req: any = {
      path: '/api/auth/oauth/google/callback',
      query: { code: 'abc123', state: 'oauth-state-1' },
      ip: '127.0.0.1',
    };
    const res = makeRes();
    const next = vi.fn();

    googleOAuthCallbackController(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalled();
    });

    const forwardedError = next.mock.calls[0][0];
    expect(forwardedError).toBeInstanceOf(AppError);
    expect(forwardedError.statusCode).toBe(500);
    expect(controllerMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        codeLength: 6,
        stateLength: 13,
        path: '/api/auth/oauth/google/callback',
        fallback: 'google-oauth-callback-failed',
      }),
      'Falha ao concluir OAuth do Google',
    );
  });
});
