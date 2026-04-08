import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { hasDatabaseConfig, resolveDatabaseSslConfig } from '../../src/config/database';

const DATABASE_ENV_KEYS = ['DATABASE_URL', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
const DATABASE_SSL_ENV_KEYS = ['DB_SSL_ENABLED', 'DB_SSL_REJECT_UNAUTHORIZED', 'DB_SSL_CA', 'NODE_ENV'] as const;

let originalEnv: Partial<Record<(typeof DATABASE_ENV_KEYS)[number], string | undefined>>;
let originalSslEnv: Partial<Record<(typeof DATABASE_SSL_ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  originalEnv = {};
  for (const key of DATABASE_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }

  originalSslEnv = {};
  for (const key of DATABASE_SSL_ENV_KEYS) {
    originalSslEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of DATABASE_ENV_KEYS) {
    const previous = originalEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }

  for (const key of DATABASE_SSL_ENV_KEYS) {
    const previous = originalSslEnv[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
});

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
