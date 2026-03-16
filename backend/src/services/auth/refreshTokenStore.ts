import crypto from 'crypto';

import { generateRefreshToken, decodeToken } from '../../middleware/auth';
import { JWTPayload } from '../../types';

interface StoredRefreshToken {
  token: string;
  userId: string;
  email: string;
  expiresAt: number; // epoch seconds
  revokedAt?: number;
}

const refreshStore = new Map<string, StoredRefreshToken>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function cleanupExpiredTokens(): void {
  const now = nowSeconds();
  for (const [token, stored] of refreshStore.entries()) {
    if (stored.expiresAt <= now || stored.revokedAt) {
      refreshStore.delete(token);
    }
  }
}

function buildAccessContext(payload: JWTPayload): { userId: string; email: string; expiresAt: number } {
  return {
    userId: payload.userId,
    email: payload.email,
    expiresAt: payload.exp,
  };
}

export function issueRefreshToken(userId: string, email: string): { refreshToken: string; expiresIn: number } {
  cleanupExpiredTokens();

  const refreshToken = generateRefreshToken(userId, email);
  const decoded = decodeToken(refreshToken) as JWTPayload | null;

  if (!decoded || decoded.tokenType !== 'refresh') {
    throw new Error('Failed to create valid refresh token');
  }

  refreshStore.set(refreshToken, {
    token: refreshToken,
    ...buildAccessContext(decoded),
  });

  return {
    refreshToken,
    expiresIn: decoded.exp - nowSeconds(),
  };
}

export function rotateRefreshToken(refreshToken: string): {
  userId: string;
  email: string;
  refreshToken: string;
  refreshExpiresIn: number;
} {
  cleanupExpiredTokens();
  const stored = refreshStore.get(refreshToken);
  if (!stored || stored.revokedAt) {
    throw new Error('Invalid refresh token');
  }

  const decoded = decodeToken(refreshToken) as JWTPayload | null;
  if (!decoded || decoded.tokenType !== 'refresh') {
    refreshStore.delete(refreshToken);
    throw new Error('Invalid refresh token');
  }

  if (decoded.exp <= nowSeconds()) {
    refreshStore.delete(refreshToken);
    throw new Error('Refresh token expired');
  }

  // Rotation: token antigo é invalidado imediatamente.
  refreshStore.delete(refreshToken);
  const next = issueRefreshToken(decoded.userId, decoded.email);

  return {
    userId: decoded.userId,
    email: decoded.email,
    refreshToken: next.refreshToken,
    refreshExpiresIn: next.expiresIn,
  };
}

export function revokeRefreshToken(refreshToken: string): void {
  refreshStore.delete(refreshToken);
}

export function revokeUserRefreshTokens(userId: string): number {
  let revoked = 0;
  for (const [token, stored] of refreshStore.entries()) {
    if (stored.userId === userId) {
      refreshStore.delete(token);
      revoked++;
    }
  }
  return revoked;
}

// Helper de teste e diagnóstico controlado.
export function getRefreshStoreSize(): number {
  cleanupExpiredTokens();
  return refreshStore.size;
}

export function resetRefreshStoreForTests(): void {
  refreshStore.clear();
}

export function makeOpaqueRefreshTokenId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
