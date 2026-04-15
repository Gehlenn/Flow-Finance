import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Assistant, { classifyReminderOperationalState, isFinancialReminder } from '../../components/Assistant';
import { ReminderType, type Reminder } from '../../types';

vi.mock('../../src/config/api.config', () => ({
  API_ENDPOINTS: {
    AI: {
      GENERATE_INSIGHTS: '/api/ai/insights',
    },
  },
  apiRequest: vi.fn(async () => ({
    insights: [{ category: 'NegÃƒÆ’Ã‚Â³cio', threshold: 900, reason: 'PadrÃƒÆ’Ã‚Â£o de gasto recorrente.' }],
  })),
}));

describe('isFinancialReminder', () => {
  const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
    id: 'rem-fin-1',
    title: 'CobranÃƒÆ’Ã‚Â§a',
    date: '2026-04-12T10:00:00.000Z',
    type: ReminderType.NEGOCIO,
    completed: false,
    priority: 'media',
    ...overrides,
  });

  it('classifies reminder with amount > 0 as financial', () => {
    expect(isFinancialReminder(makeReminder({ amount: 300 }))).toBe(true);
  });

  it('classifies reminder with explicit kind=financial as financial (generic field)', () => {
    expect(isFinancialReminder(makeReminder({ kind: 'financial' } as any))).toBe(true);
  });

  it('does not classify clinic-specific fields alone as financial', () => {
    const reminder = makeReminder({ source: 'clinic-automation', external_receivable_id: 'ext-123' } as any);
    expect(isFinancialReminder(reminder)).toBe(false);
  });

  it('classifies reminder with no amount and no kind as operational', () => {
    expect(isFinancialReminder(makeReminder({ amount: undefined }))).toBe(false);
  });
});

describe('assistant reminder states', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');

  const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
    id: 'rem-1',
    title: 'Cobrar cliente',
    date: '2026-04-12T10:00:00.000Z',
    type: ReminderType.NEGOCIO,
    completed: false,
    priority: 'media',
    ...overrides,
  });

  it('classifies canceled metadata and completed reminders as inactive states', () => {
    const canceledReminder = makeReminder({ status: 'canceled' } as any);
    const completedReminder = makeReminder({ id: 'rem-2', completed: true });

    expect(classifyReminderOperationalState(canceledReminder, now)).toBe('canceled');
    expect(classifyReminderOperationalState(completedReminder, now)).toBe('completed');
  });

  it('classifies overdue and active reminders by date', () => {
    const overdueReminder = makeReminder({ date: '2026-04-01T10:00:00.000Z' });
    const activeReminder = makeReminder({ date: '2026-04-11T10:00:00.000Z' });

    expect(classifyReminderOperationalState(overdueReminder, now)).toBe('overdue');
    expect(classifyReminderOperationalState(activeReminder, now)).toBe('active');
  });

  it('shows inactive reminders in a secondary collapsed section', () => {
    render(
      <Assistant
        reminders={[
          makeReminder({ id: 'active-fin', title: 'Receber consulta', amount: 300 }),
          makeReminder({ id: 'overdue-op', title: 'Agendar retorno', date: '2020-01-01T10:00:00.000Z', amount: undefined }),
          makeReminder({ id: 'done-1', title: 'Boleto pago', completed: true }),
        ]}
        alerts={[]}
        goals={[]}
        transactions={[]}
        onToggleComplete={vi.fn()}
        onDeleteReminder={vi.fn()}
        onAddReminder={vi.fn()}
        onUpdateReminder={vi.fn()}
        onSaveAlert={vi.fn()}
        onDeleteAlert={vi.fn()}
        onSaveGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        hideValues={false}
      />,
    );

    expect(screen.getByText(/financeiro 1/i)).toBeTruthy();
    expect(screen.getByText(/operacional 1/i)).toBeTruthy();
    expect(screen.getByText(/agendar retorno/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /concluidos e cancelados/i }));
    expect(screen.getByText(/boleto pago/i)).toBeTruthy();
  });

  it('confirms bulk reminder deletion through modal before removing selected items', () => {
    const onDeleteReminder = vi.fn();

    render(
      <Assistant
        reminders={[
          makeReminder({ id: 'active-fin', title: 'Receber consulta', amount: 300 }),
        ]}
        alerts={[]}
        goals={[]}
        transactions={[]}
        onToggleComplete={vi.fn()}
        onDeleteReminder={onDeleteReminder}
        onAddReminder={vi.fn()}
        onUpdateReminder={vi.fn()}
        onSaveAlert={vi.fn()}
        onDeleteAlert={vi.fn()}
        onSaveGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        hideValues={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /selecionar lembrete/i }));
    fireEvent.click(screen.getByRole('button', { name: /excluir \(1\)/i }));

    expect(screen.getByRole('dialog', { name: /confirmar exclusao/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusao/i }));

    expect(onDeleteReminder).toHaveBeenCalledWith('active-fin');
    expect(onDeleteReminder).toHaveBeenCalledTimes(1);
  });

  it('plano free mostra modal de upgrade ao solicitar sugestoes inteligentes', () => {
    render(
      <Assistant
        reminders={[]}
        alerts={[]}
        goals={[]}
        transactions={[]}
        workspacePlan="free"
        onToggleComplete={vi.fn()}
        onDeleteReminder={vi.fn()}
        onAddReminder={vi.fn()}
        onUpdateReminder={vi.fn()}
        onSaveAlert={vi.fn()}
        onDeleteAlert={vi.fn()}
        onSaveGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        hideValues={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerar sugestoes de limite/i }));

    expect(screen.getByText(/O Free continua com criacao manual de alertas/i)).toBeTruthy();
    expect(screen.getByText(/No Pro voce destrava/i)).toBeTruthy();
  });

  it('plano pro abre sugestoes sem copy de bloqueio de upgrade', async () => {
    render(
      <Assistant
        reminders={[]}
        alerts={[]}
        goals={[]}
        transactions={[]}
        workspacePlan="pro"
        onToggleComplete={vi.fn()}
        onDeleteReminder={vi.fn()}
        onAddReminder={vi.fn()}
        onUpdateReminder={vi.fn()}
        onSaveAlert={vi.fn()}
        onDeleteAlert={vi.fn()}
        onSaveGoal={vi.fn()}
        onDeleteGoal={vi.fn()}
        onUpdateGoal={vi.fn()}
        hideValues={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gerar sugestoes de limite/i }));

    await waitFor(() => {
      expect(screen.queryByText(/No Pro voce destrava/i)).toBeNull();
      expect(screen.getByRole('heading', { name: /Sugestoes de limite/i })).toBeTruthy();
    });
  });
});
