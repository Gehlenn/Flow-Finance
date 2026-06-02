import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
}));

const client = {
  on: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  ping: vi.fn(),
};

vi.mock('redis', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
    info: mocks.loggerInfo,
    debug: vi.fn(),
  },
}));

describe('redis config observability', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    vi.resetModules();
    mocks.createClient.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.loggerInfo.mockReset();
    Object.values(client).forEach((method) => {
      if (typeof method === 'function' && 'mockReset' in method) {
        (method as ReturnType<typeof vi.fn>).mockReset();
      }
    });
    mocks.createClient.mockReturnValue(client as unknown as ReturnType<typeof mocks.createClient>);
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('registra contexto no retry_strategy e no get do cache', async () => {
    client.on.mockImplementation(() => undefined);
    client.get.mockRejectedValueOnce(new Error('cache get failed'));

    const redisModule = await import('../../src/config/redis');

    const retryResult = mocks.createClient.mock.calls[0][0].retry_strategy({
      error: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
      total_retry_time: 1234,
      attempt: 3,
    });

    expect(retryResult).toBeInstanceOf(Error);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'ECONNREFUSED',
        attempt: 3,
        totalRetryTime: 1234,
        fallback: 'redis-connection-refused',
      }),
      'Redis connection refused',
    );

    const value = await redisModule.cache.get('session:test');
    expect(value).toBeNull();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'session:test',
        fallback: 'redis-cache-get-failed',
      }),
      'Cache get error',
    );
  });

  it('registra contexto quando o health check e a inicializacao falham', async () => {
    client.on.mockImplementation(() => undefined);
    client.ping.mockRejectedValueOnce(new Error('redis down'));
    client.connect.mockRejectedValueOnce(new Error('connect failed'));

    const redisModule = await import('../../src/config/redis');

    const healthy = await redisModule.checkRedisHealth();
    expect(healthy).toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'redis://localhost:6379',
        fallback: 'redis-healthcheck-failed',
      }),
      'Redis health check failed',
    );

    await redisModule.initRedis();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'redis://localhost:6379',
        fallback: 'redis-init-failed',
      }),
      'Redis initialization failed - will retry on demand',
    );
  });
});
