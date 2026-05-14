import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emitBillingHook,
  getPersistedBillingHooks,
} from '../../src/saas/billingHooks';
import { logWarn } from '../../src/utils/logger';
import type { BillingHookPayload } from '../../src/saas/types';

vi.mock('../../src/utils/logger', () => ({
  logWarn: vi.fn(),
}));

describe('billingHooks', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(logWarn).mockClear();
  });

  it('filters invalid persisted billing hooks on read', () => {
    localStorage.setItem('flow_saas_billing_hooks', JSON.stringify([
      'bad-record',
      {
        userId: 'user-1',
        plan: 'pro',
        event: 'usage_recorded',
        resource: 'transactions',
        amount: 2,
        at: '2026-04-10T12:00:00.000Z',
      },
    ]));

    const hooks = getPersistedBillingHooks();

    expect(hooks).toHaveLength(1);
    expect(hooks[0].userId).toBe('user-1');
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Skipping invalid hook record on read',
      expect.objectContaining({
        entry: 'bad-record',
        fallback: 'billing-hook-invalid-record-read',
      }),
    );
  });

  it('persists new billing hooks even when localStorage contains invalid legacy data', () => {
    localStorage.setItem('flow_saas_billing_hooks', JSON.stringify([
      { broken: true },
    ]));

    const payload: BillingHookPayload = {
      userId: 'user-2',
      plan: 'free',
      event: 'plan_changed',
      resource: 'aiQueries',
      amount: 1,
      at: '2026-04-10T12:00:00.000Z',
    };

    expect(() => emitBillingHook(payload)).not.toThrow();

    const hooks = getPersistedBillingHooks();
    expect(hooks).toHaveLength(1);
    expect(hooks[0]).toMatchObject(payload);
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Dropping invalid hook record',
      expect.objectContaining({
        entry: { broken: true },
        fallback: 'billing-hook-invalid-record-dropped',
      }),
    );
  });

  it('warns and returns empty list when persisted billing hooks JSON is corrupted', () => {
    localStorage.setItem('flow_saas_billing_hooks', '{broken-json');

    const hooks = getPersistedBillingHooks();

    expect(hooks).toEqual([]);
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Failed to read persisted billing hooks; returning empty list',
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'billing-hook-read-failed',
      }),
    );
  });

  it('warns when persisting billing hooks fails', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    const payload: BillingHookPayload = {
      userId: 'user-4',
      plan: 'pro',
      event: 'plan_changed',
      resource: 'billing',
      amount: 1,
      at: '2026-04-10T12:00:00.000Z',
    };

    expect(() => emitBillingHook(payload)).not.toThrow();

    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Failed to persist billing hook payload; ignoring storage write',
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'billing-hook-persist-failed',
      }),
    );

    setItemSpy.mockRestore();
  });

  it('registra contexto quando o transport ou listener falha', async () => {
    const transportError = new Error('transport down');
    const listenerError = new Error('listener down');
    const transport = vi.fn().mockRejectedValueOnce(transportError);
    const unsubscribe = vi.fn();

    const { configureBillingTransport, onBillingHook } = await import('../../src/saas/billingHooks');

    configureBillingTransport(transport);

    const listener = vi.fn(() => {
      throw listenerError;
    });
    const off = onBillingHook(listener);

    const payload: BillingHookPayload = {
      userId: 'user-3',
      plan: 'pro',
      event: 'usage_recorded',
      resource: 'transactions',
      amount: 3,
      at: '2026-04-10T12:00:00.000Z',
    };

    emitBillingHook(payload);
    await Promise.resolve();

    expect(transport).toHaveBeenCalledWith(payload);
    expect(listener).toHaveBeenCalledWith(payload);
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Transport failed',
      expect.objectContaining({
        error: transportError,
        payload,
        fallback: 'billing-hook-transport-failed',
      }),
    );
    expect(vi.mocked(logWarn)).toHaveBeenCalledWith(
      '[BillingHooks] Listener failed',
      expect.objectContaining({
        error: listenerError,
        payload,
        fallback: 'billing-hook-listener-failed',
      }),
    );

    off();
    unsubscribe();
  });
});
