import { API_ENDPOINTS } from '../config/api.config';
import { setEphemeralAccessToken } from './authSessionStore';
import { logWarn } from '../utils/logger';

interface FirebaseSessionBootstrapInput {
  idToken: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  isDevelopment?: boolean;
  allowLegacyDevelopmentFallback?: boolean;
}

interface BackendSessionPayload {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    userId?: string;
    email?: string;
    name?: string;
  };
}

interface PasswordSessionBootstrapInput {
  email: string;
  password: string;
  userId?: string | null;
  name?: string | null;
}

async function parseJsonSafely(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    logWarn('[BackendSession] Failed to parse JSON response; falling back to empty payload', {
      status: response.status,
      error,
      fallback: 'backend-session-parse-json-failed',
    });
    return {};
  }
}

export function deriveDevelopmentUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const safeSlug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return safeSlug ? `local-${safeSlug}` : 'local-user';
}

export async function bootstrapBackendSessionWithPasswordLogin(
  input: PasswordSessionBootstrapInput,
): Promise<BackendSessionPayload> {
  const fallbackResponse = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      userId: input.userId,
      name: input.name,
    }),
  });

  if (!fallbackResponse.ok) {
    const errorPayload = await parseJsonSafely(fallbackResponse);
    throw new Error(String(errorPayload.message || 'Failed to bootstrap backend session'));
  }

  const payload = await fallbackResponse.json() as BackendSessionPayload;
  setEphemeralAccessToken(payload.accessToken || payload.token || null);
  return payload;
}

export async function bootstrapBackendSessionFromFirebase(
  input: FirebaseSessionBootstrapInput,
): Promise<BackendSessionPayload> {
  const firebaseResponse = await fetch(API_ENDPOINTS.AUTH.FIREBASE_SESSION, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: input.idToken }),
  });

  if (firebaseResponse.ok) {
    let payload: BackendSessionPayload;
    try {
      payload = await firebaseResponse.json() as BackendSessionPayload;
    } catch (error) {
      logWarn('[BackendSession] Firebase session exchange returned invalid JSON', {
        status: firebaseResponse.status,
        error,
        fallback: 'backend-session-firebase-json-invalid',
      });
      throw new Error('Invalid session payload returned by backend');
    }
    setEphemeralAccessToken(payload.accessToken || payload.token || null);
    return payload;
  }

  if (!input.isDevelopment || input.allowLegacyDevelopmentFallback !== true) {
    const errorPayload = await parseJsonSafely(firebaseResponse);
    throw new Error(String(errorPayload.message || 'Failed to exchange Firebase session'));
  }

  return bootstrapBackendSessionWithPasswordLogin({
    email: input.email || '',
    password: 'firebase-session',
    userId: input.userId,
    name: input.name,
  });
}
