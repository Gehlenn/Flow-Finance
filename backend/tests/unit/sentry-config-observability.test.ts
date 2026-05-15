import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
const loggerInfoMock = vi.fn();

vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => initMock(...args),
  withScope: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
  },
}));

describe('backend sentry config observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs contextual data when backend Sentry initializes', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_VERSION', '0.6.1');

    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(true);
    initSentry();

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fallback: 'backend-sentry-initialized',
            }),
      'Sentry initialized for backend error tracking',
    );
  }, 20_000);
});

