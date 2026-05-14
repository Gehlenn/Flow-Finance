import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const getAIMemoryMock = vi.fn();
const getAIMemorySnapshotMock = vi.fn();
const getAdaptiveLearningStatsMock = vi.fn();
const getFinancialEventsMock = vi.fn();
const logWarnMock = vi.fn();

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

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

describe('AIControlPanel memory error', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
    vi.clearAllMocks();

    getAIMemorySnapshotMock.mockReset().mockReturnValue([]);
    getAdaptiveLearningStatsMock.mockReset().mockReturnValue({
      memory_count: 0,
      pattern_count: 0,
      is_learning: false,
    });
    getFinancialEventsMock.mockReset().mockReturnValue([]);
  });

  it('mostra diagnostico visivel quando a memoria falha ao carregar', async () => {
    getAIMemoryMock.mockRejectedValueOnce(new Error('memory offline'));

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));

    const diagnostic = await screen.findByText(/Falha ao carregar memorias/i);
    const status = diagnostic.closest('[role="status"]');
    expect(status).toBeTruthy();
    expect(within(status as HTMLElement).getByText(/A consulta de memoria da IA nao concluiu agora/i)).toBeTruthy();
    expect(within(status as HTMLElement).getByText(/Proximo passo:/i)).toBeTruthy();
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIControlPanel] Failed to load AI memory',
      expect.objectContaining({
        userId: 'user-1',
        fallback: 'ai-control-panel-memory-load-failed',
      }),
    );
  });
});
