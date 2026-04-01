import crypto from 'crypto';

import env from '../../config/env';

interface OAuthStateRecord {
  provider: 'google';
  createdAt: number;
  expiresAt: number;
  redirectUri?: string;
}

const oauthStateStore = new Map<string, OAuthStateRecord>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getStateTtlSeconds(): number {
  const configured = Number(env.OAUTH_STATE_TTL_SECONDS || 600);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 600;
  }
  return Math.floor(configured);
}

function makeStateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function cleanupExpiredState(): void {
  const now = nowSeconds();
  for (const [state, record] of oauthStateStore.entries()) {
    if (record.expiresAt <= now) {
      oauthStateStore.delete(state);
    }
  }
}

export function issueOAuthState(provider: 'google', redirectUri?: string): { state: string; expiresIn: number } {
  cleanupExpiredState();

  const ttl = getStateTtlSeconds();
  const createdAt = nowSeconds();
  const expiresAt = createdAt + ttl;
  const state = makeStateToken();

  oauthStateStore.set(state, {
    provider,
    createdAt,
    expiresAt,
    redirectUri: redirectUri?.trim() || undefined,
  });

  return { state, expiresIn: ttl };
}

export function consumeOAuthState(state: string, provider: 'google'): OAuthStateRecord | null {
  cleanupExpiredState();

  const record = oauthStateStore.get(state);
  if (!record || record.provider !== provider) {
    return null;
  }

  oauthStateStore.delete(state);
  return record;
}

export function getOAuthStateStoreSize(): number {
  cleanupExpiredState();
  return oauthStateStore.size;
}

export function resetOAuthStateStoreForTests(): void {
  oauthStateStore.clear();
}
