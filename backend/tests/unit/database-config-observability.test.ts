import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  poolConnect: vi.fn(),
  poolQuery: vi.fn(),
  poolEnd: vi.fn(),
  poolOn: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: mocks.poolConnect,
    query: mocks.poolQuery,
    end: mocks.poolEnd,
    on: mocks.poolOn,
  })),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    debug: mocks.loggerDebug,
  },
}));

describe('database config observability', () => {
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    DB_HOST: process.env.DB_HOST,
  };

  beforeEach(() => {
    vi.resetModules();
    mocks.poolConnect.mockReset();
    mocks.poolQuery.mockReset();
    mocks.poolEnd.mockReset();
    mocks.poolOn.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.loggerDebug.mockReset();

    delete process.env.DATABASE_URL;
    process.env.DB_HOST = 'db.local';

    mocks.poolConnect.mockRejectedValue(new Error('db connect failed'));
    mocks.poolQuery.mockRejectedValue(new Error('query failed'));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('registra contexto quando testConnection, query e health check falham', async () => {
    const db = await import('../../src/config/database');

    const connected = await db.testConnection();
    expect(connected).toBe(false);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        fallback: 'database-connection-failed',
        hasDatabaseUrl: false,
        databaseHost: 'db.local',
      }),
      'Database connection failed',
    );

    await expect(db.query('SELECT 1')).rejects.toThrow('query failed');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'SELECT 1',
        fallback: 'database-query-failed',
      }),
      'Query failed',
    );

    const healthy = await db.checkDatabaseHealth();
    expect(healthy).toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        fallback: 'database-healthcheck-failed',
      }),
      'Database health check failed',
    );
  });
});
