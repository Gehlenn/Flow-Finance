import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import logger from '../config/logger';
import { setUser, addBreadcrumb } from '../config/sentry';
import { JWTPayload } from '../types';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userExp?: number;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
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
        res.status(401).json({ message: 'Token expired' });
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ message: 'Invalid token' });
      } else {
        res.status(401).json({ message: 'Authentication failed' });
      }
    }
  } catch (error) {
    logger.error({ error }, 'Auth middleware error');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
        req.userId = payload.userId;
        req.userEmail = payload.email;
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional auth token invalid');
      }
    }
    
    next();
  } catch (error) {
    logger.error({ error }, 'Optional auth middleware error');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export function generateToken(userId: string, email: string, expiresIn: string | number = '7d'): string {
  const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(
    { userId, email },
    env.JWT_SECRET as string,
    options
  );
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
