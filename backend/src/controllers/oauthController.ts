import { Request, Response } from 'express';

import { AppError, asyncHandler } from '../middleware/errorHandler';
import logger from '../config/logger';
import { completeGoogleOAuthCallback, startGoogleOAuth } from '../services/auth/googleOAuthService';
import { generateAccessToken, decodeToken } from '../middleware/auth';
import { issueRefreshToken } from '../services/auth/refreshTokenStore';
import { JWTPayload } from '../types';

export const startGoogleOAuthController = asyncHandler(async (req: Request, res: Response) => {
  const redirectUri = typeof req.query.redirectUri === 'string' ? req.query.redirectUri : undefined;

  try {
    const started = startGoogleOAuth(redirectUri);
    res.json(started);
  } catch (error) {
    logger.error({ error }, 'Failed to start Google OAuth');
    throw new AppError(500, error instanceof Error ? error.message : 'Failed to start Google OAuth');
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

    res.json({
      token: accessToken,
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresIn: accessPayload.exp - Math.floor(Date.now() / 1000),
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
    if (message.toLowerCase().includes('state')) {
      throw new AppError(401, message);
    }
    if (message.toLowerCase().includes('missing')) {
      throw new AppError(400, message);
    }
    throw new AppError(500, message);
  }
});
