import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Assistant from '../../components/Assistant';
import { ReminderType, type Reminder } from '../../types';

describe('assistant bulk delete accessibility', () => {
  const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
    id: 'rem-1',
    title: 'Receber consulta',
    date: '2026-04-12T10:00:00.000Z',
    type: ReminderType.NEGOCIO,
    completed: false,
    priority: 'media',
    amount: 300,
    ...overrides,
  });

  it('closes bulk deletion modal on Escape without deleting reminders', () => {
    const onDeleteReminder = vi.fn();

    render(
      <Assistant
        reminders={[makeReminder({ id: 'active-fin' })]}
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

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: /confirmar exclusao/i })).toBeNull();
    expect(onDeleteReminder).not.toHaveBeenCalled();
  });
});
