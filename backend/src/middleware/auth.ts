import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';
import { setUser, addBreadcrumb } from '../config/sentry';
import { JWTPayload } from '../types';

function makeTokenId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userExp?: number;
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json(buildAuthError('Missing or invalid authorization header'));
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Permitir tokens mockados em ambiente de teste
    if (process.env.NODE_ENV === 'test' && token.startsWith('mock-token-for-')) {
      const userId = token.replace('mock-token-for-', '');
      req.userId = userId;
      req.userEmail = `${userId}@mock.local`;
      req.userExp = Date.now() / 1000 + 3600;
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
    logger.error({ error }, 'Auth middleware error');
    res.status(500).json(buildAuthError('Internal server error'));
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestContext = getRequestContext(req);
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
        if (!payload.tokenType || payload.tokenType === 'access') {
          req.userId = payload.userId;
          req.userEmail = payload.email;
          req.userExp = payload.exp;
        }
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional auth token invalid');
      }
    }
    
    next();
  } catch (error) {
    logger.error({ error }, 'Optional auth middleware error');
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
  } catch {
    return null;
  }
}
