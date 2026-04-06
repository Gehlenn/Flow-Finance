import { API_ENDPOINTS } from '../config/api.config';
import { setEphemeralAccessToken } from './authSessionStore';

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
}

async function parseJsonSafely(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
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
    const payload = await firebaseResponse.json() as BackendSessionPayload;
    setEphemeralAccessToken(payload.accessToken || payload.token || null);
    return payload;
  }

  if (!input.isDevelopment || input.allowLegacyDevelopmentFallback !== true) {
    const errorPayload = await parseJsonSafely(firebaseResponse);
    throw new Error(String(errorPayload.message || 'Failed to exchange Firebase session'));
  }

  const fallbackResponse = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: 'firebase-session',
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
