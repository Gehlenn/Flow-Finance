import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../backend/src/config/env', () => ({
  default: {
    GOOGLE_OAUTH_CLIENT_ID: '',
    GOOGLE_OAUTH_CLIENT_SECRET: '',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost/callback',
    OAUTH_MOCK_MODE: 'true',
    OAUTH_STATE_TTL_SECONDS: '600',
    NODE_ENV: 'test',
  },
}));

import {
  completeGoogleOAuthCallback,
  startGoogleOAuth,
} from '../../backend/src/services/auth/googleOAuthService';
import { resetOAuthStateStoreForTests } from '../../backend/src/services/auth/oauthStateStore';

describe('googleOAuthService', () => {
  beforeEach(() => {
    resetOAuthStateStoreForTests();
  });

  it('gera URL de autenticacao e estado em mock mode', () => {
    const result = startGoogleOAuth();
    expect(result.provider).toBe('google');
    expect(result.authUrl).toContain('mock_code');
    expect(result.state).toBeDefined();
    expect(result.mockMode).toBe(true);
  });

  it('retorna perfil mock ao completar callback em mock mode', async () => {
    const started = startGoogleOAuth();
    const result = await completeGoogleOAuthCallback({ code: 'mock_code', state: started.state });
    expect(result.provider).toBe('google');
    expect(result.email).toContain('@flowfinance.test');
  });
});
