import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiStorageProvider, LocalStorageProvider } from '../../src/storage/StorageProvider';

describe('StorageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('LocalStorageProvider persiste user, account, goal, subscription e bank connection', async () => {
    const provider = new LocalStorageProvider();

    await provider.saveUser({
      id: 'u1',
      email: 'u1@test.dev',
      name: 'User 1',
      subscriptionPlan: {
        id: 'free',
        name: 'free',
        price: 0,
        features: ['dashboard'],
        limits: { transactionsPerMonth: 100, aiQueriesPerMonth: 10, bankConnections: 1 },
      },
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await provider.saveAccount({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta Principal',
      type: 'checking',
      balance: 1000,
      currency: 'BRL',
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await provider.saveGoal({
      id: 'goal1',
      userId: 'u1',
      name: 'Reserva',
      targetAmount: 5000,
      currentAmount: 800,
      targetDate: new Date('2026-12-31T00:00:00.000Z'),
      color: '#00ff00',
      icon: 'target',
      isCompleted: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await provider.saveSubscription({
      id: 'sub1',
      userId: 'u1',
      name: 'Netflix',
      amount: 39.9,
      cycle: 'monthly',
      merchant: 'Netflix',
      lastCharge: new Date('2026-03-01T00:00:00.000Z'),
      nextExpected: new Date('2026-04-01T00:00:00.000Z'),
      totalSpent: 200,
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    await provider.saveBankConnection({
      id: 'bank1',
      userId: 'u1',
      bankName: 'Nubank',
      bankColor: '#8A05BE',
      connectionStatus: 'connected',
      balance: 1500,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(await provider.getUser('u1')).toMatchObject({ id: 'u1', email: 'u1@test.dev' });
    expect(await provider.getAccounts('u1')).toHaveLength(1);
    expect(await provider.getGoals('u1')).toHaveLength(1);
    expect(await provider.getSubscriptions('u1')).toHaveLength(1);
    expect(await provider.getBankConnections('u1')).toHaveLength(1);
  });

  it('LocalStorageProvider atualiza registros existentes e tolera JSON invalido', async () => {
    const provider = new LocalStorageProvider();
    localStorage.setItem('flow_accounts_u1', '{invalido');

    expect(await provider.getAccounts('u1')).toEqual([]);

    await provider.saveAccount({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta A',
      type: 'checking',
      balance: 100,
      currency: 'BRL',
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    await provider.saveAccount({
      id: 'acc1',
      userId: 'u1',
      name: 'Conta Atualizada',
      type: 'checking',
      balance: 250,
      currency: 'BRL',
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    });

    const accounts = await provider.getAccounts('u1');
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ name: 'Conta Atualizada', balance: 250 });
  });

  it('LocalStorageProvider tolera JSON invalido para todas as colecoes e user', async () => {
    const provider = new LocalStorageProvider();

    localStorage.setItem('flow_user_u1', '{invalido');
    localStorage.setItem('flow_transactions_u1', '{invalido');
    localStorage.setItem('flow_goals_u1', '{invalido');
    localStorage.setItem('flow_subscriptions_u1', '{invalido');
    localStorage.setItem('flow_bank_connections_u1', '{invalido');

    await expect(provider.getUser('u1')).resolves.toBeNull();
    await expect(provider.getTransactions('u1')).resolves.toEqual([]);
    await expect(provider.getGoals('u1')).resolves.toEqual([]);
    await expect(provider.getSubscriptions('u1')).resolves.toEqual([]);
    await expect(provider.getBankConnections('u1')).resolves.toEqual([]);
  });

  it('LocalStorageProvider retorna null quando user nao existe', async () => {
    const provider = new LocalStorageProvider();
    await expect(provider.getUser('missing-user')).resolves.toBeNull();
  });

  it('LocalStorageProvider atualiza transaction, goal, subscription e bank connection existentes', async () => {
    const provider = new LocalStorageProvider();

    await provider.saveTransaction({ id: 'tx1', userId: 'u1', amount: 10, type: 'expense', description: 'Cafe', date: new Date('2026-03-01T00:00:00.000Z') } as any);
    await provider.saveTransaction({ id: 'tx1', userId: 'u1', amount: 25, type: 'expense', description: 'Cafe atualizado', date: new Date('2026-03-02T00:00:00.000Z') } as any);

    await provider.saveGoal({ id: 'goal1', userId: 'u1', name: 'Meta', targetAmount: 1000, currentAmount: 100, targetDate: new Date('2026-12-31T00:00:00.000Z'), color: '#fff', icon: 'star', isCompleted: false, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-01T00:00:00.000Z') } as any);
    await provider.saveGoal({ id: 'goal1', userId: 'u1', name: 'Meta atualizada', targetAmount: 1500, currentAmount: 250, targetDate: new Date('2026-12-31T00:00:00.000Z'), color: '#000', icon: 'target', isCompleted: false, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-02T00:00:00.000Z') } as any);

    await provider.saveSubscription({ id: 'sub1', userId: 'u1', name: 'Netflix', amount: 39.9, cycle: 'monthly', merchant: 'Netflix', lastCharge: new Date('2026-03-01T00:00:00.000Z'), nextExpected: new Date('2026-04-01T00:00:00.000Z'), totalSpent: 200, isActive: true, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-01T00:00:00.000Z') } as any);
    await provider.saveSubscription({ id: 'sub1', userId: 'u1', name: 'Netflix Premium', amount: 59.9, cycle: 'monthly', merchant: 'Netflix', lastCharge: new Date('2026-03-05T00:00:00.000Z'), nextExpected: new Date('2026-04-05T00:00:00.000Z'), totalSpent: 260, isActive: true, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-05T00:00:00.000Z') } as any);

    await provider.saveBankConnection({ id: 'bank1', userId: 'u1', bankName: 'Nubank', bankColor: '#8A05BE', connectionStatus: 'connected', balance: 100, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-01T00:00:00.000Z') } as any);
    await provider.saveBankConnection({ id: 'bank1', userId: 'u1', bankName: 'Nubank Atualizado', bankColor: '#111111', connectionStatus: 'error', balance: 50, createdAt: new Date('2026-03-01T00:00:00.000Z'), updatedAt: new Date('2026-03-02T00:00:00.000Z') } as any);

    await expect(provider.getTransactions('u1')).resolves.toEqual([
      expect.objectContaining({ id: 'tx1', amount: 25, description: 'Cafe atualizado' }),
    ]);
    await expect(provider.getGoals('u1')).resolves.toEqual([
      expect.objectContaining({ id: 'goal1', name: 'Meta atualizada', currentAmount: 250 }),
    ]);
    await expect(provider.getSubscriptions('u1')).resolves.toEqual([
      expect.objectContaining({ id: 'sub1', name: 'Netflix Premium', amount: 59.9 }),
    ]);
    await expect(provider.getBankConnections('u1')).resolves.toEqual([
      expect.objectContaining({ id: 'bank1', bankName: 'Nubank Atualizado', connectionStatus: 'error' }),
    ]);
  });

  it('ApiStorageProvider envia auth header, retorna null em getUser com erro e lanca nos deletes sem contexto', async () => {
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

  it('LocalStorageProvider warns on delete* methods not implemented', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = new LocalStorageProvider();

    await provider.deleteAccount('acc1');
    await provider.deleteTransaction('tx1');
    await provider.deleteGoal('goal1');
    await provider.deleteSubscription('sub1');
    await provider.deleteBankConnection('bank1');

    expect(warnSpy).toHaveBeenCalledTimes(5);
    warnSpy.mockRestore();
  });

  it('ApiStorageProvider covers get/save operations for all entities', async () => {
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
    await expect(
      provider.saveUser({
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
      } as any)
    ).resolves.toBeUndefined();

    await expect(provider.getAccounts('u1')).resolves.toEqual([{ id: 'acc1' }]);
    await provider.saveAccount({ id: 'acc1', userId: 'u1' } as any);

    await expect(provider.getTransactions('u1')).resolves.toEqual([{ id: 'tx1' }]);
    await provider.saveTransaction({ id: 'tx1', userId: 'u1' } as any);

    await expect(provider.getGoals('u1')).resolves.toEqual([{ id: 'goal1' }]);
    await provider.saveGoal({ id: 'goal1', userId: 'u1' } as any);

    await expect(provider.getSubscriptions('u1')).resolves.toEqual([{ id: 'sub1' }]);
    await provider.saveSubscription({ id: 'sub1', userId: 'u1' } as any);

    await expect(provider.getBankConnections('u1')).resolves.toEqual([{ id: 'bank1' }]);
    await provider.saveBankConnection({ id: 'bank1', userId: 'u1' } as any);

    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('ApiStorageProvider throws on non-ok responses in methods without fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, statusText: 'Server Error', json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test', 'token-xyz');

    await expect(provider.getAccounts('u1')).rejects.toThrow('API request failed: Server Error');
    await expect(provider.getTransactions('u1')).rejects.toThrow('API request failed: Server Error');
    await expect(provider.getGoals('u1')).rejects.toThrow('API request failed: Server Error');
    await expect(provider.getSubscriptions('u1')).rejects.toThrow('API request failed: Server Error');
    await expect(provider.getBankConnections('u1')).rejects.toThrow('API request failed: Server Error');
  });

  it('ApiStorageProvider nao envia Authorization quando nao ha token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, statusText: 'OK', json: async () => ({ id: 'u-no-auth' }) });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const provider = new ApiStorageProvider('https://api.flow-finance.test');

    await expect(provider.getUser('u-no-auth')).resolves.toEqual({ id: 'u-no-auth' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.flow-finance.test/users/u-no-auth', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});