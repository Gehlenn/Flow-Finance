import { describe, expect, it, vi } from 'vitest';
import { Category, TransactionType } from '../../types';
import { Account } from '../../models/Account';
import {
  contributeGoal,
  createAccount,
  createGoal,
  createTransactions,
  deleteTransactions,
  deleteAccount,
  deleteGoal,
  FinanceServiceContext,
  updateAccount,
  updateGoal,
  updateTransaction,
} from '../../src/app/financeService';

function createContext(overrides?: Partial<FinanceServiceContext>): FinanceServiceContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    collections: {
      accounts: [],
      transactions: [],
      goals: [],
      reminders: [],
      alerts: [],
    },
    syncProfile: vi.fn().mockResolvedValue(undefined),
    syncEntities: vi.fn().mockImplementation(async (updates) => ({
      entities: {
        accounts: updates.accounts || [],
        transactions: updates.transactions || [],
        goals: updates.goals || [],
      },
      idMaps: {},
    })),
    emitTransactionCreated: vi.fn(),
    createId: () => 'generated-id',
    now: () => '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('financeService', () => {
  it('normaliza transacoes e emite evento pelo servico de dominio', async () => {
    const context = createContext({
      syncEntities: vi.fn().mockImplementation(async (updates) => ({
        entities: {
          accounts: updates.accounts || [],
          transactions: (updates.transactions || []).map((transaction) => ({
            ...transaction,
            id: transaction.id === 'generated-id' ? 'server-tx-1' : transaction.id,
          })),
          goals: updates.goals || [],
        },
        idMaps: {
          transactions: {
            'generated-id': 'server-tx-1',
          },
        },
      })),
    });

    const result = await createTransactions([
      {
        amount: 120,
        description: 'Mercado',
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
      },
    ], context);

    expect(result.createdTransactions).toHaveLength(1);
    expect(result.createdTransactions[0].id).toBe('server-tx-1');
    expect(result.createdTransactions[0].date).toBe('2026-04-01T12:00:00.000Z');
    expect(result.createdTransactions[0].user_id).toBe('user-1');
    expect(result.createdTransactions[0].tenant_id).toBe('tenant-1');
    expect(result.createdTransactions[0].workspace_id).toBe('workspace-1');
    expect(context.syncEntities).toHaveBeenCalledWith(
      { transactions: [expect.objectContaining({ id: 'generated-id', tenant_id: 'tenant-1', workspace_id: 'workspace-1' })] },
      { transactions: [] },
    );
    expect(context.emitTransactionCreated).toHaveBeenCalledWith(result.createdTransactions[0]);
  });

  it('nao permite excluir a ultima conta ativa', async () => {
    const account: Account = {
      id: 'acc-1',
      user_id: 'user-1',
      name: 'Carteira',
      type: 'cash',
      balance: 0,
      currency: 'BRL',
      created_at: '2026-04-01T12:00:00.000Z',
    };

    const context = createContext({
      collections: {
        accounts: [account],
        transactions: [],
        goals: [],
        reminders: [],
        alerts: [],
      },
    });

    await expect(deleteAccount('acc-1', context)).rejects.toThrow(/ultima conta ativa/i);
    expect(context.syncEntities).not.toHaveBeenCalled();
  });

  it('bloqueia delete de conta fora do contexto do usuario ativo', async () => {
    const account: Account = {
      id: 'acc-1',
      user_id: 'other-user',
      workspace_id: 'workspace-1',
      name: 'Carteira',
      type: 'cash',
      balance: 0,
      currency: 'BRL',
      created_at: '2026-04-01T12:00:00.000Z',
    };

    const context = createContext({
      collections: {
        accounts: [account, { ...account, id: 'acc-2', user_id: 'user-1' }],
        transactions: [],
        goals: [],
        reminders: [],
        alerts: [],
      },
    });

    await expect(deleteAccount('acc-1', context)).rejects.toThrow(/active user context/i);
  });

  it('normaliza metas e limita aportes ao targetAmount', async () => {
    const createContextInput = createContext();
    const created = await createGoal({
      title: 'Reserva',
      category: Category.INVESTIMENTO,
      targetAmount: 1000,
      currentAmount: 1500,
      deadline: '2026-12-31',
    }, createContextInput);

    expect(created.createdGoal.currentAmount).toBe(1000);
    expect(created.createdGoal.tenant_id).toBe('tenant-1');
    expect(created.createdGoal.workspace_id).toBe('workspace-1');

    const contributionContext = createContext({
      collections: {
        accounts: [],
        transactions: [],
        goals: [created.createdGoal],
        reminders: [],
        alerts: [],
      },
    });

    const nextGoals = await contributeGoal(created.createdGoal.id, 250, contributionContext);
    expect(nextGoals[0].currentAmount).toBe(1000);
  });

  it('cria conta com user_id e sincroniza pela camada de dominio', async () => {
    const context = createContext({
      syncEntities: vi.fn().mockImplementation(async (updates) => ({
        entities: {
          accounts: (updates.accounts || []).map((account) => ({
            ...account,
            id: account.id === 'generated-id' ? 'server-acc-1' : account.id,
          })),
          transactions: updates.transactions || [],
          goals: updates.goals || [],
        },
        idMaps: {
          accounts: {
            'generated-id': 'server-acc-1',
          },
        },
      })),
    });
    const result = await createAccount({
      name: 'Nubank',
      type: 'bank',
      balance: 500,
    }, context);

    expect(result.createdAccount.user_id).toBe('user-1');
    expect(result.createdAccount.tenant_id).toBe('tenant-1');
    expect(result.createdAccount.workspace_id).toBe('workspace-1');
    expect(result.createdAccount.id).toBe('server-acc-1');
    expect(context.syncEntities).toHaveBeenCalledWith(
      { accounts: [expect.objectContaining({ id: 'generated-id', tenant_id: 'tenant-1', workspace_id: 'workspace-1' })] },
      { accounts: [] },
    );
  });

  it('bloqueia delete de transacao fora do workspace ativo', async () => {
    const context = createContext({
      collections: {
        accounts: [],
        transactions: [{
          id: 'tx-1',
          user_id: 'user-1',
          workspace_id: 'workspace-2',
          amount: 15,
          description: 'Cafe',
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          date: '2026-04-01T12:00:00.000Z',
        }],
        goals: [],
        reminders: [],
        alerts: [],
      },
    });

    await expect(deleteTransactions(['tx-1'], context)).rejects.toThrow(/active workspace context/i);
  });

  it('bloqueia delete de meta que nao existe no contexto atual', async () => {
    const context = createContext();
    await expect(deleteGoal('goal-missing', context)).rejects.toThrow(/not found in active context/i);
  });

  it('rejeita update de transacao fora do contexto ativo', async () => {
    const context = createContext({
      collections: {
        accounts: [],
        transactions: [{
          id: 'tx-1',
          user_id: 'other-user',
          workspace_id: 'workspace-1',
          amount: 15,
          description: 'Cafe',
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          date: '2026-04-01T12:00:00.000Z',
        }],
        goals: [],
        reminders: [],
        alerts: [],
      },
    });

    await expect(updateTransaction({
      id: 'tx-1',
      user_id: 'other-user',
      workspace_id: 'workspace-1',
      amount: 20,
      description: 'Cafe atualizado',
      type: TransactionType.DESPESA,
      category: Category.PESSOAL,
      date: '2026-04-01T12:00:00.000Z',
    }, context)).rejects.toThrow(/active user context/i);
  });

  it('forca o escopo ativo ao atualizar conta', async () => {
    const account: Account = {
      id: 'acc-1',
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      workspace_id: 'workspace-1',
      name: 'Conta principal',
      type: 'bank',
      balance: 100,
      currency: 'BRL',
      created_at: '2026-04-01T12:00:00.000Z',
    };

    const syncEntities = vi.fn().mockImplementation(async (updates) => ({
      entities: {
        accounts: updates.accounts || [],
        transactions: updates.transactions || [],
        goals: updates.goals || [],
      },
      idMaps: {},
    }));

    const context = createContext({
      collections: {
        accounts: [account, { ...account, id: 'acc-2', name: 'Reserva' }],
        transactions: [],
        goals: [],
        reminders: [],
        alerts: [],
      },
      syncEntities,
    });

    await updateAccount({
      ...account,
      user_id: 'other-user',
      tenant_id: 'tenant-x',
      workspace_id: 'workspace-x',
      balance: 150,
    }, context);

    expect(syncEntities).toHaveBeenCalledWith(
      {
        accounts: [
          expect.objectContaining({
            id: 'acc-1',
            user_id: 'user-1',
            tenant_id: 'tenant-1',
            workspace_id: 'workspace-1',
            balance: 150,
          }),
          expect.any(Object),
        ],
      },
      { accounts: context.collections.accounts },
    );
  });

  it('rejeita update de meta inexistente no contexto atual', async () => {
    const context = createContext();

    await expect(updateGoal({
      id: 'goal-missing',
      title: 'Meta ausente',
      category: Category.INVESTIMENTO,
      targetAmount: 1000,
      currentAmount: 100,
    }, context)).rejects.toThrow(/not found in active context/i);
  });
});
