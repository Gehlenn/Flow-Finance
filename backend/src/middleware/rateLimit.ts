import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import env from '../config/env';
import { createRateLimitByUser } from './rateLimitByUser';

// In development, disable rate limiting for faster iteration
const isDev = env.NODE_ENV === 'development';
const devNoopLimiter: RequestHandler = (req, res, next) => {
  void req;
  void res;
  next();
};

export const apiLimiter = isDev ? devNoopLimiter : rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/health';
  },
});

export const aiLimiter = isDev ? devNoopLimiter : rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit AI endpoints to 10 requests per minute per IP
  message: 'Too many AI requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = isDev ? devNoopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit login attempts to 5 per 15 minutes per IP
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 10,
  skip: (req) => req.path === '/health',
});

export const authLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

export const authRefreshLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

export const billingLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 30,
});

export const bankingLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 60,
  skip: (req) => req.path === '/health' || req.path.includes('/webhooks/'),
});

export const financeEventsLimiterByUser = isDev ? devNoopLimiter : createRateLimitByUser({
  windowMs: 60 * 1000,
  max: 120,
});
