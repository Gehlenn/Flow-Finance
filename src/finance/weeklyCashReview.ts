import type { Receivable, Transaction } from '../../types';
import { TransactionType } from '../../types';
import { trackProductEventOnce } from '../app/productAnalytics';
import { roundMoney, sumTransactions } from '../security/moneyMath';
import { getWorkspaceScopedStorageKey } from '../utils/workspaceStorage';

const WEEKLY_REVIEW_STORAGE_KEY = 'flow_weekly_cash_reviews';
const MAX_WEEKLY_REVIEWS = 26;

type CashReviewOutcome = 'positive' | 'tight' | 'negative';

export interface WeeklyCashReport {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  confirmedIncome: number;
  confirmedExpenses: number;
  netConfirmedCash: number;
  projectedReceivables: number;
  overdueReceivables: number;
  realizedReceivables: number;
  projectedWeekCash: number;
  transactionCount: number;
  receivableCount: number;
  risks: string[];
  nextActions: string[];
  outcome: CashReviewOutcome;
}

export interface WeeklyCashReviewRecord extends WeeklyCashReport {
  reviewedAt: string;
  reviewerId?: string;
}

export interface WeeklyCashReviewRetention {
  expectedWeeks: number;
  completedWeeks: number;
  completionRate: number;
  currentStreakWeeks: number;
  lastReviewedWeekStart?: string;
  evidence: 'local_review_history' | 'no_review_history';
}

interface WeeklyCashReportInput {
  transactions: Transaction[];
  receivables?: Receivable[];
  referenceDate?: string | Date;
}

interface RecordWeeklyCashReviewOptions {
  workspaceId?: string | null;
  reviewerId?: string;
}

interface MeasureWeeklyCashReviewRetentionOptions {
  referenceDate?: string | Date;
  lookbackWeeks?: number;
}

function parseDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function getWeekBounds(referenceDate: Date): { start: Date; end: Date } {
  const reference = startOfDay(referenceDate);
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(reference);
  start.setDate(reference.getDate() + mondayOffset);
  const end = endOfDay(new Date(start));
  end.setDate(start.getDate() + 6);

  return { start, end };
}

function getWeekStartKey(referenceDate: Date): string {
  return toDateKey(getWeekBounds(referenceDate).start);
}

function isBetween(dateValue: string | Date, start: Date, end: Date): boolean {
  const parsed = parseDate(dateValue);
  return Boolean(parsed && parsed >= start && parsed <= end);
}

function buildRisks(report: Omit<WeeklyCashReport, 'risks' | 'nextActions' | 'outcome'>): string[] {
  const risks: string[] = [];

  if (report.netConfirmedCash < 0) {
    risks.push('Saidas confirmadas superam entradas confirmadas na semana.');
  }
  if (report.projectedWeekCash < 0) {
    risks.push('Mesmo com recebiveis previstos, a semana fecha negativa.');
  }
  if (report.overdueReceivables > 0) {
    risks.push('Ha recebiveis vencidos afetando a leitura de caixa.');
  }
  if (report.transactionCount === 0 && report.receivableCount === 0) {
    risks.push('Base semanal insuficiente para uma revisao confiavel.');
  }

  return risks;
}

function buildNextActions(report: Omit<WeeklyCashReport, 'risks' | 'nextActions' | 'outcome'>): string[] {
  const actions: string[] = [];

  if (report.overdueReceivables > 0) {
    actions.push('Cobrar recebiveis vencidos antes de assumir novas saidas.');
  }
  if (report.projectedReceivables > 0) {
    actions.push('Confirmar quais recebiveis da semana realmente entram no caixa.');
  }
  if (report.netConfirmedCash < 0) {
    actions.push('Adiar ou renegociar saidas nao essenciais da semana.');
  }
  if (actions.length === 0) {
    actions.push('Registrar a revisao semanal e comparar previsto vs realizado na proxima semana.');
  }

  return actions;
}

function resolveOutcome(projectedWeekCash: number, overdueReceivables: number): CashReviewOutcome {
  if (projectedWeekCash < 0) return 'negative';
  if (overdueReceivables > 0 || projectedWeekCash < 500) return 'tight';
  return 'positive';
}

function getReviewStorageKey(workspaceId?: string | null): string {
  return getWorkspaceScopedStorageKey(WEEKLY_REVIEW_STORAGE_KEY, workspaceId);
}

