const STORAGE_KEY = 'flow_ai_memory';

// ─── Model ────────────────────────────────────────────────────────────────────

export interface AIMemory {
  id: string;
  user_id: string;
  key: string;
  value: string;
  confidence: number;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAll(): AIMemory[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAll(entries: AIMemory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAIMemory(userId: string): Promise<AIMemory[]> {
  return readAll().filter(m => m.user_id === userId);
}

export async function storeMemory(memory: AIMemory): Promise<void> {
  const all = readAll();
  all.push(memory);
  writeAll(all);
}

export async function updateMemory(memory: AIMemory): Promise<void> {
  const all = readAll().map(m => m.id === memory.id ? { ...memory, updated_at: new Date().toISOString() } : m);
  writeAll(all);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  writeAll(readAll().filter(m => m.id !== memoryId));
}

// ─── PART 3: learnMemory helper ───────────────────────────────────────────────

export async function learnMemory(
  userId: string,
  key: string,
  value: string,
  confidence: number
): Promise<void> {
  const all = readAll();
  const existing = all.find(m => m.user_id === userId && m.key === key);

  if (existing) {
    const updated: AIMemory = {
      ...existing,
      value,
      confidence,
      updated_at: new Date().toISOString(),
    };
    writeAll(all.map(m => m.id === existing.id ? updated : m));
  } else {
    const newEntry: AIMemory = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: userId,
      key,
      value,
      confidence,
      updated_at: new Date().toISOString(),
    };
    all.push(newEntry);
    writeAll(all);
  }
}

// ─── PART 9: Pattern detection helper ────────────────────────────────────────

import { Transaction, TransactionType } from '../../types';

export async function detectAndLearnPatterns(
  userId: string,
  transactions: Transaction[]
): Promise<void> {
  if (transactions.length < 3) return;

  // Detectar gastos no fim de semana
  const weekendSpending = transactions.filter(t => {
    const day = new Date(t.date).getDay();
    return t.type === TransactionType.DESPESA && (day === 0 || day === 6);
  });
  const totalSpending = transactions.filter(t => t.type === TransactionType.DESPESA);
  if (totalSpending.length > 0) {
    const weekendRatio = weekendSpending.length / totalSpending.length;
    if (weekendRatio > 0.3) {
      await learnMemory(userId, 'weekend_spending', 'high', Math.min(weekendRatio, 1));
    }
  }

  // Detectar merchant frequente
  const merchantCount: Record<string, number> = {};
  for (const t of transactions) {
    const key = (t.merchant || t.description).toLowerCase().trim();
    merchantCount[key] = (merchantCount[key] || 0) + 1;
  }
  const topMerchant = Object.entries(merchantCount).sort((a, b) => b[1] - a[1])[0];
  if (topMerchant && topMerchant[1] >= 3) {
    await learnMemory(userId, 'frequent_merchant', topMerchant[0], Math.min(topMerchant[1] / 10, 1));
  }

  // Detectar despesas recorrentes
  const recurringCount = transactions.filter(t => t.recurring === true).length;
  if (recurringCount > 0) {
    await learnMemory(userId, 'recurring_expenses', String(recurringCount), Math.min(recurringCount / 5, 1));
  }
}
