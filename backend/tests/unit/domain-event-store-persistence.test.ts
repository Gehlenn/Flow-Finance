import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

const postgresMocks = vi.hoisted(() => ({
  initializePostgresStateStore: vi.fn(),
  insertDomainEvent: vi.fn(),
  isPostgresStateStoreEnabled: vi.fn(() => false),
  queryDomainEvents: vi.fn(),
}));

const firestoreMocks = vi.hoisted(() => ({
  appendDomainEventToFirestore: vi.fn(),
  getDomainEventFirestoreStatus: vi.fn(),
  queryDomainEventsFromFirestore: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('fs', () => ({
  default: fsMocks,
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
  mkdirSync: fsMocks.mkdirSync,
  writeFileSync: fsMocks.writeFileSync,
  rmSync: fsMocks.rmSync,
}));

vi.mock('../../src/services/persistence/postgresStateStore', () => ({
  initializePostgresStateStore: postgresMocks.initializePostgresStateStore,
  insertDomainEvent: postgresMocks.insertDomainEvent,
  isPostgresStateStoreEnabled: postgresMocks.isPostgresStateStoreEnabled,
  queryDomainEvents: postgresMocks.queryDomainEvents,
}));

vi.mock('../../src/services/finance/eventStoreFirestore', () => ({
  appendDomainEventToFirestore: firestoreMocks.appendDomainEventToFirestore,
  getDomainEventFirestoreStatus: firestoreMocks.getDomainEventFirestoreStatus,
  queryDomainEventsFromFirestore: firestoreMocks.queryDomainEventsFromFirestore,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    error: loggerMocks.error,
    warn: loggerMocks.warn,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('domain event store persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    fsMocks.existsSync.mockReset();
    fsMocks.readFileSync.mockReset();
    fsMocks.mkdirSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.rmSync.mockReset();
    postgresMocks.initializePostgresStateStore.mockReset();
    postgresMocks.insertDomainEvent.mockReset();
    postgresMocks.isPostgresStateStoreEnabled.mockReturnValue(false);
    postgresMocks.queryDomainEvents.mockReset();
    firestoreMocks.appendDomainEventToFirestore.mockReset();
    firestoreMocks.getDomainEventFirestoreStatus.mockReset();
    firestoreMocks.getDomainEventFirestoreStatus.mockResolvedValue({ configured: false, ready: false });
    firestoreMocks.queryDomainEventsFromFirestore.mockReset();
    loggerMocks.error.mockReset();
    loggerMocks.warn.mockReset();
    delete process.env.VERCEL;
    process.env.NODE_ENV = 'test';
  });

  it('uses Firestore as the shared fallback when Postgres is disabled and Firestore is ready', async () => {
    firestoreMocks.getDomainEventFirestoreStatus.mockResolvedValue({ configured: true, ready: true });

    const { appendDomainEvent } = await import('../../src/services/finance/eventStore');

    const event = await appendDomainEvent({
      workspaceId: 'ws-fire',
      type: 'transaction_created',
      occurredAt: '2026-06-12T21:00:00.000Z',
    });

    expect(event.id).toBeDefined();
    expect(firestoreMocks.appendDomainEventToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-fire',
        type: 'transaction_created',
      }),
    );
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled();
  });

  it('marks production legacy-file fallback as unhealthy', async () => {
    process.env.VERCEL = '1';

    const { getDomainEventPersistenceHealthCheck } = await import('../../src/services/finance/eventStore');

    await expect(getDomainEventPersistenceHealthCheck()).resolves.toEqual({
      status: 'unhealthy',
      mode: 'legacy-file',
      durable: false,
      configured: true,
      required: true,
      reason: 'legacy-file-not-accepted-for-production',
    });
  });

  it('rejects writes in production when only legacy-file fallback is available', async () => {
    process.env.VERCEL = '1';

    const { appendDomainEvent } = await import('../../src/services/finance/eventStore');

    await expect(appendDomainEvent({
      workspaceId: 'ws-prod',
      type: 'weekly_cash_review_completed',
      occurredAt: '2026-06-12T21:10:00.000Z',
    })).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 503,
      message: 'Persistencia duravel de eventos indisponivel',
    });

    expect(loggerMocks.error).toHaveBeenCalledWith(
      expect.objectContaining({
        persistence: expect.objectContaining({
          mode: 'legacy-file',
          required: true,
          durable: false,
        }),
        fallback: 'domain-event-store-durable-persistence-required',
      }),
      'Rejected domain event write because durable persistence is unavailable',
    );
  });
});