export function generateWeeklyCashReport(input: WeeklyCashReportInput): WeeklyCashReport {
  const reference = parseDate(input.referenceDate ?? new Date()) ?? new Date();
  const { start, end } = getWeekBounds(reference);
  const weeklyTransactions = input.transactions.filter((transaction) => isBetween(transaction.date, start, end));
  const weeklyReceivables = (input.receivables ?? []).filter((receivable) => isBetween(receivable.due_date, start, end));
  const realizedReceivables = (input.receivables ?? []).filter((receivable) => (
    receivable.status === 'realized'
    && receivable.realized_at
    && isBetween(receivable.realized_at, start, end)
  ));
  const overdueReceivables = (input.receivables ?? []).filter((receivable) => {
    const dueDate = parseDate(receivable.due_date);
    return Boolean(
      dueDate
      && dueDate < start
      && (receivable.status === 'open' || receivable.status === 'overdue')
    );
  });

  const confirmedIncome = sumTransactions(
    weeklyTransactions
      .filter((transaction) => transaction.type === TransactionType.RECEITA)
      .map((transaction) => transaction.amount),
  );
  const confirmedExpenses = sumTransactions(
    weeklyTransactions
      .filter((transaction) => transaction.type === TransactionType.DESPESA)
      .map((transaction) => transaction.amount),
  );
  const projectedReceivables = sumTransactions(
    weeklyReceivables
      .filter((receivable) => receivable.status === 'open')
      .map((receivable) => receivable.expected_amount - receivable.realized_amount),
  );
  const overdueReceivableTotal = sumTransactions(
    overdueReceivables.map((receivable) => receivable.expected_amount - receivable.realized_amount),
  );
  const realizedReceivableTotal = sumTransactions(
    realizedReceivables.map((receivable) => receivable.realized_amount),
  );

  const baseReport = {
    weekStart: toDateKey(start),
    weekEnd: toDateKey(end),
    generatedAt: new Date().toISOString(),
    confirmedIncome: roundMoney(confirmedIncome),
    confirmedExpenses: roundMoney(confirmedExpenses),
    netConfirmedCash: roundMoney(confirmedIncome - confirmedExpenses),
    projectedReceivables: roundMoney(projectedReceivables),
    overdueReceivables: roundMoney(overdueReceivableTotal),
    realizedReceivables: roundMoney(realizedReceivableTotal),
    projectedWeekCash: roundMoney(confirmedIncome + projectedReceivables - confirmedExpenses),
    transactionCount: weeklyTransactions.length,
    receivableCount: weeklyReceivables.length + overdueReceivables.length + realizedReceivables.length,
  };

  return {
    ...baseReport,
    risks: buildRisks(baseReport),
    nextActions: buildNextActions(baseReport),
    outcome: resolveOutcome(baseReport.projectedWeekCash, baseReport.overdueReceivables),
  };
}

export function loadWeeklyCashReviewHistory(workspaceId?: string | null): WeeklyCashReviewRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getReviewStorageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is WeeklyCashReviewRecord => (
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as WeeklyCashReviewRecord).weekStart === 'string'
      && typeof (entry as WeeklyCashReviewRecord).reviewedAt === 'string'
    ));
  } catch {
    return [];
  }
}

export function recordWeeklyCashReview(
  report: WeeklyCashReport,
  options: RecordWeeklyCashReviewOptions = {},
): WeeklyCashReviewRecord {
  const record: WeeklyCashReviewRecord = {
    ...report,
    reviewedAt: new Date().toISOString(),
    reviewerId: options.reviewerId,
  };

  if (typeof window !== 'undefined') {
    const previous = loadWeeklyCashReviewHistory(options.workspaceId);
    const deduped = previous.filter((entry) => entry.weekStart !== record.weekStart);
    window.localStorage.setItem(
      getReviewStorageKey(options.workspaceId),
      JSON.stringify([record, ...deduped].slice(0, MAX_WEEKLY_REVIEWS)),
    );
  }

  trackProductEventOnce(
    'weekly_cash_review_completed',
    `${options.workspaceId || 'local'}:${record.weekStart}`,
    {
      source: 'weekly_cash_review',
      week_start: record.weekStart,
      outcome: record.outcome,
      has_overdue_receivables: record.overdueReceivables > 0,
      transaction_count: record.transactionCount,
      receivable_count: record.receivableCount,
    },
  );

  return record;
}

export function measureWeeklyCashReviewRetention(
  history: WeeklyCashReviewRecord[],
  options: MeasureWeeklyCashReviewRetentionOptions = {},
): WeeklyCashReviewRetention {
  const expectedWeeks = Math.max(1, Math.min(26, Math.floor(options.lookbackWeeks ?? 4)));
  const reference = parseDate(options.referenceDate ?? new Date()) ?? new Date();
  const reviewedWeeks = new Set(history.map((entry) => entry.weekStart));
  const expectedWeekStarts: string[] = [];

  for (let index = 0; index < expectedWeeks; index++) {
    const weekReference = new Date(reference);
    weekReference.setDate(reference.getDate() - index * 7);
    expectedWeekStarts.push(getWeekStartKey(weekReference));
  }

  const completedWeeks = expectedWeekStarts.filter((weekStart) => reviewedWeeks.has(weekStart)).length;
  let currentStreakWeeks = 0;
  for (const weekStart of expectedWeekStarts) {
    if (!reviewedWeeks.has(weekStart)) break;
    currentStreakWeeks++;
  }

  return {
    expectedWeeks,
    completedWeeks,
    completionRate: Math.round((completedWeeks / expectedWeeks) * 10_000) / 10_000,
    currentStreakWeeks,
    lastReviewedWeekStart: history[0]?.weekStart,
    evidence: history.length > 0 ? 'local_review_history' : 'no_review_history',
  };
}
