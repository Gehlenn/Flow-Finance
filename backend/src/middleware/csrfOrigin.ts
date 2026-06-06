import { NextFunction, Request, Response } from 'express';
import { isOriginAllowed, resolveAllowedOrigins } from '../config/cors';
import logger from '../config/logger';

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
}): boolean {
  const nodeEnv = params.nodeEnv || process.env.NODE_ENV || 'development';
  const origin = params.origin || getRefererOrigin(params.referer);

  if (!origin) {
    return true;
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
