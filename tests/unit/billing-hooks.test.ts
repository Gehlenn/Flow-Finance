import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emitBillingHook,
  getPersistedBillingHooks,
} from '../../src/saas/billingHooks';
import type { BillingHookPayload } from '../../src/saas/types';

describe('billingHooks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters invalid persisted billing hooks on read', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('persists new billing hooks even when localStorage contains invalid legacy data', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
