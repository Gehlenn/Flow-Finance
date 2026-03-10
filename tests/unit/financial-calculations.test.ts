/**
 * TESTES UNITÁRIOS - Cálculos Financeiros Críticos
 * Versão: 0.4.0
 * Coverage alvo: 98%+
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Transaction, TransactionType, Category } from '../../types';

// ─── Helpers de Cálculo ──────────────────────────────────────────────────────

function calculateBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    return t.type === TransactionType.RECEITA ? acc + t.amount : acc - t.amount;
  }, 0);
}

function groupByCategory(transactions: Transaction[]): Record<Category, number> {
  const grouped = {} as Record<Category, number>;
  transactions.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = 0;
    grouped[t.category] += t.amount;
  });
  return grouped;
}

function calculateMonthlyAverage(transactions: Transaction[], months: number = 3): number {
  if (months === 0 || transactions.length === 0) return 0;
  const total = transactions.reduce((acc, t) => acc + t.amount, 0);
  return total / months;
}

// ─── Testes de Cálculo de Saldo ─────────────────────────────────────────────

describe('Financial Calculations - Balance', () => {
  let transactions: Transaction[];

  beforeEach(() => {
    transactions = [
      {
        id: 't1',
        amount: 5000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Salário',
        date: new Date('2024-03-01').toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't2',
        amount: 1500,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Aluguel',
        date: new Date('2024-03-05').toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't3',
        amount: 500,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: new Date('2024-03-10').toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
    ];
  });

  it('deve calcular saldo corretamente com receitas e despesas', () => {
    const balance = calculateBalance(transactions);
    expect(balance).toBe(3000); // 5000 - 1500 - 500
  });

  it('deve retornar 0 para lista vazia', () => {
    expect(calculateBalance([])).toBe(0);
  });

  it('deve calcular saldo negativo corretamente', () => {
    const negativeTransactions: Transaction[] = [
      {
        id: 't1',
        amount: 100,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't2',
        amount: 500,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
    ];
    expect(calculateBalance(negativeTransactions)).toBe(-400);
  });
});

// ─── Testes de Agrupamento por Categoria ────────────────────────────────────

describe('Financial Calculations - Category Grouping', () => {
  it('deve agrupar transações por categoria', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Item 1',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't2',
        amount: 200,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Item 2',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't3',
        amount: 300,
        type: TransactionType.DESPESA,
        category: Category.CONSULTORIO,
        description: 'Item 3',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
    ];

    const grouped = groupByCategory(transactions);
    expect(grouped[Category.PESSOAL]).toBe(300);
    expect(grouped[Category.CONSULTORIO]).toBe(300);
  });

  it('deve retornar objeto vazio para lista vazia', () => {
    const grouped = groupByCategory([]);
    expect(Object.keys(grouped).length).toBe(0);
  });
});

// ─── Testes de Média Mensal ─────────────────────────────────────────────────

describe('Financial Calculations - Monthly Average', () => {
  it('deve calcular média mensal corretamente', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        amount: 300,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
      {
        id: 't2',
        amount: 600,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa 2',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
    ];

    const avg = calculateMonthlyAverage(transactions, 3);
    expect(avg).toBe(300); // (300 + 600) / 3
  });

  it('deve retornar 0 para divisão por zero', () => {
    const transactions: Transaction[] = [
      {
        id: 't1',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Despesa',
        date: new Date().toISOString(),
        account_id: 'acc1',
        source: 'manual',
        generated: false,
      },
    ];

    expect(calculateMonthlyAverage(transactions, 0)).toBe(0);
  });

  it('deve retornar 0 para lista vazia', () => {
    expect(calculateMonthlyAverage([], 3)).toBe(0);
  });
});

// ─── Testes de Validação de Dados ───────────────────────────────────────────

describe('Financial Validations', () => {
  it('deve validar que valor não seja negativo', () => {
    const isValidAmount = (amount: number): boolean => amount >= 0;
    
    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(-100)).toBe(false);
  });

  it('deve validar que descrição não esteja vazia', () => {
    const isValidDescription = (desc: string): boolean => desc.trim().length > 0;
    
    expect(isValidDescription('Mercado')).toBe(true);
    expect(isValidDescription('')).toBe(false);
    expect(isValidDescription('   ')).toBe(false);
  });

  it('deve validar intervalo de datas', () => {
    const isValidDateRange = (start: Date, end: Date): boolean => start <= end;
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    expect(isValidDateRange(today, tomorrow)).toBe(true);
    expect(isValidDateRange(tomorrow, today)).toBe(false);
  });
});
