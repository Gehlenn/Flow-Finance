import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

// ─── SENTRY CONFIGURATION ──────────────────────────────────────────────────────

/**
 * Initialize Sentry for Node.js backend error tracking and performance monitoring
 * This should be called early in the application lifecycle (before Express app setup)
 */
export const initSentry = () => {
  // Only initialize if DSN is provided (production/staging)
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not found. Backend error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '0.6.1',

    // Performance monitoring
    integrations: [
      // Add profiling integration for performance monitoring
      nodeProfilingIntegration(),
    ],

    // Performance traces sample rate (0.0 to 1.0)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Error sample rate (0.0 to 1.0)
    sampleRate: 1.0,

    // Capture console errors in development
    beforeSend: (event) => {
      // Don't send events in development unless explicitly configured
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
        return null;
      }

      // Add backend context
      event.tags = {
        ...event.tags,
        service: 'flow-finance-api',
        component: 'backend',
      };

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are expected
      'ECONNRESET',
      'EPIPE',
      'ECONNREFUSED',
      // JWT errors that are handled gracefully
      'TokenExpiredError',
      'JsonWebTokenError',
      'NotBeforeError',
    ],

    // Don't capture errors from test environments
    denyUrls: process.env.NODE_ENV === 'test' ? [/.*/] : [],
  });

  console.log('Sentry initialized for backend error tracking');
};

// ─── ERROR REPORTING HELPERS ─────────────────────────────────────────────────

/**
 * Report an error manually to Sentry
 */
export const reportError = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

/**
 * Report a message to Sentry
 */
export const reportMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureMessage(message, level);
  });
};

/**
 * Set user context for error tracking (from JWT token)
 */
export const setUser = (user: { id: string; email?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
};

/**
 * Clear user context
 */
export const clearUser = () => {
  Sentry.setUser(null);
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message: string, category?: string, level?: Sentry.SeverityLevel) => {
  Sentry.addBreadcrumb({
    message,
    category: category || 'custom',
    level: level || 'info',
  });
};

/**
 * Set request context for error tracking
 */
export const setRequestContext = (req: Request) => {
  Sentry.setContext('request', {
    url: req.url,
    method: req.method,
    headers: req.headers,
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });
};

// ─── EXPRESS MIDDLEWARE ──────────────────────────────────────────────────────

/**
 * Express middleware to set Sentry context for each request
 */
export const sentryRequestHandler = (_req: Request, _res: Response, next: NextFunction) => {
  // Set request context for error tracking
  Sentry.setContext('request', {
    url: _req.url,
    method: _req.method,
    headers: _req.headers,
    userAgent: _req.get('user-agent'),
    ip: _req.ip,
  });
  next();
};

/**
 * Express error handler middleware for Sentry
 */
export const sentryErrorHandler = (err: Error, _req: Request, _res: Response, next: NextFunction) => {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'express_error');
    Sentry.captureException(err);
  });
  next(err); // Continue to next error handler
};
