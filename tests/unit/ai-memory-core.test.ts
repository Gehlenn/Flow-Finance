import { beforeEach, describe, expect, it } from 'vitest';

import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import {
  deleteMemory,
  detectAndLearnPatterns,
  getAIMemory,
  getAIMemorySnapshot,
  getUserMemoryProfile,
  learnMemory,
  storeMemory,
  updateMemory,
  type AIMemory,
} from '../../src/ai/aiMemory';
import { Category, TransactionType, type Transaction } from '../../types';

function setWorkspace(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

function memoryEntry(overrides: Partial<AIMemory> = {}): AIMemory {
  return {
    id: overrides.id || 'm-1',
    user_id: overrides.user_id || 'user-1',
    key: overrides.key || 'weekend_spending',
    value: overrides.value || 'high',
    confidence: overrides.confidence ?? 0.7,
    updated_at: overrides.updated_at || '2026-05-14T10:00:00.000Z',
  };
}

function expense(date: string, merchant: string, recurring = false): Transaction {
  return {
    id: `${merchant}-${date}`,
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: merchant,
    date,
    merchant,
    recurring,
  };
}

describe('aiMemory core flows', () => {
  beforeEach(() => {
    localStorage.clear();
    setWorkspace('ws-ai-memory');
  });

  it('stores, updates, deletes and snapshots memories by user', async () => {
    await storeMemory(memoryEntry({ id: 'm-1', user_id: 'user-a', key: 'k1', value: 'v1' }));
    await storeMemory(memoryEntry({ id: 'm-2', user_id: 'user-b', key: 'k2', value: 'v2' }));

    expect(getAIMemorySnapshot('user-a')).toHaveLength(1);
    expect((await getAIMemory('user-b'))[0].key).toBe('k2');

    await updateMemory(memoryEntry({ id: 'm-1', user_id: 'user-a', key: 'k1', value: 'updated' }));
    expect(getAIMemorySnapshot('user-a')[0].value).toBe('updated');

    await deleteMemory('m-2');
    expect(getAIMemorySnapshot('user-b')).toEqual([]);
  });

  it('upserts learnMemory entries and builds user profile buckets', async () => {
    await learnMemory('user-profile', 'weekend_pattern', 'true', 0.8);
    await learnMemory('user-profile', 'recurring_expenses', '3', 0.7);
    await learnMemory('user-profile', 'merchant_top', 'mercado alfa', 0.6);

    await learnMemory('user-profile', 'weekend_pattern', 'false', 0.5);

    const memories = getAIMemorySnapshot('user-profile');
    const weekend = memories.find((memory) => memory.key === 'weekend_pattern');

    expect(memories).toHaveLength(3);
    expect(weekend?.value).toBe('false');

    const profile = await getUserMemoryProfile('user-profile');
    expect(profile.patterns.length).toBeGreaterThan(0);
    expect(profile.spending_profile.length).toBeGreaterThan(0);
    expect(profile.merchant_categories.length).toBeGreaterThan(0);
  });

  it('detects spending patterns from transactions and persists learned memories', async () => {
    const transactions: Transaction[] = [
      expense('2026-05-09', 'Mercado Alfa', true),
      expense('2026-05-10', 'Mercado Alfa', true),
      expense('2026-05-11', 'Mercado Alfa', true),
      expense('2026-05-17', 'Mercado Alfa', false),
    ];

    await detectAndLearnPatterns('user-pattern', transactions);

    const snapshot = getAIMemorySnapshot('user-pattern');
    const keys = snapshot.map((memory) => memory.key);

    expect(keys).toContain('weekend_spending');
    expect(keys).toContain('frequent_merchant');
    expect(keys).toContain('recurring_expenses');
  });
});
