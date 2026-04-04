import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth';
import { authLimiterByUser } from '../middleware/rateLimit';
import {
  loginController,
  firebaseSessionController,
  refreshController,
  validateController,
  logoutController
} from '../controllers/authController';
import { googleOAuthCallbackController, startGoogleOAuthController } from '../controllers/oauthController';
import { validate } from '../middleware/validate';
import { FirebaseSessionSchema, LoginSchema } from '../validation/user.schema';

const router = Router();

/**
 * POST /api/auth/login
 * Generate JWT token for authenticated user
 *
 * Body: { email: string, password: string }
 * Returns: { token: string, expiresIn: number, user: { userId: string, email: string } }
 */
router.post('/login', authLimiterByUser, validate(LoginSchema), loginController);
router.post('/firebase', authLimiterByUser, validate(FirebaseSessionSchema), firebaseSessionController);

/**
 * GET /api/auth/oauth/google/start
 * Inicia fluxo OAuth Google e retorna URL autorizada + state
 */
router.get('/oauth/google/start', authLimiterByUser, startGoogleOAuthController);

/**
 * GET /api/auth/oauth/google/callback
 * Callback OAuth Google (scaffold mock-first)
 */
router.get('/oauth/google/callback', authLimiterByUser, googleOAuthCallbackController);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 *
 * Headers: Authorization: Bearer <old_token>
 * Returns: { token: string, expiresIn: number }
 */
router.post('/refresh', optionalAuthMiddleware, refreshController);

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
router.post('/logout', optionalAuthMiddleware, logoutController);

export default router;
