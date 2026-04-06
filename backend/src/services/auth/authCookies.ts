import type { Request, Response } from 'express';

const ACCESS_COOKIE_NAME = 'flow_access_token';
const REFRESH_COOKIE_NAME = 'flow_refresh_token';

function isProductionLike(): boolean {
  return String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
}

function getCookieOptions(maxAgeSeconds: number, path: string) {
  return {
    httpOnly: true,
    secure: isProductionLike(),
    sameSite: 'lax' as const,
    path,
    maxAge: Math.max(0, maxAgeSeconds) * 1000,
  };
}

function parseCookieHeader(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return headerValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!key) {
        return acc;
      }

      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

export function getAccessTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[ACCESS_COOKIE_NAME] || null;
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME] || null;
}

export function setAuthCookies(res: Response, params: {
  accessToken: string;
  accessExpiresInSeconds: number;
  refreshToken: string;
  refreshExpiresInSeconds: number;
}): void {
  res.cookie(ACCESS_COOKIE_NAME, params.accessToken, getCookieOptions(params.accessExpiresInSeconds, '/'));
  res.cookie(REFRESH_COOKIE_NAME, params.refreshToken, getCookieOptions(params.refreshExpiresInSeconds, '/api/auth'));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, getCookieOptions(0, '/'));
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions(0, '/api/auth'));
}

export const AUTH_COOKIE_NAMES = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
};
