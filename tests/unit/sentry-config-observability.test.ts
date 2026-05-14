import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
}));

vi.mock('../../src/utils/logger', () => ({
  logInfo: (...args: unknown[]) => logInfoMock(...args),
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('sentry config observability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs contextual data when Sentry initializes successfully', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('VITE_APP_VERSION', '0.9.7');
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('PROD', 'false');

    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(true);

    initSentry();
    await Promise.resolve();
    await Promise.resolve();

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(logInfoMock).toHaveBeenCalledWith(
      'Sentry initialized for error tracking',
      expect.objectContaining({ fallback: 'sentry-initialized' }),
    );
  });

  it('treats whitespace-only DSN as not configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '   ');

    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(false);

    initSentry();
    await Promise.resolve();
    expect(initMock).not.toHaveBeenCalled();
  });
});
