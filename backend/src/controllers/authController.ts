import { Request, Response } from 'express';
import { generateAccessToken, decodeToken } from '../middleware/auth';
import logger from '../config/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { JWTPayload } from '../types';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
} from '../services/auth/refreshTokenStore';
import { recordAuditEvent } from '../services/admin/auditLog';
import {
  isFirebaseIdentityVerificationConfigured,
  verifyFirebaseIdToken,
} from '../services/auth/firebaseIdentityService';

export function isInsecureLocalLoginAllowed(): boolean {
  const override = String(process.env.AUTH_ALLOW_INSECURE_LOCAL_LOGIN || '').trim().toLowerCase();
  if (override === 'true') {
    return true;
  }
  if (override === 'false') {
    return false;
  }

  const nodeEnv = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
  return nodeEnv === 'development' || nodeEnv === 'test';
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userExp?: number;
      rawBody?: string;
    }
  }
}

/**
 * LOGIN — Generate JWT token for authenticated user
 * POST /api/auth/login
 *
 * Body: { email: string, password: string }
 * Returns: { token: string, expiresIn: number, user: { userId: string, email: string } }
 */
export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, userId: requestedUserId } = req.body;

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required');
  }

  // Legacy local login is intentionally blocked unless explicitly enabled.
  if (!isInsecureLocalLoginAllowed()) {
    throw new AppError(
      503,
      'Email/password login is disabled. Use Firebase session exchange or configure secure credential verification.'
    );
  }
  
  const userId = typeof requestedUserId === 'string' && requestedUserId.trim().length > 0
    ? requestedUserId.trim()
    : Buffer.from(email).toString('base64').substring(0, 20);
  
  logger.info({ email }, 'User login attempt');

  try {
    const accessToken = generateAccessToken(userId, email);
    const decodedToken = decodeToken(accessToken) as JWTPayload;
    const refresh = issueRefreshToken(userId, email);

    recordAuditEvent({
      userId,
      email,
      action: 'auth.login',
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000),
      refreshExpiresIn: refresh.expiresIn,
      user: {
        userId,
        email
      }
    });
  } catch (error) {
    logger.error({ error, email }, 'Login error');
    recordAuditEvent({ email, action: 'auth.login_failed', status: 'failure', ip: req.ip });
    throw new AppError(500, 'Failed to generate authentication token');
  }
});

export const firebaseSessionController = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken || typeof idToken !== 'string') {
    throw new AppError(400, 'Firebase idToken is required');
  }

  if (!isFirebaseIdentityVerificationConfigured()) {
    throw new AppError(503, 'Firebase identity verification is not configured on the backend');
  }

  try {
    const identity = await verifyFirebaseIdToken(idToken);
    const accessToken = generateAccessToken(identity.userId, identity.email);
    const decodedToken = decodeToken(accessToken) as JWTPayload;
    const refresh = issueRefreshToken(identity.userId, identity.email);

    recordAuditEvent({
      userId: identity.userId,
      email: identity.email,
      action: 'auth.login',
      status: 'success',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        provider: 'firebase',
        emailVerified: identity.emailVerified,
      },
    });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000),
      refreshExpiresIn: refresh.expiresIn,
      user: {
        userId: identity.userId,
        email: identity.email,
        name: identity.name,
        picture: identity.picture,
        emailVerified: identity.emailVerified,
      }
    });
  } catch (error) {
    logger.error({ error }, 'Firebase session exchange error');
    throw new AppError(401, 'Invalid Firebase identity token');
  }
});

/**
 * REFRESH — Refresh JWT token
 * POST /api/auth/refresh
 *
 * Body: { refreshToken: string }
 * Also supports backward-compatible Authorization: Bearer <access_token>
 * Returns: { token: string, accessToken: string, expiresIn: number, refreshToken?: string }
 */
export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  const providedRefreshToken = typeof req.body?.refreshToken === 'string'
    ? req.body.refreshToken
    : null;

  try {
    // Preferred path: rotation using refresh token.
    if (providedRefreshToken) {
      const rotated = rotateRefreshToken(providedRefreshToken);
      const accessToken = generateAccessToken(rotated.userId, rotated.email);
      const decodedToken = decodeToken(accessToken) as JWTPayload;

      logger.debug({ userId: rotated.userId }, 'Refresh token rotated');

      recordAuditEvent({
        userId: rotated.userId,
        action: 'auth.token_refresh',
        status: 'success',
        ip: req.ip,
      });

      res.json({
        token: accessToken,
        accessToken,
        refreshToken: rotated.refreshToken,
        expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000),
        refreshExpiresIn: rotated.refreshExpiresIn,
      });
      return;
    }

    // Backward-compatible path: access token in Authorization header.
    if (!req.userId || !req.userEmail) {
      throw new AppError(401, 'Refresh token or valid authorization is required');
    }

    logger.debug({ userId: req.userId }, 'Legacy access-token refresh request');
    const accessToken = generateAccessToken(req.userId, req.userEmail);
    const decodedToken = decodeToken(accessToken) as JWTPayload;

    res.json({
      token: accessToken,
      accessToken,
      expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000),
    });
  } catch (error) {
    logger.error({ error, userId: req.userId, hasRefreshToken: !!providedRefreshToken }, 'Refresh error');
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('expired')) {
      throw new AppError(401, message);
    }
    throw new AppError(500, 'Failed to refresh authentication token');
  }
});

/**
 * VALIDATE — Check if current token is valid
 * GET /api/auth/validate
 *
 * Headers: Authorization: Bearer <token>
 * Returns: { valid: boolean, user: { userId: string, email: string }, expiresIn: number }
 */
export const validateController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId || !req.userEmail) {
    res.json({ valid: false });
    return;
  }

  logger.debug({ userId: req.userId }, 'Token validation request');

  try {
    // Token was already validated by middleware
    const expirationTime = (req.userExp || 0) - Math.floor(Date.now() / 1000);
    
    res.json({
      valid: true,
      user: {
        userId: req.userId,
        email: req.userEmail
      },
      expiresIn: expirationTime
    });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Validate error');
    res.json({ valid: false });
  }
});

/**
 * LOGOUT — Invalidate token (client-side only, as JWT is stateless)
 * POST /api/auth/logout
 *
 * Headers: Authorization: Bearer <token>
 * Returns: { success: boolean, message: string }
 */
export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = typeof req.body?.refreshToken === 'string'
    ? req.body.refreshToken
    : null;

  if (!req.userId && !refreshToken) {
    throw new AppError(401, 'Authorization required');
  }

  logger.info({ userId: req.userId }, 'User logout');

  // In production, could:
  // 1. Add token to blacklist (Redis set with expiration)
  // 2. Invalidate refresh tokens in database
  // 3. Clear user session data
  
  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }
  const revokedCount = req.userId ? revokeUserRefreshTokens(req.userId) : 0;

  recordAuditEvent({
    userId: req.userId,
    action: 'auth.logout',
    status: 'success',
    ip: req.ip,
    metadata: { revokedCount: revokedCount + (refreshToken ? 1 : 0) },
  });

  res.json({
    success: true,
    revokedRefreshTokens: revokedCount + (refreshToken ? 1 : 0),
    message: 'Logged out successfully. Please clear tokens on the client side.'
  });
});
