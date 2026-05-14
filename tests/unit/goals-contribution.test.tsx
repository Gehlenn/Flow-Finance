import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import GoalsPage from '../../pages/Goals';
import { Category, type Goal } from '../../types';

const goalsLoggerMock = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: goalsLoggerMock.logWarn,
}));

vi.mock('../../src/app/secondaryFlowsCopy', () => ({
  SECONDARY_FLOWS_COPY: {
    goals: {
      title: 'Metas',
      subtitle: 'Acompanhe seus objetivos',
      emptyTitle: 'Sem metas',
      emptyDescription: 'Crie uma meta para começar',
    },
  },
}));

const baseGoal: Goal = {
  id: 'goal-1',
  title: 'Reserva',
  targetAmount: 1000,
  currentAmount: 250,
  deadline: '2026-12-31T00:00:00.000Z',
  category: Category.INVESTIMENTO,
};

describe('Goals contribution modal', () => {
  beforeEach(() => {
    goalsLoggerMock.logWarn.mockReset();
  });

  it('reseta o valor do aporte ao reabrir o modal', () => {
    render(
      <GoalsPage
        goals={[baseGoal]}
        hideValues={false}
        canEditGoals
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aportar/i }));
    const input = screen.getByLabelText(/Valor do aporte/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '150' } });
    expect(input.value).toBe('150');

    fireEvent.click(screen.getByRole('button', { name: /Fechar/i }));

    fireEvent.click(screen.getByRole('button', { name: /Aportar/i }));
    expect((screen.getByLabelText(/Valor do aporte/i) as HTMLInputElement).value).toBe('');
  });

  it('interpreta aporte com separador decimal pt-BR', () => {
    const onContributeGoal = vi.fn();

    render(
      <GoalsPage
        goals={[baseGoal]}
        hideValues={false}
        canEditGoals
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={onContributeGoal}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aportar/i }));
    fireEvent.change(screen.getByLabelText(/Valor do aporte/i), { target: { value: '123,45' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Aporte/i }));

    expect(onContributeGoal).toHaveBeenCalledWith('goal-1', 123.45);
  });

  it('mostra diagnostico visivel quando registrar aporte falha', async () => {
    const onContributeGoal = vi.fn(() => {
      throw new Error('update failed');
    });

    render(
      <GoalsPage
        goals={[baseGoal]}
        hideValues={false}
        canEditGoals
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={onContributeGoal}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aportar/i }));
    fireEvent.change(screen.getByLabelText(/Valor do aporte/i), { target: { value: '123,45' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Aporte/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });

    expect(screen.getByText(/Nao foi possivel registrar o aporte/i)).toBeTruthy();
    expect(goalsLoggerMock.logWarn).toHaveBeenCalledWith(
      '[Goals] Failed to contribute to goal',
      expect.objectContaining({
        fallback: 'goals-contribute-failed',
      }),
    );
  });
});
