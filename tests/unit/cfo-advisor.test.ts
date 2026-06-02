import { describe, expect, it, vi } from 'vitest';
import { CFOAdvisor } from '../../src/agents/cfo/CFOAdvisor';
import { Category, TransactionType, type Transaction as AppTransaction } from '../../types';
import { AICFOAgent } from '../../src/agents/cfo/AICFOAgent';
import type { Transaction as DomainTransaction } from '../../src/domain/entities';

type AdvisorRepository = {
  getByUser(userId: string): Promise<DomainTransaction[]>;
};

function buildDomainTransaction(
  overrides: Omit<Partial<DomainTransaction>, 'date'> &
    Pick<DomainTransaction, 'id' | 'amount' | 'type' | 'category' | 'description'> & {
      date: string | Date;
    }
): DomainTransaction {
  return {
    userId: 'user-test',
    accountId: 'account-test',
    source: 'test',
    isGenerated: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    merchant: undefined,
    ...overrides,
    date: overrides.date as unknown as Date,
  };
}

function buildInputTransaction(
  overrides: Pick<AppTransaction, 'id' | 'amount' | 'type' | 'category' | 'description' | 'date'> & Partial<AppTransaction>
): AppTransaction {
  return {
    id: overrides.id,
    amount: overrides.amount,
    type: overrides.type,
    category: overrides.category,
    description: overrides.description,
    date: overrides.date,
    generated: false,
    ...overrides,
  };
}

function makeAdvisorRepository(transactions: DomainTransaction[]): AdvisorRepository {
  return {
    getByUser: async () => transactions,
  };
}

