import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IdempotentEventStore, type RedisLike } from '../../src/services/clinic/IdempotentEventStore';

const { mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));
const { mockError } = vi.hoisted(() => ({
  mockError: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mockWarn,
    info: vi.fn(),
    error: mockError,
  },
}));

describe('IdempotentEventStore atomic idempotency', () => {
  beforeEach(() => {
    mockWarn.mockClear();
  });

  function basePayload() {
    return {
      type: 'payment_received',
      externalEventId: 'evt_123',
      amount: 100,
      currency: 'BRL',
    };
  }

  it('uses atomic Redis SET NX/EX and returns true when key is newly set', async () => {
    const setMock = vi.fn().mockResolvedValue('OK');

    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: setMock,
      setEx: vi.fn(),
      exists: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      ttl: vi.fn(),
      ping: vi.fn(),
    } as unknown as RedisLike;

    const store = new IdempotentEventStore(redis);
    const result = await store.recordProcessed('clinic-automation', 'evt_123', 'int_001', 'success', {
      payloadHash: store.generatePayloadHash(basePayload()),
    });

    expect(result).toBe(true);
    expect(setMock).toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setEx).not.toHaveBeenCalled();
  });

  it('uses atomic Redis SET NX/EX and returns false for duplicate key', async () => {
    const setMock = vi.fn().mockResolvedValue(null);

    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: setMock,
      setEx: vi.fn(),
      exists: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      ttl: vi.fn(),
      ping: vi.fn(),
    } as unknown as RedisLike;

    const store = new IdempotentEventStore(redis);
    const result = await store.recordProcessed('clinic-automation', 'evt_123', 'int_001', 'success');

    expect(result).toBe(false);
    expect(setMock).toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setEx).not.toHaveBeenCalled();
  });

  it('falls back to get+setEx when atomic SET mode is unavailable', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('unsupported options')),
      setEx: vi.fn().mockResolvedValue('OK'),
      exists: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      ttl: vi.fn(),
      ping: vi.fn(),
    } as unknown as RedisLike;

    const store = new IdempotentEventStore(redis);
    const result = await store.recordProcessed('clinic-automation', 'evt_999', 'int_009', 'success');

    expect(result).toBe(true);
    expect(redis.get).toHaveBeenCalled();
    expect(redis.setEx).toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('idempotent:clinic-automation:evt_999'),
        error: expect.any(Error),
        ttlSeconds: expect.any(Number),
        fallback: 'idempotent-event-atomic-set-failed',
      }),
      'Atomic Redis SET NX/EX failed, trying positional fallback'
    );
  });

  it('registra aviso e ignora payload invalido ao listar eventos processados', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('{"invalid-json"'),
      set: vi.fn(),
      setEx: vi.fn(),
      exists: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue(['idempotent:clinic-automation:evt_bad']),
      ttl: vi.fn(),
      ping: vi.fn(),
    } as unknown as RedisLike;

    const store = new IdempotentEventStore(redis);
    const result = await store.listProcessedBySource('clinic-automation');

    expect(result).toEqual([]);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idempotent:clinic-automation:evt_bad',
        error: expect.any(Error),
        sourceSystem: 'clinic-automation',
        fallback: 'idempotent-event-list-parse-failed',
      }),
      'Ignoring invalid idempotent record payload'
    );
  });

  it('registra erro ao parsear um registro individual corrompido', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('{"invalid-json"'),
      set: vi.fn(),
      setEx: vi.fn(),
      exists: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      ttl: vi.fn(),
      ping: vi.fn(),
    } as unknown as RedisLike;

    const store = new IdempotentEventStore(redis);
    const record = await store.getProcessedRecord('clinic-automation', 'evt_bad');

    expect(record).toBeNull();
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'idempotent:clinic-automation:evt_bad',
        error: expect.any(Error),
        fallback: 'idempotent-event-parse-failed',
      }),
      'Failed to parse stored record'
    );
  });
});
