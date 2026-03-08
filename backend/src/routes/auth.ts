import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import {
  loginController,
  refreshController,
  validateController,
  logoutController
} from '../controllers/authController';

const router = Router();

/**
 * POST /api/auth/login
 * Generate JWT token for authenticated user
 *
 * Body: { email: string, password: string }
 * Returns: { token: string, expiresIn: number, user: { userId: string, email: string } }
 */
router.post('/login', authLimiter, loginController);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 *
 * Headers: Authorization: Bearer <old_token>
 * Returns: { token: string, expiresIn: number }
 */
router.post('/refresh', authMiddleware, refreshController);

/**
 * GET /api/auth/validate
 * Check if current token is valid
 *
 * Headers: Authorization: Bearer <token> (optional)
 * Returns: { valid: boolean, user?: { userId: string, email: string }, expiresIn?: number }
 */
router.get('/validate', optionalAuthMiddleware, validateController);

/**
 * POST /api/auth/logout
 * Invalidate token (client-side instruction)
 *
 * Headers: Authorization: Bearer <token>
 * Returns: { success: boolean, message: string }
 */
router.post('/logout', authMiddleware, logoutController);

export default router;
