import { describe, it, expect } from 'vitest';

import { resolveDatabaseSslConfig } from '../../src/config/database';

describe('resolveDatabaseSslConfig', () => {
  it('enables SSL with certificate validation by default in production', () => {
    const result = resolveDatabaseSslConfig({
      nodeEnv: 'production',
      dbSslEnabled: undefined,
      dbSslRejectUnauthorized: undefined,
    });

    expect(result).toEqual({ rejectUnauthorized: true });
  });

  it('disables SSL in non-production by default', () => {
    const result = resolveDatabaseSslConfig({
      nodeEnv: 'development',
      dbSslEnabled: undefined,
      dbSslRejectUnauthorized: undefined,
    });

    expect(result).toBe(false);
  });

  it('honors explicit DB_SSL_REJECT_UNAUTHORIZED=false when SSL is enabled', () => {
    const result = resolveDatabaseSslConfig({
      nodeEnv: 'production',
      dbSslEnabled: 'true',
      dbSslRejectUnauthorized: 'false',
    });

    expect(result).toEqual({ rejectUnauthorized: false });
  });

  it('loads DB_SSL_CA and normalizes escaped newlines', () => {
    const result = resolveDatabaseSslConfig({
      nodeEnv: 'production',
      dbSslEnabled: 'true',
      dbSslRejectUnauthorized: 'true',
      dbSslCa: 'line1\\nline2',
    });

    expect(result).toEqual({
      rejectUnauthorized: true,
      ca: 'line1\nline2',
    });
  });
});
