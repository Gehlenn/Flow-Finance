type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
type SentryModule = typeof import('@sentry/react');
type SentryScopeLike = {
  setTag: (key: string, value: unknown) => void;
};
type SentryLike = {
  browserTracingIntegration?: (options?: {
    instrumentNavigation?: boolean;
    instrumentPageLoad?: boolean;
  }) => unknown;
  withScope?: (callback: (scope: SentryScopeLike) => void) => void;
  captureException?: (error: Error) => void;
  captureMessage?: (message: string, level?: SeverityLevel) => void;
  setUser?: (user: { id: string; email?: string; username?: string } | null) => void;
  addBreadcrumb?: (breadcrumb: { message: string; category: string; level: SeverityLevel }) => void;
};
type SentryEnv = {
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  VITE_API_DEV_URL?: string;
  VITE_API_PROD_URL?: string;
  SENTRY_DSN?: string;
};

let sentryModule: SentryModule | null = null;
let sentryLoader: Promise<SentryModule | null> | null = null;
let sentryInitialized = false;

export const resolveSentryDsn = (env: SentryEnv): string => {
  const viteDsn = String(env.VITE_SENTRY_DSN || '').trim();
  if (viteDsn) return viteDsn;

  return String(env.SENTRY_DSN || '').trim();
};

const getSentryEnv = (): SentryEnv => ({
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_SENTRY_ENVIRONMENT: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  VITE_API_DEV_URL: import.meta.env.VITE_API_DEV_URL,
  VITE_API_PROD_URL: import.meta.env.VITE_API_PROD_URL,
  SENTRY_DSN: import.meta.env.SENTRY_DSN,
});

const getDsn = (): string => resolveSentryDsn(getSentryEnv());
const getEnvironment = (): string => String(
  import.meta.env.VITE_SENTRY_ENVIRONMENT ||
  import.meta.env.MODE ||
  'development',
).trim() || 'development';
const isSentryDevEnabled = (): boolean => String(import.meta.env.VITE_SENTRY_DEV_ENABLED || '').trim().toLowerCase() === 'true';
export const isSentryConfigured = (): boolean => Boolean(getDsn().trim());

const getTracePropagationTargets = (): (string | RegExp)[] => {
  const env = getSentryEnv();
  const explicitTargets = [
    String(env.VITE_API_DEV_URL || '').trim(),
    String(env.VITE_API_PROD_URL || '').trim(),
  ].filter(Boolean);

  return [
    'localhost',
    /^\//,
    ...explicitTargets,
  ];
};

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
        console.warn('[Sentry] Failed to load module', error);
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
  const hasFrontendDsn = Boolean(String(import.meta.env.VITE_SENTRY_DSN || '').trim());

  if (import.meta.env.PROD && !hasFrontendDsn) {
    console.warn('[Sentry] DSN ausente em producao', {
      hasLegacyFallbackDsn: Boolean(String(import.meta.env.SENTRY_DSN || '').trim()),
    });
  }

  if (!dsn || sentryInitialized) {
    return;
  }

  void loadSentry().then((Sentry) => {
    if (!Sentry || sentryInitialized) return;
    const sentry = Sentry as SentryLike;
    const browserTracingIntegration = 'browserTracingIntegration' in Sentry &&
      typeof sentry.browserTracingIntegration === 'function'
      ? sentry.browserTracingIntegration({
        instrumentNavigation: true,
        instrumentPageLoad: true,
      })
      : undefined;
    const integrations = browserTracingIntegration ? [browserTracingIntegration] : [];

    Sentry.init({
      dsn,
      environment: getEnvironment(),
      release: import.meta.env.VITE_APP_VERSION || '0.9.7',
      integrations: integrations as Parameters<SentryModule['init']>[0]['integrations'],
      tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
      tracePropagationTargets: getTracePropagationTargets(),
      sampleRate: 1.0,
      beforeSend: (event) => {
        if (import.meta.env.DEV && !isSentryDevEnabled()) {
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
    console.info('[Sentry] Initialized for error tracking');
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
export const reportError = (error: Error, context?: Record<string, unknown>) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentry = Sentry as SentryLike;
    sentry.withScope?.((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setTag(key, context[key]);
        });
      }
      sentry.captureException?.(error);
    });
  });
};

/**
 * Report a message to Sentry
 */
export const reportMessage = (message: string, level: SeverityLevel = 'info', context?: Record<string, unknown>) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentry = Sentry as SentryLike;
    sentry.withScope?.((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setTag(key, context[key]);
        });
      }
      sentry.captureMessage?.(message, level);
    });
  });
};

/**
 * Set user context for error tracking
 */
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentry = Sentry as SentryLike;
    sentry.setUser?.({
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
    const sentry = Sentry as SentryLike;
    sentry.setUser?.(null);
  });
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (message: string, category?: string, level?: SeverityLevel) => {
  void loadSentry().then((Sentry) => {
    if (!Sentry) return;
    const sentry = Sentry as SentryLike;
    sentry.addBreadcrumb?.({
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




