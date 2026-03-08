/**
 * BANK SYNC ENGINE — src/services/finance/bankSyncEngine.ts
 *
 * PART 3 — Orquestra sincronização automática de todos os bancos conectados.
 *
 * Pipeline completo:
 *   1. Busca todas as conexões ativas do usuário
 *   2. Para cada conexão: fetch transações do banco
 *   3. Mapeia para o modelo interno Transaction
 *   4. Detecta e remove duplicatas
 *   5. Classifica categorias com IA
 *   6. Armazena no estado da aplicação
 *   7. Atualiza saldos das contas vinculadas
 *   8. Emite evento bank_transactions_synced
 *   9. Dispara análise de salário + despesas fixas em background
 */

import { Transaction, TransactionType, Category } from '../../types';
import { Account } from '../../models/Account';
import { BankConnection, SyncResult } from '../../models/BankConnection';
import {
  getConnections,
  getConnection,
  fullSync,
  formatLastSync,
} from '../integrations/openBankingService';
import { FinancialEventEmitter } from './eventEngine';
import { detectSalary, SalaryDetectionResult } from '../ai/salaryDetector';
import { detectFixedExpenses, FixedExpenseReport } from '../ai/fixedExpenseDetector';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface BankSyncEngineOptions {
  userId:       string;
  days?:        number;   // how many days back to sync (default 30)
  connections?: string[]; // specific connection IDs to sync (default: all active)
  onProgress?:  (step: BankSyncStep) => void;
}

export type BankSyncStepType =
  | 'start'
  | 'connecting'
  | 'fetching'
  | 'mapping'
  | 'deduplicating'
  | 'classifying'
  | 'storing'
  | 'updating_balance'
  | 'analyzing'
  | 'done'
  | 'error';

export interface BankSyncStep {
  type:         BankSyncStepType;
  bank_name:    string;
  message:      string;
  progress:     number;   // 0–100
  timestamp:    string;
}

export interface BankSyncConnectionResult {
  connection_id:         string;
  bank_name:             string;
  status:                'success' | 'error' | 'skipped';
  transactions_imported: number;
  balance_updated:       boolean;
  new_balance?:          number;
  error?:                string;
  sync_duration_ms:      number;
}

export interface BankSyncReport {
  started_at:            string;
  finished_at:           string;
  duration_ms:           number;
  connections_synced:    number;
  connections_failed:    number;
  total_imported:        number;
  results:               BankSyncConnectionResult[];
  salary_analysis?:      SalaryDetectionResult;
  fixed_expense_report?: FixedExpenseReport;
}

// ─── Storage key for sync reports ────────────────────────────────────────────

const SYNC_REPORTS_KEY = 'flow_bank_sync_reports';
const MAX_REPORTS = 10;

function saveSyncReport(report: BankSyncReport): void {
  try {
    const existing: BankSyncReport[] = JSON.parse(localStorage.getItem(SYNC_REPORTS_KEY) || '[]');
    const updated = [report, ...existing].slice(0, MAX_REPORTS);
    localStorage.setItem(SYNC_REPORTS_KEY, JSON.stringify(updated));
  } catch { /* silencioso */ }
}

