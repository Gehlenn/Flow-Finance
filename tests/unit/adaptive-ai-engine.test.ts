import { describe, expect, it, vi } from 'vitest';
import { getDaysUntilSalaryDay, generateAdaptiveInsights } from '../../src/ai/adaptiveAIEngine';
import * as aiMemory from '../../src/ai/aiMemory';
import { Category, TransactionType } from '../../types';

const mockLogWarn = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: mockLogWarn,
}));

describe('adaptiveAIEngine', () => {
  it('calculates the next salary day using the real calendar length', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00.000Z'));

    expect(getDaysUntilSalaryDay(1)).toBe(1);
    expect(getDaysUntilSalaryDay(30)).toBe(30);
    expect(getDaysUntilSalaryDay(31)).toBe(31);
    expect(getDaysUntilSalaryDay(0)).toBeNull();

    vi.useRealTimers();
  });

  it('renders salary insight with the real next salary day distance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T12:00:00.000Z'));

    const insights = generateAdaptiveInsights(
      [
        { id: 'tx-1', amount: 1000, type: TransactionType.RECEITA, category: Category.NEGOCIO, description: 'Salario', date: '2026-02-01', generated: false, confidence_score: 1, account_id: 'acc-1' },
        { id: 'tx-2', amount: 1000, type: TransactionType.RECEITA, category: Category.NEGOCIO, description: 'Salario', date: '2026-03-01', generated: false, confidence_score: 1, account_id: 'acc-1' },
      ] as never,
      [
        { id: 'm1', user_id: 'user-1', key: 'salary_day', value: '1', confidence: 1, updated_at: '2026-02-28T12:00:00.000Z' },
      ] as never,
      'user-1',
    );

    expect(insights.some((insight) => insight.message.includes('Faltam aproximadamente 1 dia(s).'))).toBe(true);

    vi.useRealTimers();
  });

  it('warns and returns a safe snapshot when adaptive learning stats cannot be read', async () => {
    const { getAdaptiveLearningStats } = await import('../../src/ai/adaptiveAIEngine');
    const snapshotSpy = vi.spyOn(aiMemory, 'getAIMemorySnapshot').mockImplementation(() => {
      throw new Error('storage corrupted');
    });

    const stats = getAdaptiveLearningStats('user-1');

    expect(stats).toEqual({
      is_learning: false,
      pattern_count: 0,
      memory_count: 0,
      last_run: null,
    });
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[AdaptiveAIEngine] Failed to read adaptive learning stats; returning empty snapshot',
      expect.objectContaining({ userId: 'user-1', error: expect.any(Error) }),
    );

    snapshotSpy.mockRestore();
  });
});
