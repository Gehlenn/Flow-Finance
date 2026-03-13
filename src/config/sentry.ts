type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
type SentryModule = typeof import('@sentry/react');

let sentryModule: SentryModule | null = null;
let sentryLoader: Promise<SentryModule | null> | null = null;
let sentryInitialized = false;

const getDsn = (): string => import.meta.env.VITE_SENTRY_DSN || '';

async function loadSentry(): Promise<SentryModule | null> {
  if (sentryModule) return sentryModule;
  if (!getDsn()) return null;
  if (!sentryLoader) {
    sentryLoader = import('@sentry/react')
      .then((mod) => {
        sentryModule = mod;
        return mod;
      })
      .catch((error) => {
        console.warn('Failed to load Sentry module:', error);
        return null;
      });
  }
  return sentryLoader;
}

// ─── SENTRY CONFIGURATION ──────────────────────────────────────────────────────

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This should be called early in the app lifecycle (before React renders)
 */
export const initSentry = () => {
  // Only initialize if DSN is provided (production/staging)
  const dsn = getDsn();

  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  void loadSentry().then((Sentry) => {
    if (!Sentry || sentryInitialized) return;

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      release: import.meta.env.VITE_APP_VERSION || '0.6.1',
      tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
      sampleRate: 1.0,
      beforeSend: (event) => {
        if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DEV_ENABLED) {
          return null;
        }

        event.tags = {
          ...event.tags,
          platform: getPlatform(),
          isNative: isPlatformNative(),
        };

        return event;
      },
      ignoreErrors: [
        'NetworkError',
        'AbortError',
        'ResizeObserver loop limit exceeded',
        'plugin_not_installed',
      ],
      denyUrls: import.meta.env.PROD ? [
        /localhost/,
        /127\.0\.0\.1/,
        /0\.0\.0\.0/,
      ] : [],
    });

    sentryInitialized = true;
    console.log('Sentry initialized for error tracking');
  });
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
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentryAny = Sentry as any;
    sentryAny.withScope?.((scope: any) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setTag(key, context[key]);
        });
      }
      sentryAny.captureException?.(error);
    });
  });
};

/**
 * Report a message to Sentry
 */
export const reportMessage = (message: string, level: SeverityLevel = 'info', context?: Record<string, any>) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentryAny = Sentry as any;
    sentryAny.withScope?.((scope: any) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setTag(key, context[key]);
        });
      }
      sentryAny.captureMessage?.(message, level);
    });
  });
};

/**
 * Set user context for error tracking
 */
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentryAny = Sentry as any;
    sentryAny.setUser?.({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  });
};

/**
 * Clear user context
 */
export const clearUser = () => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentryAny = Sentry as any;
    sentryAny.setUser?.(null);
  });
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message: string, category?: string, level?: SeverityLevel) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentryAny = Sentry as any;
    sentryAny.addBreadcrumb?.({
      message,
      category: category || 'custom',
      level: level || 'info',
    });
  });
};

// ─── REACT ERROR BOUNDARY INTEGRATION ────────────────────────────────────────

/**
 * Enhanced Error Boundary that reports to Sentry
 * Use this instead of the basic ErrorBoundary component
 */
export const SentryErrorBoundary = null;

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
