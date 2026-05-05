import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/integrations/openBankingService', () => ({
  getConnections: vi.fn(),
  getConnection: vi.fn(),
  fullSync: vi.fn(),
  formatLastSync: vi.fn(),
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

import { getSyncStatusSummary, syncSingleBank } from '../../src/finance/bankSyncEngine';
import { getConnection, fullSync } from '../../services/integrations/openBankingService';

describe('bankSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('avisa quando o sync de uma unica conexao falha', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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
    expect(warnSpy).toHaveBeenCalledWith(
      '[BankSyncEngine] Single bank sync failed:',
      expect.objectContaining({
        connectionId: 'conn-1',
        bankName: 'Banco Teste',
        error: 'sync failed',
      }),
    );
    warnSpy.mockRestore();
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
