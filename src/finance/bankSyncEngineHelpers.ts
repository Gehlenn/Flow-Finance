import { Transaction } from '../../types';
import { parseLastSyncDate } from '../../services/integrations/openBankingService';
import { logWarn } from '../utils/logger';
import { getConnections } from '../../services/integrations/openBankingService';
import { detectSalary, type SalaryDetectionResult } from '../ai/salaryDetector';
import { detectFixedExpenses, type FixedExpenseReport } from '../ai/fixedExpenseDetector';

export interface BankSyncReport {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  connections_synced: number;
  connections_failed: number;
  total_imported: number;
  results: unknown[];
  salary_analysis?: unknown;
  fixed_expense_report?: unknown;
}

const SYNC_REPORTS_KEY = 'flow_bank_sync_reports';
const MAX_REPORTS = 10;

export function saveSyncReport(report: BankSyncReport): void {
  try {
    const existing: BankSyncReport[] = JSON.parse(localStorage.getItem(SYNC_REPORTS_KEY) || '[]');
    const updated = [report, ...existing].slice(0, MAX_REPORTS);
    localStorage.setItem(SYNC_REPORTS_KEY, JSON.stringify(updated));
  } catch (error) {
    logWarn('[BankSyncEngine] Failed to persist sync report:', {
      error,
      storageKey: SYNC_REPORTS_KEY,
    });
  }
}

export function getSyncReports(): BankSyncReport[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_REPORTS_KEY) || '[]');
  } catch (error) {
    logWarn('[BankSyncEngine] Failed to read sync reports; returning empty set', {
      error,
      storageKey: SYNC_REPORTS_KEY,
    });
    return [];
  }
}

export function getLastSyncReport(): BankSyncReport | null {
  const reports = getSyncReports();
  return reports[0] ?? null;
}

export function formatSyncDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}min`;
}

export function getSyncStatusSummary(userId: string): {
  total_banks: number;
  connected: number;
  last_sync: string | null;
  needs_sync: boolean;
} {
  const conns = getConnections(userId);
  const connected = conns.filter((c) => c.connection_status === 'connected' || c.connection_status === 'syncing');
  const lastSyncTimes = conns
    .map((c) => c.last_sync)
    .filter(Boolean)
    .sort()
    .reverse();
  const lastSync = lastSyncTimes[0] ?? null;
  const lastSyncDate = parseLastSyncDate(lastSync ?? undefined);

  const needsSync = !lastSyncDate || (Date.now() - lastSyncDate.getTime()) > 4 * 60 * 60 * 1000;

  return {
    total_banks: conns.length,
    connected: connected.length,
    last_sync: lastSync,
    needs_sync: needsSync,
  };
}

export function normalizeImportedTransactionId(transaction: Partial<Transaction>): string {
  return transaction.id ?? Math.random().toString(36);
}

export function analyzeBankSyncTransactions(allTransactions: Transaction[]): {
  salaryAnalysis?: SalaryDetectionResult;
  fixedExpenseReport?: FixedExpenseReport;
} {
  let salaryAnalysis: SalaryDetectionResult | undefined;
  let fixedExpenseReport: FixedExpenseReport | undefined;

  try {
    salaryAnalysis = detectSalary(allTransactions);
  } catch (error) {
    logWarn('[BankSyncEngine] Salary analysis failed; continuing without insights', {
      error,
      transactionCount: allTransactions.length,
    });
  }

  try {
    fixedExpenseReport = detectFixedExpenses(allTransactions);
  } catch (error) {
    logWarn('[BankSyncEngine] Fixed expense analysis failed; continuing without insights', {
      error,
      transactionCount: allTransactions.length,
    });
  }

  return { salaryAnalysis, fixedExpenseReport };
}
