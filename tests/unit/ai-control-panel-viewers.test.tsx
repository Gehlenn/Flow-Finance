import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AIControlPanel } from '../../src/debug/aiPanel/AIControlPanel';
import { aiMemoryStore } from '../../src/ai/memory/AIMemoryStore';
import { AIMemoryType } from '../../src/ai/memory/memoryTypes';
import { taskStore } from '../../src/ai/queue/taskStore';
import { AITaskPriority, AITaskStatus, AITaskType } from '../../src/ai/queue/taskTypes';
import { runAIOrchestrator } from '../../src/engines/ai/aiOrchestrator';
import { Category, TransactionType, type Transaction } from '../../types';

function tx(input: Transaction): Transaction {
  return input;
}

describe('AIControlPanel viewers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    aiMemoryStore.clear();
    taskStore.clear();
  });

  it('nao renderiza painel quando modo debug esta desabilitado', () => {
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '');

    const { container } = render(<AIControlPanel />);

    expect(container.firstChild).toBeNull();
  });

  it('renderiza viewers internos com memoria, fila, money map e previsoes', async () => {
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');

    aiMemoryStore.save({
      userId: 'u_panel',
      type: AIMemoryType.SPENDING_PATTERN,
      key: 'category_dominance',
      value: {
        category: Category.PESSOAL,
        percentage: 84,
      },
      confidence: 0.82,
      strength: 67,
      metadata: {
        confidenceBand: 'high',
      },
    });

    taskStore.addTask({
      id: 'task-panel-1',
      type: AITaskType.INSIGHT_GENERATION,
      payload: {
        source: 'unit-test',
      },
      status: AITaskStatus.PENDING,
      priority: AITaskPriority.HIGH,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 2,
      userId: 'u_panel',
    });

    const transactions: Transaction[] = [
      tx({
        id: 'income_1',
        amount: 7000,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-01-05T10:00:00.000Z',
      }),
      tx({
        id: 'income_2',
        amount: 6900,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-02-05T10:00:00.000Z',
      }),
      tx({
        id: 'income_3',
        amount: 7050,
        type: TransactionType.RECEITA,
        category: Category.CONSULTORIO,
        description: 'Receita',
        date: '2026-03-05T10:00:00.000Z',
      }),
      tx({
        id: 'expense_1',
        amount: 1500,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        merchant: 'Mercado Central',
        date: '2026-01-10T10:00:00.000Z',
      }),
      tx({
        id: 'expense_2',
        amount: 1400,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        merchant: 'Mercado Central',
        date: '2026-02-10T10:00:00.000Z',
      }),
      tx({
        id: 'expense_3',
        amount: 1600,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        merchant: 'Mercado Central',
        date: '2026-03-10T10:00:00.000Z',
      }),
      tx({
        id: 'expense_4',
        amount: 250,
        type: TransactionType.DESPESA,
        category: Category.NEGOCIO,
        description: 'Uber',
        merchant: 'Uber',
        date: '2026-03-12T10:00:00.000Z',
      }),
    ];

    await runAIOrchestrator({
      userContext: {
        userId: 'u_panel',
        accounts: ['acc_main'],
        timezone: 'UTC',
        currency: 'BRL',
      },
      transactions,
    });

    render(<AIControlPanel />);

    expect(screen.getByRole('heading', { name: 'AI Control Panel' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'AI Memory' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Detected Patterns' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Money Map' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'AI Task Queue' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'AI Insights' })).toBeTruthy();

    expect(screen.getByText(/category_dominance/i)).toBeTruthy();
    expect(screen.getByText(/INSIGHT_GENERATION/i)).toBeTruthy();
    expect(screen.getAllByText(/Pessoal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/in30Days/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/u_panel/i).length).toBeGreaterThan(0);
  });
});