export function getSyncReports(): BankSyncReport[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_REPORTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getLastSyncReport(): BankSyncReport | null {
  const reports = getSyncReports();
  return reports[0] ?? null;
}

// ─── PART 3 — runBankSync ─────────────────────────────────────────────────────

/**
 * Executa sincronização bancária completa.
 *
 * Fetch → Map → Deduplicate → Classify (AI) → Store → Update balance → Analyze
 *
 * @param existingTransactions - transações já armazenadas (para deduplicação)
 * @param existingAccounts     - contas existentes (para atualização de saldo)
 * @param onNewTransactions    - callback para persistir novas transações
 * @param onUpdateAccount      - callback para atualizar saldo de conta
 * @param options              - opções de sync (userId, days, connections, onProgress)
 * @returns BankSyncReport     - relatório completo do sync
 */
export async function runBankSync(
  existingTransactions: Transaction[],
  existingAccounts: Account[],
  onNewTransactions: (txs: Partial<Transaction>[]) => void,
  onUpdateAccount: (acc: Account) => void,
  options: BankSyncEngineOptions
): Promise<BankSyncReport> {
  const {
    userId,
    days = 30,
    connections: targetIds,
    onProgress,
  } = options;

  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const emit = (step: Omit<BankSyncStep, 'timestamp'>) =>
    onProgress?.({ ...step, timestamp: new Date().toISOString() });

  // ── Collect transactions added during this sync ───────────────────────────
  const newlyImported: Partial<Transaction>[] = [];
  const wrappedOnNew = (txs: Partial<Transaction>[]) => {
    newlyImported.push(...txs);
    onNewTransactions(txs);
  };

  emit({ type: 'start', bank_name: 'Todos', message: 'Iniciando sincronização bancária…', progress: 0 });

  // ── Resolve which connections to sync ────────────────────────────────────
  const allConns = getConnections(userId);
  const activeConns = allConns.filter(c => c.connection_status !== 'error');
  const connsToSync = targetIds
    ? activeConns.filter(c => targetIds.includes(c.id))
    : activeConns;

  if (connsToSync.length === 0) {
    const report: BankSyncReport = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - t0,
      connections_synced: 0,
      connections_failed: 0,
      total_imported: 0,
      results: [],
    };
    saveSyncReport(report);
    return report;
  }

  const results: BankSyncConnectionResult[] = [];
  let totalImported = 0;
  let successCount = 0;
  let failCount = 0;

  // ── Sync each connection ──────────────────────────────────────────────────
  for (let i = 0; i < connsToSync.length; i++) {
    const conn = connsToSync[i];
    const baseProgress = Math.round((i / connsToSync.length) * 80);
    const connT0 = Date.now();

    emit({
      type: 'connecting',
      bank_name: conn.bank_name,
      message: `Conectando ao ${conn.bank_name}…`,
      progress: baseProgress,
    });

    try {
      emit({
        type: 'fetching',
        bank_name: conn.bank_name,
        message: `Buscando transações dos últimos ${days} dias…`,
        progress: baseProgress + 5,
      });

      const syncResult = await fullSync(
        conn.id,
        existingTransactions,
        existingAccounts,
        userId,
        wrappedOnNew,
        onUpdateAccount,
      );

      emit({
        type: 'storing',
        bank_name: conn.bank_name,
        message: `${syncResult.transactions_imported} transações importadas`,
        progress: baseProgress + 15,
      });

      const connResult: BankSyncConnectionResult = {
        connection_id:         conn.id,
        bank_name:             conn.bank_name,
        status:                'success',
        transactions_imported: syncResult.transactions_imported,
        balance_updated:       syncResult.balance_updated,
        new_balance:           syncResult.new_balance,
        sync_duration_ms:      Date.now() - connT0,
      };

      results.push(connResult);
      totalImported += syncResult.transactions_imported;
      successCount++;

    } catch (err: any) {
      emit({
        type: 'error',
        bank_name: conn.bank_name,
        message: `Erro ao sincronizar ${conn.bank_name}: ${err?.message ?? 'erro desconhecido'}`,
        progress: baseProgress + 10,
      });

      results.push({
        connection_id:         conn.id,
        bank_name:             conn.bank_name,
        status:                'error',
        transactions_imported: 0,
        balance_updated:       false,
        error:                 err?.message ?? 'Erro desconhecido',
        sync_duration_ms:      Date.now() - connT0,
      });
      failCount++;
    }
  }

  // ── Post-sync analysis (salary + fixed expenses) ─────────────────────────
  emit({ type: 'analyzing', bank_name: 'Motor IA', message: 'Analisando padrões financeiros…', progress: 85 });

  const allTransactions = [
    ...existingTransactions,
    ...newlyImported.map(t => ({ ...t, id: t.id ?? Math.random().toString(36) } as Transaction)),
  ];

  let salaryAnalysis: SalaryDetectionResult | undefined;
  let fixedExpenseReport: FixedExpenseReport | undefined;

  try {
    salaryAnalysis = detectSalary(allTransactions);
  } catch { /* non-blocking */ }

  try {
    fixedExpenseReport = detectFixedExpenses(allTransactions);
  } catch { /* non-blocking */ }

  emit({ type: 'done', bank_name: 'Todos', message: `Sync completo. ${totalImported} transações importadas.`, progress: 100 });

  const report: BankSyncReport = {
    started_at:            startedAt,
    finished_at:           new Date().toISOString(),
    duration_ms:           Date.now() - t0,
    connections_synced:    successCount,
    connections_failed:    failCount,
    total_imported:        totalImported,
    results,
    salary_analysis:       salaryAnalysis,
    fixed_expense_report:  fixedExpenseReport,
  };

  saveSyncReport(report);

  // ── Emit aggregate event for AI pipeline ─────────────────────────────────
  // (individual events already emitted per-connection in syncTransactions)
  if (totalImported > 0) {
    FinancialEventEmitter.bankTransactionsSynced({
      type:             'aggregate_sync',
      connections:      successCount,
      total_imported:   totalImported,
      salary_detected:  salaryAnalysis?.detected ?? false,
      fixed_expenses:   fixedExpenseReport?.total_monthly ?? 0,
      synced_at:        report.finished_at,
    });
  }

  return report;
}

