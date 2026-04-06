import { Request, Response } from 'express';

import { AppError, asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';
import { completeGoogleOAuthCallback, startGoogleOAuth } from '../services/auth/googleOAuthService';
import { generateAccessToken, decodeToken } from '../middleware/auth';
import { issueRefreshToken } from '../services/auth/refreshTokenStore';
import { JWTPayload } from '../types';
import { recordAuditEvent } from '../services/admin/auditLog';
import { setAuthCookies } from '../services/auth/authCookies';

export const startGoogleOAuthController = asyncHandler(async (req: Request, res: Response) => {
  const redirectUri = typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined;

  try {
    const started = startGoogleOAuth(redirectUri);
    recordAuditEvent({ action: 'auth.oauth_start', status: 'success', resource: 'google', ip: req.ip });
    res.json(started);
  } catch (error) {
    logger.error({ error }, 'Failed to start Google OAuth');
    const message = error instanceof Error ? error.message : 'Failed to start Google OAuth';
    if (message.toLowerCase().includes('redirect')) {
      throw new AppError(400, message);
    }
    throw new AppError(500, message);
  }
});

export const googleOAuthCallbackController = asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';

  if (!code || !state) {
    throw new AppError(400, 'Missing required query params: code and state');
  }

  try {
    const profile = await completeGoogleOAuthCallback({ code, state });

    const accessToken = generateAccessToken(profile.providerUserId, profile.email);
    const accessPayload = decodeToken(accessToken) as JWTPayload | null;
    if (!accessPayload) {
      throw new Error('Failed to decode generated access token');
    }

    const refresh = issueRefreshToken(profile.providerUserId, profile.email);
    const accessExpiresIn = accessPayload.exp - Math.floor(Date.now() / 1000);

    recordAuditEvent({
      userId: profile.providerUserId,
      email: profile.email,
      action: 'auth.oauth_success',
      status: 'success',
      resource: 'google',
      ip: req.ip,
    });

    setAuthCookies(res, {
      accessToken,
      accessExpiresInSeconds: accessExpiresIn,
      refreshToken: refresh.refreshToken,
      refreshExpiresInSeconds: refresh.expiresIn,
    });

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refresh.expiresIn,
      user: {
        userId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
      oauth: {
        provider: 'google',
        linked: true,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to complete Google OAuth callback');
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    recordAuditEvent({ action: 'auth.oauth_failed', status: 'failure', resource: 'google', ip: req.ip, metadata: { message } });
    if (message.toLowerCase().includes('state')) {
      throw new AppError(401, message);
    }
    if (message.toLowerCase().includes('missing')) {
      throw new AppError(400, message);
    }
    throw new AppError(500, message);
  }
});
