import { beforeEach, describe, expect, it, vi } from 'vitest';

const logWarnMock = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import { getAIMemorySnapshot, getUserMemoryProfile, type AIMemory } from '../../src/ai/aiMemory';
import { Category, TransactionType } from '../../types';
import type { Transaction } from '../../types';

function setWorkspace(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

function setMemories(memories: AIMemory[] | Record<string, unknown>): void {
  const workspace = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY) || 'global';
  localStorage.setItem(`flow_ai_memory:${workspace}`, JSON.stringify(memories));
}

function makeTx(id: string, date: string): Transaction {
  return {
    id,
    amount: 50,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'A',
    date,
    recurring: false,
  } as Transaction;
}

describe('aiMemory branch coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    logWarnMock.mockReset();
    setWorkspace('ws-memory-branches');
  });

  it('returns empty and warns when storage shape is invalid object', () => {
    setMemories({ broken: true });

    expect(getAIMemorySnapshot('user-1')).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIMemory] Memory storage has invalid shape; returning empty set',
      expect.objectContaining({
        storageKey: 'flow_ai_memory:ws-memory-branches',
        fallback: 'ai-memory-invalid-shape',
      }),
    );
  });

  it('returns empty and warns when storage content is malformed json', () => {
    localStorage.setItem('flow_ai_memory:ws-memory-branches', '{bad');

    expect(getAIMemorySnapshot('user-1')).toEqual([]);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[AIMemory] Failed to parse memory storage; returning empty set',
      expect.objectContaining({
        storageKey: 'flow_ai_memory:ws-memory-branches',
        error: expect.any(Error),
        fallback: 'ai-memory-parse-failed',
      }),
    );
  });

  it('returns empty profile buckets when user has no memories', async () => {
    setMemories([
      {
        id: 'm-10',
        user_id: 'other-user',
        key: 'merchant_top',
        value: 'mercado',
        confidence: 0.5,
        updated_at: '2026-05-14T10:00:00.000Z',
      },
    ]);

    const profile = await getUserMemoryProfile('user-1');

    expect(profile.patterns).toEqual([]);
    expect(profile.spending_profile).toEqual([]);
    expect(profile.merchant_categories).toEqual([]);
  });

  it('parseMemoryDate covers non-YYYY-MM-DD dates and invalid strings via detectAndLearnPatterns', async () => {
    const { detectAndLearnPatterns, getAIMemorySnapshot } = await import('../../src/ai/aiMemory');

    // datetime ISO string — cobre o branch else (non dateOnly)
    await detectAndLearnPatterns('user-parse', [
      makeTx('t1', '2026-05-10T10:00:00.000Z'),
      makeTx('t2', '2026-05-11T10:00:00.000Z'),
      makeTx('t3', 'not-a-date'),
    ]);

    // Não lança — apenas confirma que execução completa sem erro
    expect(getAIMemorySnapshot('user-parse')).toBeDefined();
  });
});

