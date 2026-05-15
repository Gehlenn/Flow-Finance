import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  insertDomainEvent: vi.fn(),
  queryDomainEvents: vi.fn(),
  isPostgresStateStoreEnabled: vi.fn(() => false),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
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
  insertDomainEvent: serviceMocks.insertDomainEvent,
  queryDomainEvents: serviceMocks.queryDomainEvents,
  isPostgresStateStoreEnabled: serviceMocks.isPostgresStateStoreEnabled,
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: serviceMocks.loggerWarn,
    error: serviceMocks.loggerError,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('eventStore observability', () => {
  const originalDomainEventStoreFile = process.env.DOMAIN_EVENT_STORE_FILE;

  beforeEach(() => {
    vi.resetModules();
    fsMocks.existsSync.mockReset();
    fsMocks.readFileSync.mockReset();
    fsMocks.mkdirSync.mockReset();
    fsMocks.writeFileSync.mockReset();
    fsMocks.rmSync.mockReset();
    serviceMocks.insertDomainEvent.mockReset();
    serviceMocks.queryDomainEvents.mockReset();
    serviceMocks.isPostgresStateStoreEnabled.mockReturnValue(false);
    serviceMocks.loggerWarn.mockReset();
    serviceMocks.loggerError.mockReset();
    process.env.DOMAIN_EVENT_STORE_FILE = 'C:/tmp/domain-events-observability.json';
  });

  afterEach(() => {
    if (originalDomainEventStoreFile === undefined) {
      delete process.env.DOMAIN_EVENT_STORE_FILE;
    } else {
      process.env.DOMAIN_EVENT_STORE_FILE = originalDomainEventStoreFile;
    }
  });

  it('registra contexto quando a carga local falha', async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValueOnce('not-json');

    const { appendDomainEvent } = await import('../../src/services/finance/eventStore');

    fsMocks.writeFileSync.mockImplementation(() => undefined);

    await appendDomainEvent({
      workspaceId: 'workspace-1',
      type: 'test.event',
      occurredAt: '2026-05-10T00:00:00.000Z',
    });

    expect(serviceMocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'C:/tmp/domain-events-observability.json',
        fallback: 'domain-event-store-load-failed',
      }),
      'Failed to load domain event store, starting empty',
    );
  });

  it('registra contexto quando a persistencia local falha', async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValueOnce(JSON.stringify({ events: [] }));
    fsMocks.writeFileSync.mockImplementation(() => {
      throw new Error('domain event persist failed');
    });

    const { appendDomainEvent } = await import('../../src/services/finance/eventStore');

    await expect(appendDomainEvent({
      workspaceId: 'workspace-1',
      type: 'test.event',
      occurredAt: '2026-05-10T00:00:00.000Z',
    })).rejects.toThrow('domain event persist failed');

    expect(serviceMocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'C:/tmp/domain-events-observability.json',
        eventCount: 1,
        fallback: 'domain-event-store-persist-failed',
      }),
      'Failed to persist domain event store',
    );
  });

  it('persiste o event store local sem emitir warn quando o arquivo grava normalmente', async () => {
    fsMocks.existsSync.mockReturnValue(true);
    fsMocks.readFileSync.mockReturnValueOnce(JSON.stringify({ events: [] }));
    fsMocks.writeFileSync.mockImplementation(() => undefined);

    const { appendDomainEvent, getDomainEvents } = await import('../../src/services/finance/eventStore');

    const persisted = await appendDomainEvent({
      workspaceId: 'workspace-1',
      type: 'test.event',
      occurredAt: '2026-05-10T00:00:00.000Z',
    });

    expect(persisted.id).toBeDefined();
    expect(serviceMocks.loggerWarn).not.toHaveBeenCalled();
    expect(serviceMocks.loggerError).not.toHaveBeenCalled();
    expect(fsMocks.writeFileSync).toHaveBeenCalledTimes(1);
    await expect(getDomainEvents({
      workspaceId: 'workspace-1',
    })).resolves.toEqual([
      expect.objectContaining({
        workspaceId: 'workspace-1',
        type: 'test.event',
      }),
    ]);
  });
});
