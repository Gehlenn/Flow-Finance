import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const getAIMemoryMock = vi.fn();
const getAIMemorySnapshotMock = vi.fn();
const getAdaptiveLearningStatsMock = vi.fn();
const getFinancialEventsMock = vi.fn();

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: (...args: unknown[]) => getAIMemoryMock(...args),
  getAIMemorySnapshot: (...args: unknown[]) => getAIMemorySnapshotMock(...args),
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  getAdaptiveLearningStats: (...args: unknown[]) => getAdaptiveLearningStatsMock(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  getFinancialEvents: (...args: unknown[]) => getFinancialEventsMock(...args),
  clearFinancialEvents: vi.fn(),
}));

describe('AIControlPanel memory sorting', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');

    getAIMemorySnapshotMock.mockReset().mockReturnValue([]);
    getAdaptiveLearningStatsMock.mockReset().mockReturnValue({
      memory_count: 2,
      pattern_count: 0,
      is_learning: false,
    });
    getFinancialEventsMock.mockReset().mockReturnValue([]);
  });

  it('does not mutate the memory array returned by the service when sorting', async () => {
    const memorySeed = [
      {
        id: 'mem-1',
        user_id: 'user-1',
        key: 'older',
        value: 'old',
        confidence: 0.8,
        updated_at: '2026-04-01T10:00:00.000Z',
      },
      {
        id: 'mem-2',
        user_id: 'user-1',
        key: 'newer',
        value: 'new',
        confidence: 0.9,
        updated_at: '2026-04-02T10:00:00.000Z',
      },
    ];

    getAIMemoryMock.mockResolvedValueOnce(memorySeed);

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));

    await waitFor(() => {
      expect(screen.getByText('newer')).toBeTruthy();
    });

    expect(memorySeed.map((entry) => entry.id)).toEqual(['mem-1', 'mem-2']);
  });
});
