import { beforeEach, describe, expect, it } from 'vitest';
import {
  learnMemory,
  getAIMemory,
  storeMemory,
  updateMemory,
  deleteMemory,
  detectAndLearnPatterns,
  type AIMemory,
} from '../../src/ai/aiMemory';
import { Category, TransactionType } from '../../types';

describe('aiMemory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─────────────────────── storeMemory / getAIMemory ───────────────────────

  it('storeMemory persists and getAIMemory retrieves by userId', async () => {
    const entry: AIMemory = {
      id: 'm1',
      user_id: 'u1',
      key: 'test_key',
      value: 'test_value',
      confidence: 0.8,
      updated_at: new Date().toISOString(),
    };

    await storeMemory(entry);
    const all = await getAIMemory('u1');
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe('test_key');
  });

  it('getAIMemory filters out other users entries', async () => {
    await storeMemory({ id: 'm1', user_id: 'alice', key: 'a', value: 'av', confidence: 0.5, updated_at: new Date().toISOString() });
    await storeMemory({ id: 'm2', user_id: 'bob',   key: 'b', value: 'bv', confidence: 0.5, updated_at: new Date().toISOString() });

    const aliceMemories = await getAIMemory('alice');
    expect(aliceMemories).toHaveLength(1);
    expect(aliceMemories[0].user_id).toBe('alice');
  });

  it('getAIMemory returns [] when nothing stored', async () => {
    expect(await getAIMemory('nobody')).toEqual([]);
  });

  // ─────────────────────── updateMemory ────────────────────────────────────

  it('updateMemory replaces the entry with matching id', async () => {
    await storeMemory({ id: 'mx', user_id: 'u1', key: 'lang', value: 'pt', confidence: 0.5, updated_at: new Date().toISOString() });
    await updateMemory({ id: 'mx', user_id: 'u1', key: 'lang', value: 'en', confidence: 0.9, updated_at: new Date().toISOString() });

    const all = await getAIMemory('u1');
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('en');
    expect(all[0].confidence).toBe(0.9);
  });

  it('updateMemory sets updated_at to now', async () => {
    const before = new Date().toISOString();
    await storeMemory({ id: 'mt', user_id: 'u1', key: 'x', value: 'old', confidence: 0.5, updated_at: '2020-01-01T00:00:00.000Z' });
    await updateMemory({ id: 'mt', user_id: 'u1', key: 'x', value: 'new', confidence: 0.5, updated_at: '2020-01-01T00:00:00.000Z' });

    const [updated] = await getAIMemory('u1');
    expect(new Date(updated.updated_at) >= new Date(before)).toBe(true);
  });

  // ─────────────────────── deleteMemory ────────────────────────────────────

  it('deleteMemory removes the entry with matching id', async () => {
    await storeMemory({ id: 'del1', user_id: 'u1', key: 'k', value: 'v', confidence: 0.5, updated_at: new Date().toISOString() });
    await deleteMemory('del1');
    expect(await getAIMemory('u1')).toHaveLength(0);
  });

  it('deleteMemory is a no-op for unknown id', async () => {
    await storeMemory({ id: 'keep', user_id: 'u1', key: 'k', value: 'v', confidence: 0.5, updated_at: new Date().toISOString() });
    await deleteMemory('phantom');
    expect(await getAIMemory('u1')).toHaveLength(1);
  });

  // ─────────────────────── learnMemory ─────────────────────────────────────

  it('learnMemory creates a new entry when key does not exist', async () => {
    await learnMemory('u1', 'preferred_bank', 'nubank', 0.9);
    const all = await getAIMemory('u1');
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe('preferred_bank');
    expect(all[0].value).toBe('nubank');
    expect(all[0].confidence).toBe(0.9);
  });

  it('learnMemory updates existing entry for same user + key', async () => {
    await learnMemory('u1', 'theme', 'dark', 0.7);
    await learnMemory('u1', 'theme', 'light', 0.95);

    const all = await getAIMemory('u1');
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe('light');
    expect(all[0].confidence).toBe(0.95);
  });

  it('learnMemory isolates by userId — different users, same key = separate entries', async () => {
    await learnMemory('user-a', 'currency', 'BRL', 0.8);
    await learnMemory('user-b', 'currency', 'USD', 0.8);

    expect(await getAIMemory('user-a')).toHaveLength(1);
    expect(await getAIMemory('user-b')).toHaveLength(1);
    expect((await getAIMemory('user-a'))[0].value).toBe('BRL');
    expect((await getAIMemory('user-b'))[0].value).toBe('USD');
  });

  // ─────────────────────── detectAndLearnPatterns ──────────────────────────

  function makeTx(description: string, amount: number, type: TransactionType, daysAgo: number, merchant?: string) {
    return {
      id: `tx-${Math.random()}`,
      description,
      merchant,
      amount,
      type,
      category: Category.PESSOAL,
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    };
  }

  it('detectAndLearnPatterns is a no-op when fewer than 3 transactions', async () => {
    await detectAndLearnPatterns('u1', [makeTx('t1', 10, TransactionType.DESPESA, 1), makeTx('t2', 10, TransactionType.DESPESA, 2)]);
    expect(await getAIMemory('u1')).toHaveLength(0);
  });

  it('detectAndLearnPatterns detects high weekend spending', async () => {
    // Make majority of expenses land on Saturday/Sunday
    const weekendDates: number[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) weekendDates.push(i);
      if (weekendDates.length >= 5) break;
    }

    const txs = weekendDates.map(d => makeTx('iFood', 50, TransactionType.DESPESA, d));
    // Add a few non-weekend expenses (< 30% total)
    txs.push(makeTx('salary', 5000, TransactionType.RECEITA, 15));

    await detectAndLearnPatterns('u1', txs);

    const memories = await getAIMemory('u1');
    const weekendMemory = memories.find(m => m.key === 'weekend_spending');
    expect(weekendMemory).toBeDefined();
    expect(weekendMemory!.value).toBe('high');
  });

  it('detectAndLearnPatterns learns frequent merchant', async () => {
    const txs = [
      makeTx('iFood', 40, TransactionType.DESPESA, 1, 'ifood'),
      makeTx('iFood', 45, TransactionType.DESPESA, 8, 'ifood'),
      makeTx('iFood', 38, TransactionType.DESPESA, 15, 'ifood'),
      makeTx('Salary', 5000, TransactionType.RECEITA, 5),
    ];

    await detectAndLearnPatterns('u1', txs);
    const memories = await getAIMemory('u1');
    const merchantMemory = memories.find(m => m.key === 'frequent_merchant');
    expect(merchantMemory).toBeDefined();
    expect(merchantMemory!.value).toBe('ifood');
  });
});
