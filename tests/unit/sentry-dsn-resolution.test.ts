import { describe, expect, it } from 'vitest';

import { resolveSentryDsn } from '../../src/config/sentry';

describe('resolveSentryDsn', () => {
  it('prioritizes VITE_SENTRY_DSN when both values exist', () => {
    const dsn = resolveSentryDsn({
      VITE_SENTRY_DSN: 'https://vite-key@sentry.io/100',
      SENTRY_DSN: 'https://legacy-key@sentry.io/200',
    });

    expect(dsn).toBe('https://vite-key@sentry.io/100');
  });

  it('falls back to SENTRY_DSN when VITE_SENTRY_DSN is empty', () => {
    const dsn = resolveSentryDsn({
      VITE_SENTRY_DSN: '   ',
      SENTRY_DSN: 'https://legacy-key@sentry.io/200',
    });

    expect(dsn).toBe('https://legacy-key@sentry.io/200');
  });

  it('returns empty string when both DSN values are missing', () => {
    const dsn = resolveSentryDsn({});

    expect(dsn).toBe('');
  });
});
