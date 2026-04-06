import { describe, it, expect } from 'vitest';

import { hasDatabaseConfig, resolveDatabaseSslConfig } from '../../src/config/database';

describe('hasDatabaseConfig', () => {
  it('returns false when no explicit database environment is present', () => {
    expect(hasDatabaseConfig({
      databaseUrl: undefined,
      dbHost: undefined,
      dbName: undefined,
      dbUser: undefined,
      dbPassword: undefined,
    })).toBe(false);
  });

  it('returns true when DATABASE_URL is provided', () => {
    expect(hasDatabaseConfig({
      databaseUrl: 'postgres://user:pass@host:5432/db',
    })).toBe(true);
  });
});

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
