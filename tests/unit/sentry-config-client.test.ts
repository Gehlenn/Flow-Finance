import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('client sentry config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('treats whitespace-only DSN as not configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '   ');

    const { initSentry, isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(false);

    initSentry();
    await Promise.resolve();
  });

  it('normalizes DSN with outer whitespace for configuration checks', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '  https://examplePublicKey@o0.ingest.sentry.io/0  ');

    const { isSentryConfigured } = await import('../../src/config/sentry');

    expect(isSentryConfigured()).toBe(true);
  });
});
