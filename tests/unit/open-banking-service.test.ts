import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock: provider mock (sem delays de rede) ─────────────────────────────────
vi.mock('../../services/integrations/mockBankProvider', () => ({
  getProvider: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({ external_id: 'mock_nubank_abc' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    fetchAccounts: vi.fn().mockResolvedValue([
      { id: 'mock_acc1', name: 'Conta Corrente', balance: 4280.5, currency: 'BRL', type: 'checking' },
    ]),
    fetchTransactions: vi.fn().mockResolvedValue([
      { id: 'tx1', date: new Date(Date.now() - 86400000).toISOString(), amount: -89.90, description: 'iFood', merchant: 'iFood' },
      { id: 'tx2', date: new Date(Date.now() - 172800000).toISOString(), amount: 3200.00, description: 'Salário', merchant: 'Empresa SA' },
    ]),
  })),
}));

// ─── Mock: AI Memory (learnMemory faz chamada externa) ────────────────────────
vi.mock('../../src/ai/aiMemory', () => ({
  learnMemory: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: importService (classifyImportedTransactions usa IA) ───────────────
vi.mock('../../src/finance/importService', () => ({
  classifyImportedTransactions: vi.fn().mockImplementation((txs: any[]) =>
    Promise.resolve(txs.map((t: any) => ({ ...t, category: 'PESSOAL', confidence: 0.3 })))
  ),
}));

// ─── Mock: FinancialEventEmitter ──────────────────────────────────────────────
vi.mock('../../src/events/eventEngine', () => ({
  FinancialEventEmitter: {
    bankTransactionsSynced: vi.fn(),
    insightGenerated: vi.fn(),
    transactionAdded: vi.fn(),
  },
}));

import {
  connectBank,
  disconnectBank,
  getConnection,
  getConnections,
  syncAccounts,
  syncTransactions,
  fullSync,
  formatLastSync,
  getBankingHealth,
  listPluggyConnectors,
} from '../../services/integrations/openBankingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(id: string, name: string, balance = 1000) {
  return {
    id,
    user_id: 'u1',
    name,
    type: 'bank' as const,
    balance,
    currency: 'BRL',
    created_at: new Date().toISOString(),
  };
}

describe('openBankingService (local mock mode)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ─────────────────────── backend-guard (test mode) ───────────────────────

  it('getBankingHealth returns null in test mode (no backend)', async () => {
    const result = await getBankingHealth();
    expect(result).toBeNull();
  });

  it('listPluggyConnectors returns [] in test mode', async () => {
    const result = await listPluggyConnectors();
    expect(result).toEqual([]);
  });

  // ─────────────────────── getConnections / getConnection ──────────────────

  it('getConnections returns empty array when nothing is stored', () => {
    expect(getConnections('user1')).toEqual([]);
  });

  it('getConnections filters by userId', async () => {
    await connectBank('nubank', 'alice');
    await connectBank('itau', 'bob');

    const aliceConns = getConnections('alice');
    const bobConns   = getConnections('bob');

    expect(aliceConns).toHaveLength(1);
    expect(aliceConns[0].user_id).toBe('alice');
    expect(bobConns).toHaveLength(1);
    expect(bobConns[0].user_id).toBe('bob');
  });

  it('getConnection returns null for unknown id', () => {
    expect(getConnection('non-existent')).toBeNull();
  });

  // ─────────────────────── connectBank ─────────────────────────────────────

  it('connectBank creates a connection with status connected', async () => {
    const conn = await connectBank('nubank', 'user1');

    expect(conn.user_id).toBe('user1');
    expect(conn.bank_name).toBe('Nubank');
    expect(conn.connection_status).toBe('connected');
    expect(conn.external_account_id).toBe('mock_nubank_abc');
  });

  it('connectBank persists connection to localStorage', async () => {
    await connectBank('itau', 'user2');
    const stored = getConnections('user2');
    expect(stored).toHaveLength(1);
    expect(stored[0].bank_name).toBe('Itaú');
  });

  it('connectBank throws for unknown bankId', async () => {
    await expect(connectBank('unknown-bank-xyz', 'user1')).rejects.toThrow('não encontrado no catálogo');
  });

  // ─────────────────────── disconnectBank ──────────────────────────────────

  it('disconnectBank removes connection from storage', async () => {
    const conn = await connectBank('nubank', 'user1');
    expect(getConnections('user1')).toHaveLength(1);

    await disconnectBank(conn.id);
    expect(getConnections('user1')).toHaveLength(0);
  });

  it('disconnectBank is a no-op for unknown id', async () => {
    // Should not throw
    await expect(disconnectBank('does-not-exist')).resolves.toBeUndefined();
  });

  // ─────────────────────── syncAccounts ────────────────────────────────────

  it('syncAccounts updates matching account balance', async () => {
    const conn = await connectBank('nubank', 'user1');

    const accounts = [makeAccount('acc1', 'Nubank Check', 0)];
    const updates: any[] = [];

    await syncAccounts(conn.id, accounts, (acc) => updates.push(acc));

    expect(updates).toHaveLength(1);
    expect(updates[0].balance).toBeGreaterThan(0);
  });

  it('syncAccounts is a no-op for unknown connectionId', async () => {
    const updates: any[] = [];
    await syncAccounts('unknown-id', [], (acc) => updates.push(acc));
    expect(updates).toHaveLength(0);
  });

  // ─────────────────────── syncTransactions ────────────────────────────────

  it('syncTransactions returns 0 when connection is missing', async () => {
    const result = await syncTransactions('no-such-id', [], 'user1', vi.fn());
    expect(result.transactions_imported).toBe(0);
    expect(result.error).toMatch(/não encontrada/i);
  });

  it('syncTransactions imports new transactions (no duplicates)', async () => {
    const conn = await connectBank('nubank', 'user1');

    const received: any[] = [];
    const result = await syncTransactions(conn.id, [], 'user1', (txs) => received.push(...txs));

    expect(result.transactions_imported).toBe(2); // 2 mocked raw txs
    expect(received).toHaveLength(2);
  });

  it('syncTransactions skips duplicates (same date + amount + description)', async () => {
    const conn = await connectBank('nubank', 'user1');

    // Pre-populate with a transaction that matches mock tx1
    const existing = [{
      id: 'existing-1',
      amount: 89.90,
      type: 'DESPESA' as any,
      category: 'PESSOAL' as any,
      description: 'iFood',
      merchant: 'iFood',
      date: new Date(Date.now() - 86400000).toISOString(),
    }];

    const received: any[] = [];
    const result = await syncTransactions(conn.id, existing, 'user1', (txs) => received.push(...txs));

    // Only 1 new (tx2 = Salário), tx1 was deduplicated
    expect(result.transactions_imported).toBe(1);
  });

  it('syncTransactions emits FinancialEventEmitter.bankTransactionsSynced', async () => {
    const { FinancialEventEmitter } = await import('../../src/events/eventEngine');
    const conn = await connectBank('nubank', 'user1');
    await syncTransactions(conn.id, [], 'user1', vi.fn());

    expect(FinancialEventEmitter.bankTransactionsSynced).toHaveBeenCalledOnce();
  });

  // ─────────────────────── fullSync ────────────────────────────────────────

  it('fullSync runs accounts + transactions sync and returns SyncResult', async () => {
    const conn = await connectBank('nubank', 'user1');
    const accounts = [makeAccount('acc1', 'Nubank', 0)];
    const updates: any[] = [];
    const received: any[] = [];

    const result = await fullSync(conn.id, [], accounts, 'user1', (txs) => received.push(...txs), (acc) => updates.push(acc));

    expect(result.connection_id).toBe(conn.id);
    expect(result.transactions_imported).toBe(2);
    expect(updates).toHaveLength(1); // account balance updated
  });

  // ─────────────────────── formatLastSync ──────────────────────────────────

  it('formatLastSync returns "Nunca" when undefined', () => {
    expect(formatLastSync(undefined)).toBe('Nunca');
  });

  it('formatLastSync returns "Agora mesmo" for recent sync', () => {
    expect(formatLastSync(new Date().toISOString())).toBe('Agora mesmo');
  });

  it('formatLastSync returns minutes for syncs < 1 hour ago', () => {
    const ts = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    expect(formatLastSync(ts)).toBe('15 min atrás');
  });

  it('formatLastSync returns hours for syncs between 1–23 hours ago', () => {
    const ts = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatLastSync(ts)).toBe('3h atrás');
  });

  it('formatLastSync returns locale date for syncs > 24h ago', () => {
    const ts = new Date(Date.now() - 2 * 86400000).toISOString();
    const label = formatLastSync(ts);
    expect(label).toMatch(/\d{2}\/\d{2}\/\d{4}/); // pt-BR date format
  });
});
