import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('../../src/utils/logger', () => ({
  logWarn: loggerMocks.warn,
}));

import { calculateGoalProgress, getGoals } from '../../src/finance/goalService';
import type { FinancialGoal } from '../../models/FinancialGoal';

function makeGoal(overrides: Partial<FinancialGoal> = {}): FinancialGoal {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    name: 'Reserva',
    target_amount: 1000,
    current_amount: 250,
    target_date: '2026-04-10',
    created_at: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('goalService', () => {
  beforeEach(() => {
    loggerMocks.warn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats date-only target dates as local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const progress = calculateGoalProgress(makeGoal());

    expect(progress.days_remaining).toBe(0);
    expect(progress.status).toBe('on_track');
  });

  it('ignores malformed target dates without crashing', () => {
    const progress = calculateGoalProgress(makeGoal({ target_date: 'invalid-date' }));

    expect(progress.days_remaining).toBeNull();
    expect(progress.daily_savings_needed).toBeNull();
    expect(progress.status).toBe('on_track');
  });

  it('logs warning when goals storage is corrupted', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage corrupted');
    });

    expect(getGoals('user-1')).toEqual([]);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      '[GoalService] Failed to read goals storage; returning empty set',
      expect.objectContaining({
        error: expect.any(Error),
        storageKey: 'flow_financial_goals',
      }),
    );

    getItemSpy.mockRestore();
  });
});

