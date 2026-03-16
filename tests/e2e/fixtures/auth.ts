/**
 * E2E Auth Fixture
 *
 * Provides a stable backend auth context for Playwright tests.
 * Uses E2E_PLUGGY_USER_EMAIL / E2E_PLUGGY_USER_PASSWORD environment variables
 * when available; falls back to a deterministic test email so that the same
 * user identity is reused across the entire test run instead of creating a
 * new dynamic email per test (which caused intermittent 'invalid' skips – B010).
 *
 * Because the backend auth accepts any valid email/password in MVP mode,
 * a stable fixture email always produces a valid JWT when the backend is up.
 */

import { APIRequestContext } from '@playwright/test';

const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_URL || 'http://localhost:3001';

export const E2E_FIXTURE_EMAIL =
  process.env.E2E_PLUGGY_USER_EMAIL || 'e2e-pluggy-fixture@flowfinance.test';

export const E2E_FIXTURE_PASSWORD =
  process.env.E2E_PLUGGY_USER_PASSWORD || 'e2e-fixture-password';

export interface BackendAuthContext {
  token: string;
  userId: string;
}

export type BackendAuthResult =
  | { status: 'ok'; context: BackendAuthContext }
  | { status: 'unavailable'; message: string }
  | { status: 'invalid'; message: string };

/**
 * Obtains a backend JWT using the stable fixture credentials.
 * Replaces the per-test dynamic-email approach to avoid B010 reliability issues.
 */
export async function getFixtureAuthToken(
  request: APIRequestContext
): Promise<BackendAuthResult> {
  let response;

  try {
    response = await request.post(`${BACKEND_BASE_URL}/api/auth/login`, {
      data: { email: E2E_FIXTURE_EMAIL, password: E2E_FIXTURE_PASSWORD },
      timeout: 5000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    return { status: 'unavailable', message };
  }

  if (!response.ok()) {
    return { status: 'invalid', message: `login status ${response.status()}` };
  }

  const payload = await response.json() as { token?: string; user?: { userId?: string } };
  if (!payload.token || !payload.user?.userId) {
    return { status: 'invalid', message: 'resposta de login sem token/userId' };
  }

  return {
    status: 'ok',
    context: {
      token: payload.token,
      userId: payload.user.userId,
    },
  };
}
