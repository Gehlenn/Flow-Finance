import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isPostgresStateStoreEnabled: vi.fn(),
  initializePostgresStateStore: vi.fn(),
  getDomainEventFirestoreStatus: vi.fn(),
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  isPostgresStateStoreEnabled: mocks.isPostgresStateStoreEnabled,
  initializePostgresStateStore: mocks.initializePostgresStateStore,
}));

vi.mock('../../src/services/finance/eventStoreFirestore', () => ({
  getDomainEventFirestoreStatus: mocks.getDomainEventFirestoreStatus,
}));

describe('domain event persistence health helper', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL;
  const originalPostgresEnabled = process.env.POSTGRES_STATE_STORE_ENABLED;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    mocks.isPostgresStateStoreEnabled.mockReset();
    mocks.initializePostgresStateStore.mockReset();
    mocks.getDomainEventFirestoreStatus.mockReset();
    mocks.isPostgresStateStoreEnabled.mockReturnValue(false);
    mocks.initializePostgresStateStore.mockResolvedValue(false);
    mocks.getDomainEventFirestoreStatus.mockResolvedValue({ configured: false, ready: false });
    process.env.POSTGRES_STATE_STORE_ENABLED = 'false';
    process.env.JWT_SECRET = 'test-jwt-secret-with-32-characters-minimum';
    delete process.env.VERCEL;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalPostgresEnabled === undefined) {
      delete process.env.POSTGRES_STATE_STORE_ENABLED;
    } else {
      process.env.POSTGRES_STATE_STORE_ENABLED = originalPostgresEnabled;
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('reports local domain-event persistence as durable when production is not requiring it', async () => {
    process.env.NODE_ENV = 'test';

    const eventStore = (await import('../../src/services/finance/eventStore')) as Record<string, any>;
    const helper =
      eventStore.getDomainEventPersistenceHealthCheck ||
      eventStore.getDomainEventStoreHealthCheck;

    expect(helper).toBeTypeOf('function');

    const health = await helper();

    expect(health).toEqual(expect.objectContaining({
      status: 'healthy',
      required: false,
      durable: true,
    }));
    expect(health.mode).toBeDefined();
    expect(typeof health.reason).toBe('string');
  });

  it('reports production domain-event persistence as unhealthy when no durable store is available', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';

    const eventStore = (await import('../../src/services/finance/eventStore')) as Record<string, any>;
    const helper =
      eventStore.getDomainEventPersistenceHealthCheck ||
      eventStore.getDomainEventStoreHealthCheck;

    expect(helper).toBeTypeOf('function');

    const health = await helper();

    expect(health).toEqual(expect.objectContaining({
      status: 'unhealthy',
      required: true,
      durable: false,
    }));
    expect(health.mode).toBeDefined();
    expect(typeof health.reason).toBe('string');
  });
});
