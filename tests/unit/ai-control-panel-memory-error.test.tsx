import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AIControlPanel from '../../pages/AIControlPanel';

const aiControlPanelMocks = vi.hoisted(() => ({
  getAIMemory: vi.fn(),
  getAIMemorySnapshot: vi.fn(),
  getAdaptiveLearningStats: vi.fn(),
  getFinancialEvents: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../../src/ai/aiMemory', () => ({
  getAIMemory: (...args: unknown[]) => aiControlPanelMocks.getAIMemory(...args),
  getAIMemorySnapshot: (...args: unknown[]) => aiControlPanelMocks.getAIMemorySnapshot(...args),
}));

vi.mock('../../src/ai/adaptiveAIEngine', () => ({
  getAdaptiveLearningStats: (...args: unknown[]) => aiControlPanelMocks.getAdaptiveLearningStats(...args),
}));

vi.mock('../../src/events/eventEngine', () => ({
  getFinancialEvents: (...args: unknown[]) => aiControlPanelMocks.getFinancialEvents(...args),
  clearFinancialEvents: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => aiControlPanelMocks.logWarn(...args),
}));

describe('AIControlPanel memory error', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_AI_DEBUG_PANEL', '1');
    vi.clearAllMocks();

    aiControlPanelMocks.getAIMemorySnapshot.mockReset().mockReturnValue([]);
    aiControlPanelMocks.getAdaptiveLearningStats.mockReset().mockReturnValue({
      memory_count: 0,
      pattern_count: 0,
      is_learning: false,
    });
    aiControlPanelMocks.getFinancialEvents.mockReset().mockReturnValue([]);
  });

  it('mostra diagnostico visivel quando a memoria falha ao carregar', async () => {
    aiControlPanelMocks.getAIMemory.mockRejectedValueOnce(new Error('memory offline'));

    render(<AIControlPanel transactions={[]} accounts={[]} userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));

    const diagnostic = await screen.findByText(/Falha ao carregar memorias/i);
    const status = diagnostic.closest('[role="status"]');
    expect(status).toBeTruthy();
    expect(within(status as HTMLElement).getByText(/A consulta de memoria da IA nao concluiu agora/i)).toBeTruthy();
    expect(within(status as HTMLElement).getByText(/Proximo passo:/i)).toBeTruthy();
    expect(aiControlPanelMocks.logWarn).toHaveBeenCalledWith(
      '[AIControlPanel] Failed to load AI memory',
      expect.objectContaining({
        userId: 'user-1',
        fallback: 'ai-control-panel-memory-load-failed',
      }),
    );
  });
});
