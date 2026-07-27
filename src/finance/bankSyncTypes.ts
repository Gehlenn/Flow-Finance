import type { FixedExpenseReport } from '../ai/fixedExpenseDetector';
import type { SalaryDetectionResult } from '../ai/salaryDetector';

export interface BankSyncConnectionResult {
  connection_id: string;
  bank_name: string;
  status: 'success' | 'error' | 'skipped';
  transactions_imported: number;
  balance_updated: boolean;
  new_balance?: number;
  error?: string;
  sync_duration_ms: number;
}

export interface BankSyncReport {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  connections_synced: number;
  connections_failed: number;
  total_imported: number;
  results: BankSyncConnectionResult[];
  salary_analysis?: SalaryDetectionResult;
  fixed_expense_report?: FixedExpenseReport;
}