// ─── Convenience: sync a single connection ────────────────────────────────────

export async function syncSingleBank(
  connectionId: string,
  existingTransactions: Transaction[],
  existingAccounts: Account[],
  onNewTransactions: (txs: Partial<Transaction>[]) => void,
  onUpdateAccount: (acc: Account) => void,
  userId: string
): Promise<BankSyncConnectionResult> {
  const conn = getConnection(connectionId);
  if (!conn) {
    return {
      connection_id:         connectionId,
      bank_name:             'Desconhecido',
      status:                'error',
      transactions_imported: 0,
      balance_updated:       false,
      error:                 'Conexão não encontrada',
      sync_duration_ms:      0,
    };
  }

  const t0 = Date.now();
  try {
    const result = await fullSync(
      connectionId,
      existingTransactions,
      existingAccounts,
      userId,
      onNewTransactions,
      onUpdateAccount,
    );
    return {
      connection_id:         connectionId,
      bank_name:             conn.bank_name,
      status:                'success',
      transactions_imported: result.transactions_imported,
      balance_updated:       result.balance_updated,
      new_balance:           result.new_balance,
      sync_duration_ms:      Date.now() - t0,
    };
  } catch (err: any) {
    return {
      connection_id:         connectionId,
      bank_name:             conn.bank_name,
      status:                'error',
      transactions_imported: 0,
      balance_updated:       false,
      error:                 err?.message ?? 'Erro desconhecido',
      sync_duration_ms:      Date.now() - t0,
    };
  }
}

// ─── Auto-sync scheduler ──────────────────────────────────────────────────────

let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia sync automático periódico.
 * @param intervalMinutes - intervalo entre syncs (padrão 30 min)
 */
export function startAutoSync(
  existingTransactionsGetter: () => Transaction[],
  existingAccountsGetter: () => Account[],
  onNewTransactions: (txs: Partial<Transaction>[]) => void,
  onUpdateAccount: (acc: Account) => void,
  userId: string,
  intervalMinutes = 30
): void {
  stopAutoSync();
  autoSyncInterval = setInterval(async () => {
    const conns = getConnections(userId);
    if (conns.length === 0) return;
    try {
      await runBankSync(
        existingTransactionsGetter(),
        existingAccountsGetter(),
        onNewTransactions,
        onUpdateAccount,
        { userId, days: 7 } // daily sync = only last 7 days
      );
    } catch { /* silencioso */ }
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatSyncDuration(ms: number): string {
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}min`;
}

export function getSyncStatusSummary(userId: string): {
  total_banks:    number;
  connected:      number;
  last_sync:      string | null;
  needs_sync:     boolean;
} {
  const conns = getConnections(userId);
  const connected = conns.filter(c => c.connection_status === 'connected' || c.connection_status === 'syncing');
  const lastSyncTimes = conns
    .map(c => c.last_sync)
    .filter(Boolean)
    .sort()
    .reverse();
  const lastSync = lastSyncTimes[0] ?? null;

  // Needs sync if last sync was > 4 hours ago or never
  const needsSync = !lastSync || (Date.now() - new Date(lastSync).getTime()) > 4 * 60 * 60 * 1000;

  return {
    total_banks: conns.length,
    connected:   connected.length,
    last_sync:   lastSync,
    needs_sync:  needsSync,
  };
}
