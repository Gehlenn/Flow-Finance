import { NextFunction, Request, Response } from 'express';
import { isOriginAllowed, resolveAllowedOrigins } from '../config/cors';
import logger from '../config/logger';
import { AUTH_COOKIE_NAMES } from '../services/auth/authCookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getRefererOrigin(referer: string | undefined): string | undefined {
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch (error) {
    logger.warn({
      error,
      refererLength: referer.length,
      fallback: 'csrf-origin-invalid-referer',
    }, '[CSRF] Invalid referer header');
    return 'invalid-referer';
  }
}

export function isTrustedStateChangingOrigin(params: {
  origin?: string;
  referer?: string;
  nodeEnv?: string;
  allowedOrigins?: string;
  frontendUrl?: string;
  allowMissingOrigin?: boolean;
}): boolean {
  const nodeEnv = params.nodeEnv || process.env.NODE_ENV || 'development';
  const origin = params.origin || getRefererOrigin(params.referer);

  if (!origin) {
    return params.allowMissingOrigin ?? true;
  }

  const allowedOrigins = resolveAllowedOrigins({
    nodeEnv,
    allowedOrigins: params.allowedOrigins ?? process.env.ALLOWED_ORIGINS,
    frontendUrl: params.frontendUrl ?? process.env.FRONTEND_URL,
  });

  return isOriginAllowed(origin, allowedOrigins, nodeEnv);
}

export function requireTrustedStateChangingOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  const referer = req.get('referer');

  if (isTrustedStateChangingOrigin({ origin, referer })) {
    next();
    return;
  }

  logger.warn({
    origin,
    hasReferer: Boolean(referer),
    fallback: 'csrf-origin-rejected',
  }, '[CSRF] State-changing auth request rejected by origin policy');

  res.status(403).json({ error: 'Origem nao autorizada', statusCode: 403 });
}

function hasAuthCookie(req: Request): boolean {
  const cookie = req.get('cookie') || '';
  return cookie.includes(`${AUTH_COOKIE_NAMES.access}=`) || cookie.includes(`${AUTH_COOKIE_NAMES.refresh}=`);
}

export function requireTrustedCookieStateChangingOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase()) || !hasAuthCookie(req)) {
    next();
    return;
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  if (isTrustedStateChangingOrigin({ origin, referer, allowMissingOrigin: false })) {
    next();
    return;
  }

  logger.warn({
    origin,
    hasReferer: Boolean(referer),
    method: req.method,
    path: req.path,
    fallback: 'csrf-cookie-origin-rejected',
  }, '[CSRF] Cookie-authenticated state-changing request rejected by origin policy');

  res.status(403).json({ error: 'Origem nao autorizada', statusCode: 403 });
}