describe('CFOAdvisor', () => {
  it('generates a savings plan and negative balance insight', async () => {
    const advisor = new CFOAdvisor();

    const result = await advisor.advise({
      userId: 'user-1',
      transactions: [
        buildInputTransaction({
          id: 't1',
          amount: 2000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Receita mensal',
          date: new Date().toISOString(),
        }),
        buildInputTransaction({
          id: 't2',
          amount: 2500,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Despesas fixas',
          date: new Date().toISOString(),
        }),
      ],
      monthlyIncome: 2000,
      monthlyExpenses: 2500,
      balance: -500,
    });

    expect(result.plan.savingsGoal).toBe(400);
    expect(result.insights.some((i) => i.includes('negativo'))).toBe(true);
    expect(result.autopilotAlerts.some((a) => a.type === 'overspending')).toBe(true);
  });

  it('supports repository-backed flow without transactions in input', async () => {
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 't3',
        amount: 4000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: new Date(),
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);

    const result = await advisor.advise({
      userId: 'user-2',
      monthlyIncome: 4000,
      monthlyExpenses: 2000,
      balance: 2000,
    });

    expect(result.plan.savingsGoal).toBe(800);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it('includes 30 day cashflow forecast insight', async () => {
    const advisor = new CFOAdvisor();

    const result = await advisor.advise({
      userId: 'user-forecast',
      transactions: [
        buildInputTransaction({
          id: 'income-1',
          amount: 6000,
          type: TransactionType.RECEITA,
          category: Category.CONSULTORIO,
          description: 'Receita mensal',
          date: '2026-01-05T00:00:00.000Z',
        }),
        buildInputTransaction({
          id: 'netflix-1',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-01-10T00:00:00.000Z',
        }),
        buildInputTransaction({
          id: 'netflix-2',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-02-10T00:00:00.000Z',
        }),
        buildInputTransaction({
          id: 'netflix-3',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Netflix',
          merchant: 'Netflix',
          date: '2026-03-10T00:00:00.000Z',
        }),
      ],
      monthlyIncome: 6000,
      monthlyExpenses: 1000,
      balance: 5000,
    });

    expect(result.insights.some((insight) => insight.includes('30 dias'))).toBe(true);
  });

  it('normalizes repository transactions with invalid category and Date objects', async () => {
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 'repo-1',
        amount: 450,
        type: 'expense',
        category: 'CATEGORIA_INVALIDA',
        description: 'Despesa legado',
        date: new Date(2026, 2, 10),
        merchant: 'Fornecedor X',
        isGenerated: true,
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);

    const result = await advisor.advise({
      userId: 'user-invalid-category',
      monthlyIncome: 3000,
      monthlyExpenses: 450,
      balance: 2550,
    });

    expect(result.plan.savingsGoal).toBe(600);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it('supports advisory flow without transactions and without repository', async () => {
    const advisor = new CFOAdvisor();

    const result = await advisor.advise({
      userId: 'user-empty',
      monthlyIncome: 1000,
      monthlyExpenses: 400,
      balance: 600,
    });

    expect(result.plan.savingsGoal).toBe(200);
    expect(Array.isArray(result.autopilotAlerts)).toBe(true);
    expect(result.forecast.length).toBeGreaterThan(0);
  });

  it('normalizes repository transactions across all normalization branches', async () => {
    const analyzeSpy = vi.spyOn(AICFOAgent.prototype, 'analyzeFinancialState');
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 'repo-income',
        amount: 3200,
        type: 'income',
        category: Category.CONSULTORIO,
        description: 'Receita consulta',
        date: new Date('2026-03-01T00:00:00.000Z'),
        merchant: 'Clinica A',
        isGenerated: false,
      }),
      buildDomainTransaction({
        id: 'repo-expense',
        amount: 450,
        type: 'expense',
        category: 'CATEGORIA_INVALIDA',
        description: 'Despesa legado',
        date: new Date('2026-03-10T00:00:00.000Z'),
        merchant: 'Fornecedor X',
        isGenerated: true,
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);
    await advisor.advise({
      userId: 'user-normalization-branches',
      monthlyIncome: 3200,
      monthlyExpenses: 450,
      balance: 2750,
    });

    const normalizedTransactions = analyzeSpy.mock.calls.at(-1)?.[0]?.transactions;
    expect(normalizedTransactions?.find((tx) => tx.id === 'repo-income')?.date).toBe('2026-03-01');
    expect(normalizedTransactions?.find((tx) => tx.id === 'repo-expense')?.date).toBe('2026-03-10');
    expect(normalizedTransactions).toEqual([
      expect.objectContaining({ type: TransactionType.RECEITA, category: Category.CONSULTORIO, generated: false }),
      expect.objectContaining({ type: TransactionType.DESPESA, category: Category.PESSOAL, generated: true }),
    ]);

    analyzeSpy.mockRestore();
  });

  it('normalizes repository date-only transactions before advisory analysis', async () => {
    const analyzeSpy = vi.spyOn(AICFOAgent.prototype, 'analyzeFinancialState');
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 'repo-date-only',
        amount: 180,
        type: 'expense',
        category: Category.PESSOAL,
        description: 'Despesa legado',
        date: '2026-03-10',
        merchant: 'Fornecedor X',
        isGenerated: false,
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);
    await advisor.advise({
      userId: 'user-date-only',
      monthlyIncome: 2000,
      monthlyExpenses: 180,
      balance: 1820,
    });

    const normalizedTransactions = analyzeSpy.mock.calls.at(-1)?.[0]?.transactions;
    expect(normalizedTransactions?.[0]?.date).toContain('2026-03-10');

    analyzeSpy.mockRestore();
  });

  it('normalizes invalid repository dates with a fallback timestamp', async () => {
    const analyzeSpy = vi.spyOn(AICFOAgent.prototype, 'analyzeFinancialState');
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 'repo-invalid-date',
        amount: 120,
        type: 'expense',
        category: Category.PESSOAL,
        description: 'Despesa legado',
        date: 'not-a-date',
        merchant: 'Fornecedor X',
        isGenerated: false,
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);
    await advisor.advise({
      userId: 'user-invalid-date-fallback',
      monthlyIncome: 2000,
      monthlyExpenses: 120,
      balance: 1880,
    });

    const normalizedTransactions = analyzeSpy.mock.calls.at(-1)?.[0]?.transactions;
    expect(normalizedTransactions?.[0]?.date).not.toBe('not-a-date');

    analyzeSpy.mockRestore();
  });

  it('prefers explicit transactions over the repository reader', async () => {
    const analyzeSpy = vi.spyOn(AICFOAgent.prototype, 'analyzeFinancialState');
    const repositorySpy = vi.fn(async () => [
      buildDomainTransaction({
        id: 'repo-ignored',
        amount: 999,
        type: 'expense',
        category: Category.PESSOAL,
        description: 'Ignorada',
        date: new Date('2026-03-10T00:00:00.000Z'),
        merchant: 'Fornecedor X',
        isGenerated: false,
      }),
    ]);

    const advisor = new CFOAdvisor({ getByUser: repositorySpy });
    await advisor.advise({
      userId: 'user-explicit-transactions',
      transactions: [],
      monthlyIncome: 1000,
      monthlyExpenses: 400,
      balance: 600,
    });

    expect(repositorySpy).not.toHaveBeenCalled();
    expect(analyzeSpy.mock.calls.at(-1)?.[0]?.transactions).toEqual([]);

    analyzeSpy.mockRestore();
  });

  it('falls back when repository date-only values are invalid', async () => {
    const analyzeSpy = vi.spyOn(AICFOAgent.prototype, 'analyzeFinancialState');
    const fakeRepository = makeAdvisorRepository([
      buildDomainTransaction({
        id: 'repo-invalid-date-only',
        amount: 180,
        type: 'expense',
        category: Category.PESSOAL,
        description: 'Despesa legado',
        date: '2026-02-31',
        merchant: 'Fornecedor X',
        isGenerated: false,
      }),
    ]);

    const advisor = new CFOAdvisor(fakeRepository);
    await advisor.advise({
      userId: 'user-invalid-date-only',
      monthlyIncome: 2000,
      monthlyExpenses: 180,
      balance: 1820,
    });

    const normalizedTransactions = analyzeSpy.mock.calls.at(-1)?.[0]?.transactions;
    expect(normalizedTransactions?.[0]?.date).not.toBe('2026-02-31');

    analyzeSpy.mockRestore();
  });
});


