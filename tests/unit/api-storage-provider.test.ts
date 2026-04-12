import { beforeEach, describe, expect, it, vi } from 'vitest';
// TODO: ApiStorageProvider foi removido na refatoração da camada de storage.
// Esta suite está pulada até que o módulo seja reinstituído ou substituído.
// import { ApiStorageProvider } from '../../src/storage/StorageProvider';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ApiStorageProvider: any = undefined;

describe.skip('ApiStorageProvider (módulo removido — src/storage/StorageProvider não existe)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends auth header, returns null in getUser on error, and throws on deletes without context', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized', json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'acc1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test', 'token-abc');

    await expect(provider.getUser('u1')).resolves.toBeNull();
    await expect(provider.getAccounts('u1')).resolves.toEqual([{ id: 'acc1' }]);
    await provider.saveGoal({
      id: 'goal1',
      userId: 'u1',
      name: 'Meta',
      targetAmount: 500,
      currentAmount: 100,
      targetDate: new Date('2026-12-31T00:00:00.000Z'),
      color: '#fff',
      icon: 'star',
      isCompleted: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    const lastCall = fetchMock.mock.calls[2];
    expect(lastCall[0]).toBe('https://api.flow-finance.test/users/u1/goals/goal1');
    expect(lastCall[1]).toMatchObject({
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token-abc',
        'Content-Type': 'application/json',
      },
    });

    await expect(provider.deleteAccount('acc1')).rejects.toThrow('deleteAccount requires userId context');
    await expect(provider.deleteTransaction('tx1')).rejects.toThrow('deleteTransaction requires userId context');
    await expect(provider.deleteGoal('goal1')).rejects.toThrow('deleteGoal requires userId context');
    await expect(provider.deleteSubscription('sub1')).rejects.toThrow('deleteSubscription requires userId context');
    await expect(provider.deleteBankConnection('bank1')).rejects.toThrow('deleteBankConnection requires userId context');
  });

  it('covers get/save operations for all entities', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ id: 'u1' }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'acc1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'tx1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'goal1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'sub1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ([{ id: 'bank1' }]) })
      .mockResolvedValueOnce({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test', 'token-xyz');

    await expect(provider.getUser('u1')).resolves.toEqual({ id: 'u1' });
    await provider.saveUser({
      id: 'u1',
      email: 'u1@test.dev',
      name: 'User 1',
      subscriptionPlan: {
        id: 'free',
        name: 'free',
        price: 0,
        features: ['dashboard'],
        limits: { transactionsPerMonth: 10, aiQueriesPerMonth: 10, bankConnections: 1 },
      },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await expect(provider.getAccounts('u1')).resolves.toEqual([{ id: 'acc1' }]);
    await provider.saveAccount({ id: 'acc1', userId: 'u1', name: 'Conta', type: 'checking', balance: 10, currency: 'BRL', isActive: true, createdAt: new Date(), updatedAt: new Date() } as any);
    await expect(provider.getTransactions('u1')).resolves.toEqual([{ id: 'tx1' }]);
    await provider.saveTransaction({ id: 'tx1', userId: 'u1', amount: 25, type: 'expense', description: 'Cafe', date: new Date() } as any);
    await expect(provider.getGoals('u1')).resolves.toEqual([{ id: 'goal1' }]);
    await provider.saveGoal({ id: 'goal1', userId: 'u1', name: 'Meta', targetAmount: 100, currentAmount: 10, targetDate: new Date(), color: '#fff', icon: 'star', isCompleted: false, createdAt: new Date(), updatedAt: new Date() } as any);
    await expect(provider.getSubscriptions('u1')).resolves.toEqual([{ id: 'sub1' }]);
    await provider.saveSubscription({ id: 'sub1', userId: 'u1', name: 'Sub', amount: 19.9, cycle: 'monthly', merchant: 'Netflix', lastCharge: new Date(), nextExpected: new Date(), totalSpent: 19.9, isActive: true, createdAt: new Date(), updatedAt: new Date() } as any);
    await expect(provider.getBankConnections('u1')).resolves.toEqual([{ id: 'bank1' }]);
    await provider.saveBankConnection({ id: 'bank1', userId: 'u1', bankName: 'Nubank', bankColor: '#820ad1', connectionStatus: 'connected', balance: 100, createdAt: new Date(), updatedAt: new Date() } as any);

    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('throws on non-ok responses in methods without fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, statusText: 'Server Error' }) as unknown as typeof fetch);
    const provider = new ApiStorageProvider('https://api.flow-finance.test', 'token-xyz');

    await expect(provider.saveTransaction({ id: 'tx1', userId: 'u1', amount: 25, type: 'expense', description: 'Cafe', date: new Date() } as any)).rejects.toThrow('API request failed: Server Error');
  });

  it('does not send Authorization when there is no token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, statusText: 'OK', json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test');
    await provider.saveTransaction({ id: 'tx1', userId: 'u1', amount: 25, type: 'expense', description: 'Cafe', date: new Date() } as any);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect((fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
  });
});
