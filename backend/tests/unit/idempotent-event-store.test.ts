import { describe, it, expect, vi } from 'vitest';

import { IdempotentEventStore, type RedisLike } from '../../src/services/clinic/IdempotentEventStore';

describe('IdempotentEventStore atomic idempotency', () => {
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
    expect((redis as any).get).not.toHaveBeenCalled();
    expect((redis as any).setEx).not.toHaveBeenCalled();
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
    expect((redis as any).get).not.toHaveBeenCalled();
    expect((redis as any).setEx).not.toHaveBeenCalled();
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
    expect((redis as any).get).toHaveBeenCalled();
    expect((redis as any).setEx).toHaveBeenCalled();
  });
});
