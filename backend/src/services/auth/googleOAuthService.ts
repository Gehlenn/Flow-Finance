import env from '../../config/env';
import { consumeOAuthState, issueOAuthState } from './oauthStateStore';

export interface GoogleOAuthStartResult {
  provider: 'google';
  authUrl: string;
  state: string;
  expiresIn: number;
  mockMode: boolean;
}

export interface GoogleOAuthProfile {
  provider: 'google';
  providerUserId: string;
  email: string;
  name: string;
  picture?: string;
}

function isMockModeEnabled(): boolean {
  if (env.OAUTH_MOCK_MODE === 'true') return true;
  if (env.OAUTH_MOCK_MODE === 'false') return false;
  return env.NODE_ENV !== 'production';
}

function getConfiguredRedirectUri(override?: string): string {
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  return env.GOOGLE_OAUTH_REDIRECT_URI || '';
}

function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function startGoogleOAuth(redirectUriOverride?: string): GoogleOAuthStartResult {
  const redirectUri = getConfiguredRedirectUri(redirectUriOverride);
  const mockMode = isMockModeEnabled();

  if (!redirectUri) {
    throw new Error('Missing GOOGLE_OAUTH_REDIRECT_URI configuration');
  }

  const { state, expiresIn } = issueOAuthState('google', redirectUri);

  if (!env.GOOGLE_OAUTH_CLIENT_ID && mockMode) {
    const mockUrl = `${redirectUri}?code=mock_code&state=${state}`;
    return {
      provider: 'google',
      authUrl: mockUrl,
      state,
      expiresIn,
      mockMode: true,
    };
  }

  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('Missing GOOGLE_OAUTH_CLIENT_ID configuration');
  }

  return {
    provider: 'google',
    authUrl: buildGoogleAuthUrl(state, redirectUri),
    state,
    expiresIn,
    mockMode,
  };
}

function mockProfileFromCode(code: string): GoogleOAuthProfile {
  const suffix = code.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'oauthuser';
  return {
    provider: 'google',
    providerUserId: `google_${suffix}`,
    email: `google-${suffix.toLowerCase()}@flowfinance.test`,
    name: `Google User ${suffix}`,
    picture: 'https://example.com/mock-google-avatar.png',
  };
}

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  id: string;
  email: string;
  name: string;
  picture?: string;
  error?: { message: string };
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Google token exchange failed: ${data.error_description || data.error || response.statusText}`,
    );
  }

  return data;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfoResponse> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = (await response.json()) as GoogleUserInfoResponse;

  if (!response.ok || data.error) {
    throw new Error(
      `Google userinfo fetch failed: ${JSON.stringify(data.error)}`,
    );
  }

  return data;
}

export async function completeGoogleOAuthCallback(params: {
  code: string;
  state: string;
}): Promise<GoogleOAuthProfile> {
  const { code, state } = params;

  const consumed = consumeOAuthState(state, 'google');
  if (!consumed) {
    throw new Error('Invalid or expired OAuth state');
  }

  const mockMode = isMockModeEnabled();
  if (mockMode) {
    return mockProfileFromCode(code);
  }

  const redirectUri = getConfiguredRedirectUri();
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const userInfo = await fetchGoogleUserInfo(tokens.access_token);

  return {
    provider: 'google',
    providerUserId: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
  };
}
