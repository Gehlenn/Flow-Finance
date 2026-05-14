import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogWarn = vi.fn();

vi.mock('../../services/integrations/openBankingService', () => ({
  getConnections: vi.fn(),
  getConnection: vi.fn(),
  fullSync: vi.fn(),
  formatLastSync: vi.fn(),
  parseLastSyncDate: (lastSync?: string) => {
    if (!lastSync) return null;
    const trimmed = lastSync.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  },
}));

vi.mock('../../src/events/eventEngine', () => ({
  FinancialEventEmitter: {
    bankTransactionsSynced: vi.fn(),
  },
}));

vi.mock('../../src/ai/salaryDetector', () => ({
  detectSalary: vi.fn(),
}));

vi.mock('../../src/ai/fixedExpenseDetector', () => ({
  detectFixedExpenses: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: mockLogWarn,
}));

import { getSyncStatusSummary, runBankSync, syncSingleBank } from '../../src/finance/bankSyncEngine';
import { getConnection, fullSync } from '../../services/integrations/openBankingService';
import { detectSalary } from '../../src/ai/salaryDetector';
import { detectFixedExpenses } from '../../src/ai/fixedExpenseDetector';

describe('bankSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogWarn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('avisa quando o sync de uma unica conexao falha', async () => {
    vi.mocked(getConnection).mockReturnValue({
      id: 'conn-1',
      user_id: 'user-1',
      bank_name: 'Banco Teste',
      connection_status: 'connected',
      last_sync: null,
    } as never);
    vi.mocked(fullSync).mockRejectedValueOnce(new Error('sync failed'));

    const result = await syncSingleBank(
      'conn-1',
      [],
      [],
      vi.fn(),
      vi.fn(),
      'user-1',
    );

    expect(result.status).toBe('error');
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[BankSyncEngine] Single bank sync failed',
      expect.objectContaining({
        connectionId: 'conn-1',
        bankName: 'Banco Teste',
        error: 'sync failed',
        fallback: 'bank-sync-single-bank-failed',
      }),
    );
  });

  it('registra aviso quando nao consegue persistir o relatorio de sync', async () => {
    const localStorageSetItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const { getConnections } = await import('../../services/integrations/openBankingService');
    vi.mocked(getConnections).mockReturnValue([] as never);

    const result = await runBankSync([], [], 'user-1');

    expect(result.connections_synced).toBe(0);
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[BankSyncEngine] Failed to persist sync report:',
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'bank-sync-persist-report-failed',
      }),
    );

    localStorageSetItemSpy.mockRestore();
  });

  it('registra aviso quando a analise de salario falha e segue o sync', async () => {
    const { getConnections } = await import('../../services/integrations/openBankingService');
    vi.mocked(getConnections).mockReturnValue([] as never);
    vi.mocked(detectSalary).mockImplementation(() => {
      throw new Error('salary analysis failed');
    });
    vi.mocked(detectFixedExpenses).mockReturnValue({ total_monthly: 0, items: [] } as never);

    const result = await runBankSync([], [], 'user-1');

    expect(result.connections_synced).toBe(0);
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[BankSyncEngine] Salary analysis failed; continuing without insights',
      expect.objectContaining({
        error: expect.any(Error),
        transactionCount: 0,
      }),
    );
  });

  it('registra aviso quando a analise de despesas fixas falha e segue o sync', async () => {
    const { getConnections } = await import('../../services/integrations/openBankingService');
    vi.mocked(getConnections).mockReturnValue([] as never);
    vi.mocked(detectSalary).mockReturnValue({ detected: false } as never);
    vi.mocked(detectFixedExpenses).mockImplementation(() => {
      throw new Error('fixed expense analysis failed');
    });

    const result = await runBankSync([], [], 'user-1');

    expect(result.connections_synced).toBe(0);
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[BankSyncEngine] Fixed expense analysis failed; continuing without insights',
      expect.objectContaining({
        error: expect.any(Error),
        transactionCount: 0,
      }),
    );
  });

  it('trata last_sync date-only como data local no resumo de sync', async () => {
    const { getConnections } = await import('../../services/integrations/openBankingService');
    vi.mocked(getConnections).mockReturnValue([
      {
        id: 'conn-1',
        user_id: 'user-1',
        bank_name: 'Banco Teste',
        connection_status: 'connected',
        last_sync: '2026-04-10',
      },
    ] as never);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T03:00:00.000Z'));

    const summary = getSyncStatusSummary('user-1');

    expect(summary.needs_sync).toBe(false);
  });
});
