import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// ─── SENTRY CONFIGURATION ──────────────────────────────────────────────────────

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This should be called early in the app lifecycle (before React renders)
 */
export const initSentry = () => {
  // Only initialize if DSN is provided (production/staging)
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION || '0.1.0',

    // Performance monitoring
    integrations: [
      // BrowserTracing desabilitado - usar apenas error tracking
    ],

    // Performance traces sample rate (0.0 to 1.0)
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

    // Error sample rate (0.0 to 1.0)
    sampleRate: 1.0,

    // Capture console errors in development
    beforeSend: (event, hint) => {
      // Don't send events in development unless explicitly configured
      if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DEV_ENABLED) {
        return null;
      }

      // Add platform context
      event.tags = {
        ...event.tags,
        platform: getPlatform(),
        isNative: isPlatformNative(),
      };

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are expected
      'NetworkError',
      'AbortError',
      // ResizeObserver loop limit exceeded (common in React apps)
      'ResizeObserver loop limit exceeded',
      // Capacitor-specific errors that are handled elsewhere
      'plugin_not_installed',
    ],

    // Don't capture errors from localhost in production builds
    denyUrls: import.meta.env.PROD ? [
      /localhost/,
      /127\.0\.0\.1/,
      /0\.0\.0\.0/,
    ] : [],
  });

  console.log('Sentry initialized for error tracking');
};

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Get current platform (web, android, ios)
 */
const getPlatform = (): string => {
  // Check if running in Capacitor
  if (window.Capacitor) {
    return window.Capacitor.getPlatform();
  }
  return 'web';
};

/**
 * Check if running on native platform
 */
const isPlatformNative = (): boolean => {
  return getPlatform() !== 'web';
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
 * Set user context for error tracking
 */
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
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

// ─── REACT ERROR BOUNDARY INTEGRATION ────────────────────────────────────────

/**
 * Enhanced Error Boundary that reports to Sentry
 * Use this instead of the basic ErrorBoundary component
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Hook to report errors from React error boundaries
 */
export const useErrorReporting = () => {
  return {
    reportError,
    reportMessage,
    setUser,
    clearUser,
    addBreadcrumb,
  };
};
