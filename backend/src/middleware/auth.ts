import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';
import { setUser, addBreadcrumb } from '../config/sentry';
import { JWTPayload } from '../types';
import { getAccessTokenFromRequest } from '../services/auth/authCookies';
import { updateRequestContext } from './requestContextStore';

function makeTokenId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userExp?: number;
      tenantId?: string;
      tenantContext?: {
        tenantId: string;
        plan: 'free' | 'pro';
        features: string[];
        limits: Record<string, number>;
      };
      workspaceId?: string;
      workspace?: {
        workspaceId: string;
        tenantId: string;
        name: string;
        isDefault: boolean;
        plan?: 'free' | 'pro';
      };
    }
  }
}

function getRequestContext(req: Request): { requestId?: string; routeScope?: string } {
  const contextReq = req as Request & { requestId?: string; routeScope?: string };
  return {
    requestId: contextReq.requestId,
    routeScope: contextReq.routeScope,
  };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestContext = getRequestContext(req);
  const buildAuthError = (message: string) => ({
    message,
    requestId: requestContext.requestId,
    routeScope: requestContext.routeScope,
  });

  try {
    const token = getAccessTokenFromRequest(req);

    if (!token) {
      res.status(401).json(buildAuthError('Missing authentication token'));
      return;
    }

    const devBypassToken = env.AUTH_DEV_BYPASS_TOKEN;
    if (env.NODE_ENV === 'test' && devBypassToken && token === devBypassToken) {
      const userId = 'test-user';
      const userEmail = 'test-user@local.test';
      req.userId = userId;
      req.userEmail = userEmail;
      req.userExp = Date.now() / 1000 + 60;
      updateRequestContext({ userId, userEmail });
      logger.warn({
        requestId: requestContext.requestId,
        routeScope: requestContext.routeScope,
        fallback: 'auth-dev-bypass-active',
      }, 'INSECURE DEV LOGIN bypass token used');
      next();
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      if (payload.tokenType && payload.tokenType !== 'access') {
        res.status(401).json(buildAuthError('Invalid access token type'));
        return;
      }
      req.userId = payload.userId;
      req.userEmail = payload.email;
      req.userExp = payload.exp;
      updateRequestContext({ userId: payload.userId, userEmail: payload.email });

      // Set Sentry user context for error tracking
      setUser({
        id: payload.userId,
        email: payload.email,
      });
      addBreadcrumb(`Authenticated user: ${payload.email}`, 'auth', 'info');

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json(buildAuthError('Token expired'));
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json(buildAuthError('Invalid token'));
      } else {
        res.status(401).json(buildAuthError('Authentication failed'));
      }
    }
  } catch (error) {
    logger.error({
      error,
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
      fallback: 'auth-middleware-error',
    }, 'Auth middleware error');
    res.status(500).json(buildAuthError('Internal server error'));
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestContext = getRequestContext(req);
  try {
    const token = getAccessTokenFromRequest(req);

    if (token) {
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
        if (!payload.tokenType || payload.tokenType === 'access') {
          req.userId = payload.userId;
          req.userEmail = payload.email;
          req.userExp = payload.exp;
          updateRequestContext({ userId: payload.userId, userEmail: payload.email });
        }
      } catch (error) {
        logger.debug({
          requestId: requestContext.requestId,
          routeScope: requestContext.routeScope,
          fallback: 'optional-auth-token-invalid',
        }, 'Optional auth token invalid');
      }
    }

    next();
  } catch (error) {
    logger.error({
      error,
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
      fallback: 'optional-auth-middleware-error',
    }, 'Optional auth middleware error');
    res.status(500).json({
      message: 'Internal server error',
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
    });
  }
}

export function generateAccessToken(
  userId: string,
  email: string,
  expiresIn: string | number = env.JWT_ACCESS_EXPIRES_IN,
): string {
  const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(
    { userId, email, tokenType: 'access' },
    env.JWT_SECRET as string,
    options
  );
}

export function generateRefreshToken(
  userId: string,
  email: string,
  expiresIn: string | number = env.JWT_REFRESH_EXPIRES_IN,
): string {
  const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(
    { userId, email, tokenType: 'refresh', jti: makeTokenId() },
    env.JWT_SECRET as string,
    options
  );
}

// Backward compatibility for existing callers/tests.
export function generateToken(userId: string, email: string, expiresIn?: string | number): string {
  return generateAccessToken(userId, email, expiresIn);
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (error) {
    logger.warn({
      error,
      tokenLength: typeof token === 'string' ? token.length : 0,
      tokenType: typeof token,
      fallback: 'auth-decode-token-failed',
    }, '[AuthMiddleware] Failed to decode token; returning null');
    return null;
  }
}
