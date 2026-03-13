import { Request, Response } from 'express';
import { generateToken, decodeToken } from '../middleware/auth';
import logger from '../config/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { JWTPayload } from '../types';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userExp?: number;
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

  // For MVP: Accept any email/password (in production, hash and verify)
  // In production, implement:
  // 1. Look up user in database by email
  // 2. Hash provided password and compare to stored hash
  // 3. Return error if mismatch
  
  const userId = typeof requestedUserId === 'string' && requestedUserId.trim().length > 0
    ? requestedUserId.trim()
    : Buffer.from(email).toString('base64').substring(0, 20);
  
  logger.info({ email }, 'User login attempt');

  try {
    const token = generateToken(userId, email);
    const decodedToken = decodeToken(token) as JWTPayload;

    res.json({
      token,
      expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000),
      user: {
        userId,
        email
      }
    });
  } catch (error) {
    logger.error({ error, email }, 'Login error');
    throw new AppError(500, 'Failed to generate authentication token');
  }
});

/**
 * REFRESH — Refresh JWT token
 * POST /api/auth/refresh
 *
 * Headers: Authorization: Bearer <old_token>
 * Returns: { token: string, expiresIn: number }
 */
export const refreshController = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId || !req.userEmail) {
    throw new AppError(401, 'Authorization required');
  }

  logger.debug({ userId: req.userId }, 'Token refresh request');

  try {
    const newToken = generateToken(req.userId, req.userEmail);
    const decodedToken = decodeToken(newToken) as JWTPayload;

    res.json({
      token: newToken,
      expiresIn: decodedToken.exp - Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Refresh error');
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
  if (!req.userId) {
    throw new AppError(401, 'Authorization required');
  }

  logger.info({ userId: req.userId }, 'User logout');

  // In production, could:
  // 1. Add token to blacklist (Redis set with expiration)
  // 2. Invalidate refresh tokens in database
  // 3. Clear user session data
  
  res.json({
    success: true,
    message: 'Logged out successfully. Please clear the token on the client side.'
  });
});
