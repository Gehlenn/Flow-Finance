import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('googleOAuthService redirect allowlist', () => {
  const originalEnv = {
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS: process.env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS,
    OAUTH_MOCK_MODE: process.env.OAUTH_MOCK_MODE,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://flow.example.com/api/auth/oauth/google/callback';
    process.env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS = [
      'https://flow.example.com/api/auth/oauth/google/callback',
      'https://app.flow.example.com/auth/google/callback',
    ].join(',');
    process.env.OAUTH_MOCK_MODE = 'true';
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  });

  afterEach(() => {
    vi.resetModules();

    if (originalEnv.GOOGLE_OAUTH_REDIRECT_URI === undefined) {
      delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    } else {
      process.env.GOOGLE_OAUTH_REDIRECT_URI = originalEnv.GOOGLE_OAUTH_REDIRECT_URI;
    }

    if (originalEnv.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS === undefined) {
      delete process.env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS;
    } else {
      process.env.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS = originalEnv.GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS;
    }

    if (originalEnv.OAUTH_MOCK_MODE === undefined) {
      delete process.env.OAUTH_MOCK_MODE;
    } else {
      process.env.OAUTH_MOCK_MODE = originalEnv.OAUTH_MOCK_MODE;
    }

    if (originalEnv.GOOGLE_OAUTH_CLIENT_ID === undefined) {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.GOOGLE_OAUTH_CLIENT_ID = originalEnv.GOOGLE_OAUTH_CLIENT_ID;
    }
  });

  it('rejeita redirectUri fora da allowlist', async () => {
    const { startGoogleOAuth } = await import('../../src/services/auth/googleOAuthService');

    expect(() => startGoogleOAuth('https://evil.example.com/callback')).toThrow('Invalid OAuth redirect URI');
  });

  it('aceita redirectUri explicitamente permitido', async () => {
    const { startGoogleOAuth } = await import('../../src/services/auth/googleOAuthService');

    const result = startGoogleOAuth('https://app.flow.example.com/auth/google/callback');

    expect(result.mockMode).toBe(true);
    expect(result.authUrl.startsWith('https://app.flow.example.com/auth/google/callback')).toBe(true);
  });
});
