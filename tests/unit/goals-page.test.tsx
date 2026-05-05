import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import GoalsPage from '../../pages/Goals';
import { Category, type Goal } from '../../types';

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
  deadline: 'not-a-date',
  category: Category.INVESTIMENTO,
};

describe('Goals page', () => {
  it('esconde deadline invalido sem renderizar Invalid Date', () => {
    render(
      <GoalsPage
        goals={[baseGoal]}
        hideValues={false}
        canEditGoals={false}
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={vi.fn()}
      />,
    );

    expect(screen.getByText('Reserva')).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/i)).toBeNull();
    expect(screen.queryByText(/not-a-date/i)).toBeNull();
  });

  it('renderiza deadline YYYY-MM-DD como data local sem deslocar o dia', () => {
    render(
      <GoalsPage
        goals={[
          {
            ...baseGoal,
            deadline: '2026-04-10',
          },
        ]}
        hideValues={false}
        canEditGoals={false}
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={vi.fn()}
      />,
    );

    expect(screen.getByText(/10\/04\/2026/)).toBeTruthy();
  });

  it('mostra erro visivel ao tentar criar meta com valor invalido', async () => {
    const onCreateGoal = vi.fn();

    render(
      <GoalsPage
        goals={[]}
        hideValues={false}
        canEditGoals={true}
        onCreateGoal={onCreateGoal}
        onDeleteGoal={vi.fn()}
        onContributeGoal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova meta/i }));
    fireEvent.change(screen.getByPlaceholderText(/Reserva de Emergência/i), { target: { value: 'Reserva' } });
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Meta/i }));

    expect(onCreateGoal).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/valor alvo valido/i)).toBeTruthy();
    });
  });

  it('limpa o erro de meta quando o usuario corrige o valor', async () => {
    const onCreateGoal = vi.fn();

    render(
      <GoalsPage
        goals={[]}
        hideValues={false}
        canEditGoals={true}
        onCreateGoal={onCreateGoal}
        onDeleteGoal={vi.fn()}
        onContributeGoal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Nova meta/i }));
    fireEvent.change(screen.getByPlaceholderText(/Reserva de Emergência/i), { target: { value: 'Reserva' } });
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Meta/i }));

    expect(screen.getByText(/valor alvo valido/i)).toBeTruthy();

    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '100,00' } });

    await waitFor(() => {
      expect(screen.queryByText(/valor alvo valido/i)).toBeNull();
    });
  });

  it('mostra erro visivel ao tentar aportar valor invalido', async () => {
    const onContributeGoal = vi.fn();

    render(
      <GoalsPage
        goals={[
          {
            ...baseGoal,
            deadline: '2026-04-10',
          },
        ]}
        hideValues={false}
        canEditGoals={true}
        onCreateGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onContributeGoal={onContributeGoal}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Aportar$/i }));
    fireEvent.change(screen.getByLabelText(/Valor do aporte/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Aporte/i }));

    expect(onContributeGoal).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Informe um aporte valido/i)).toBeTruthy();
    });
  });
});
