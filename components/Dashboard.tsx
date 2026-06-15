import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  Settings as SettingsIcon,
  Wallet,
} from 'lucide-react';
import { Account } from '../models/Account';
import { Category, Receivable, Reminder, ReminderType, Transaction, TransactionType } from '../types';
import { isReceivablesSourceOfTruthEnabled } from '../src/finance/receivableFeatureFlag';
import {
  buildDashboardReceivableAggregate,
  isReceivableOverdue,
  isReceivablePending,
  isReceivableRealized,
} from '../src/finance/receivableService';
import {
  generateWeeklyCashReport,
  loadWeeklyCashReviewHistory,
  measureWeeklyCashReviewRetention,
  recordWeeklyCashReview,
} from '../src/finance/weeklyCashReview';
import { trackProductEventOnce } from '../src/app/productAnalytics';
import { VISUAL_SURFACES } from '../src/app/visualSystem';
import { addMoney, compareMoney, sumTransactions } from '../src/security/moneyMath';

interface DashboardProps {
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  activeWorkspaceId?: string | null;
  activeWorkspaceName?: string | null;
  activeWorkspacePlan?: 'free' | 'pro';
  transactions?: Transaction[];
  accounts?: Account[];
  alerts?: Array<{ id: string }>;
  reminders?: Reminder[];
  receivables?: Receivable[];
  hideValues?: boolean;
  onCreateAccount?: (account: { name: string; type: Account['type']; balance: number }) => void | Promise<void>;
  onAddTransactions?: (transactions: Partial<Transaction>[]) => void | Promise<void>;
  onAddReminder?: (reminder: Partial<Reminder>) => void | Promise<void>;
  onNavigateToInsights?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToFlow?: () => void;
  onNavigateToSettings?: () => void;
  onOpenEntryCapture?: () => void;
}

export interface DashboardMetrics {
  currentBalance: number;
  inflowMonth: number;
  outflowMonth: number;
  projectedRevenueMonth: number;
  pendingRevenueMonth: number;
  overdueRevenueAmount: number;
  confirmedRevenueMonth: number;
  activeAlerts: number;
}

export interface DashboardFocusNote {
  title: string;
  description: string;
}

export interface DashboardReminderStateSummary {
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
}

export interface DashboardNextReceivableSummary {
  amount: number;
  dueLabel: string;
  note: string;
}

export interface DashboardActivationStatus {
  hasInitialBalance: boolean;
  hasInflow: boolean;
  hasOutflow: boolean;
  hasReceivable: boolean;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
}

export function hasDashboardFinancialBase(metrics: DashboardMetrics): boolean {
  return metrics.currentBalance !== 0
    || metrics.inflowMonth !== 0
    || metrics.outflowMonth !== 0
    || metrics.pendingRevenueMonth !== 0
    || metrics.overdueRevenueAmount !== 0
    || metrics.activeAlerts > 0;
}

export function buildDashboardActivationStatus(
  transactions: Transaction[],
  accounts: Account[],
  reminders: Reminder[],
  receivables: Receivable[] = [],
): DashboardActivationStatus {
  const hasInitialBalance = accounts.some((account) => account.balance !== 0);
  const hasInflow = transactions.some((transaction) => transaction.type === TransactionType.RECEITA && !transaction.generated);
  const hasOutflow = transactions.some((transaction) => transaction.type === TransactionType.DESPESA && !transaction.generated);
  const hasReceivable = receivables.some((receivable) => isReceivablePending(receivable) || isReceivableOverdue(receivable))
    || reminders.some((reminder) => hasFinancialImpact(reminder));
  const completedSteps = [hasInitialBalance, hasInflow, hasOutflow, hasReceivable].filter(Boolean).length;

  return {
    hasInitialBalance,
    hasInflow,
    hasOutflow,
    hasReceivable,
    completedSteps,
    totalSteps: 4,
    isComplete: completedSteps === 4,
  };
}

function parseMoneyInput(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDefaultReceivableDate(): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return dueDate.toISOString();
}

function parseDate(value: string): Date | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameMonth(dateIso: string, referenceDate: Date): boolean {
  const date = parseDate(dateIso);
  if (!date) {
    return false;
  }

  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
  );
}

function isSameDay(dateIso: string, referenceDate: Date): boolean {
  const date = parseDate(dateIso);
  if (!date) {
    return false;
  }

  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
    && date.getDate() === referenceDate.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isOverdueReminder(reminder: Reminder, referenceDate: Date): boolean {
  const reminderDate = parseDate(reminder.date);
  if (!reminderDate) {
    return false;
  }

  return reminderDate.getTime() < startOfDay(referenceDate).getTime();
}

function hasFinancialImpact(reminder: Reminder): boolean {
  return !reminder.completed && Boolean(reminder.amount && compareMoney(reminder.amount, 0) > 0);
}

function daysBetween(dateIso: string, referenceDate: Date): number {
  const parsed = parseDate(dateIso);
  if (!parsed) {
    return Number.POSITIVE_INFINITY;
  }

  const reminderDay = startOfDay(parsed).getTime();
  const currentDay = startOfDay(referenceDate).getTime();
  return Math.round((reminderDay - currentDay) / (1000 * 60 * 60 * 24));
}

function buildDueLabel(distance: number): string {
  if (!Number.isFinite(distance)) {
    return 'Sem recebimentos previstos';
  }

  if (distance === 0) {
    return 'Vence hoje';
  }

  if (distance > 0) {
    return `Vence em ${distance} dia${distance === 1 ? '' : 's'}`;
  }

  const overdueDays = Math.abs(distance);
  return `Vencido ha ${overdueDays} dia${overdueDays === 1 ? '' : 's'}`;
}

function buildDashboardNextReceivableSummary(
  reminders: Reminder[],
  receivables: Receivable[],
  referenceDate: Date = new Date(),
  forceReceivablesSourceOfTruth?: boolean,
): DashboardNextReceivableSummary {
  if (shouldUseReceivablesAsSourceOfTruth(forceReceivablesSourceOfTruth)) {
    const activeReceivables = receivables
      .filter((receivable) => isReceivablePending(receivable, referenceDate) || isReceivableOverdue(receivable, referenceDate))
      .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date), 'pt-BR'));
    const nextReceivable = activeReceivables[0];

    if (!nextReceivable) {
      return {
        amount: 0,
        dueLabel: 'Sem recebimentos previstos',
        note: 'Receita prevista no curto prazo ainda nao apareceu.',
      };
    }

    const dueDistance = daysBetween(nextReceivable.due_date, referenceDate);

    return {
      amount: nextReceivable.expected_amount || 0,
      dueLabel: buildDueLabel(dueDistance),
      note: 'Receita prevista no curto prazo.',
    };
  }

  const activeReminders = reminders
    .filter((reminder) => hasFinancialImpact(reminder))
    .sort((left, right) => String(left.date).localeCompare(String(right.date), 'pt-BR'));
  const nextReminder = activeReminders[0];

  if (!nextReminder) {
    return {
      amount: 0,
      dueLabel: 'Sem recebimentos previstos',
      note: 'Receita prevista no curto prazo ainda nao apareceu.',
    };
  }

  const dueDistance = daysBetween(nextReminder.date, referenceDate);

  return {
    amount: nextReminder.amount || 0,
    dueLabel: buildDueLabel(dueDistance),
    note: 'Receita prevista no curto prazo.',
  };
}

function shouldUseReceivablesAsSourceOfTruth(force?: boolean): boolean {
  return typeof force === 'boolean' ? force : isReceivablesSourceOfTruthEnabled();
}

export function calculateDashboardMetrics(
  transactions: Transaction[],
  accounts: Account[],
  reminders: Reminder[],
  activeAlerts: number,
  referenceDate: Date = new Date(),
  receivables: Receivable[] = [],
  forceReceivablesSourceOfTruth?: boolean,
): DashboardMetrics {
  const currentBalance = sumTransactions(accounts.map((account) => account.balance));

  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.date, referenceDate));
  const inflowMonth = sumTransactions(
    monthTransactions
      .filter((transaction) => transaction.type === TransactionType.RECEITA)
      .map((transaction) => transaction.amount),
  );
  const outflowMonth = sumTransactions(
    monthTransactions
      .filter((transaction) => transaction.type === TransactionType.DESPESA)
      .map((transaction) => transaction.amount),
  );

  if (shouldUseReceivablesAsSourceOfTruth(forceReceivablesSourceOfTruth)) {
    const aggregate = buildDashboardReceivableAggregate(receivables, referenceDate);

    return {
      currentBalance,
      inflowMonth,
      outflowMonth,
      projectedRevenueMonth: aggregate.projected,
      pendingRevenueMonth: aggregate.pending,
      overdueRevenueAmount: aggregate.overdue,
      confirmedRevenueMonth: inflowMonth,
      activeAlerts,
    };
  }

  const monthFinancialReminders = reminders.filter((reminder) => hasFinancialImpact(reminder) && isSameMonth(reminder.date, referenceDate));
  const pendingRevenueMonth = sumTransactions(
    monthFinancialReminders
      .filter((reminder) => !isOverdueReminder(reminder, referenceDate))
      .map((reminder) => reminder.amount || 0),
  );
  const overdueRevenueAmount = sumTransactions(
    reminders
      .filter((reminder) => hasFinancialImpact(reminder) && isOverdueReminder(reminder, referenceDate))
      .map((reminder) => reminder.amount || 0),
  );
  const projectedRevenueMonth = addMoney(pendingRevenueMonth, overdueRevenueAmount);

  return {
    currentBalance,
    inflowMonth,
    outflowMonth,
    projectedRevenueMonth,
    pendingRevenueMonth,
    overdueRevenueAmount,
    confirmedRevenueMonth: inflowMonth,
    activeAlerts,
  };
}

export function buildDashboardFocusNote(metrics: DashboardMetrics): DashboardFocusNote {
  if (!hasDashboardFinancialBase(metrics)) {
    return {
      title: 'Faltam dados para ler o caixa',
      description: 'Cadastre saldo inicial, entradas/saidas ou recebiveis para comparar previsto vs realizado, enxergar risco e definir a proxima acao.',
    };
  }

  if (metrics.overdueRevenueAmount > 0) {
    return {
      title: 'Recebiveis vencidos pedem acao',
      description: `Ha valores fora do prazo que ainda nao entraram no caixa: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.overdueRevenueAmount)}.`,
    };
  }

  if (metrics.pendingRevenueMonth > 0) {
    return {
      title: 'Previstos ainda nao viraram caixa',
      description: `Ha valores esperados neste mes que nao entram no saldo atual: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.pendingRevenueMonth)}.`,
    };
  }

  if (metrics.currentBalance < 0) {
    return {
      title: 'Saldo negativo pede revisao',
      description: `O saldo consolidado esta negativo em ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(metrics.currentBalance))}.`,
    };
  }

  if (metrics.activeAlerts > 0) {
    return {
      title: 'Alertas pedem revisao',
      description: 'Revise os alertas ativos para evitar impacto no caixa de curto prazo.',
    };
  }

  if (metrics.inflowMonth >= metrics.outflowMonth) {
    return {
      title: 'Caixa sob controle',
      description: 'As entradas confirmadas do mes estao cobrindo as saidas registradas.',
    };
  }

  return {
    title: 'Saidas acima das entradas',
    description: 'O ritmo de saidas superou as entradas confirmadas do mes e merece atencao.',
  };
}

export function buildDashboardReminderStateSummary(
  reminders: Reminder[],
  referenceDate: Date = new Date(),
  receivables: Receivable[] = [],
  forceReceivablesSourceOfTruth?: boolean,
): DashboardReminderStateSummary {
  if (shouldUseReceivablesAsSourceOfTruth(forceReceivablesSourceOfTruth)) {
    const pendingReceivables = receivables.filter((receivable) => isReceivablePending(receivable, referenceDate));
    const overdueReceivables = receivables.filter((receivable) => isReceivableOverdue(receivable, referenceDate));

    return {
      pendingCount: pendingReceivables.length,
      pendingAmount: sumTransactions(pendingReceivables.map((receivable) => receivable.expected_amount || 0)),
      overdueCount: overdueReceivables.length,
      overdueAmount: sumTransactions(overdueReceivables.map((receivable) => receivable.expected_amount || 0)),
      dueTodayCount: pendingReceivables.filter((receivable) => isSameDay(receivable.due_date, referenceDate)).length,
      dueThisWeekCount: pendingReceivables.filter((receivable) => {
        const distance = daysBetween(receivable.due_date, referenceDate);
        return distance >= 0 && distance <= 7;
      }).length,
    };
  }

  const financialReminders = reminders.filter((reminder) => hasFinancialImpact(reminder));
  const pendingReminders = financialReminders.filter((reminder) => !isOverdueReminder(reminder, referenceDate));
  const overdueReminders = financialReminders.filter((reminder) => isOverdueReminder(reminder, referenceDate));

  return {
    pendingCount: pendingReminders.length,
    pendingAmount: sumTransactions(pendingReminders.map((reminder) => reminder.amount || 0)),
    overdueCount: overdueReminders.length,
    overdueAmount: sumTransactions(overdueReminders.map((reminder) => reminder.amount || 0)),
    dueTodayCount: pendingReminders.filter((reminder) => isSameDay(reminder.date, referenceDate)).length,
    dueThisWeekCount: pendingReminders.filter((reminder) => {
      const distance = daysBetween(reminder.date, referenceDate);
      return distance >= 0 && distance <= 7;
    }).length,
  };
}

const Dashboard: React.FC<DashboardProps> = ({
  userName,
  userId,
  activeWorkspaceName,
  activeWorkspaceId,
  activeWorkspacePlan = 'free',
  transactions = [],
  accounts = [],
  alerts = [],
  reminders = [],
  receivables = [],
  hideValues = false,
  onCreateAccount,
  onAddTransactions,
  onAddReminder,
  onNavigateToInsights,
  onNavigateToHistory,
  onNavigateToFlow,
  onNavigateToSettings,
  onOpenEntryCapture,
}) => {
  const metrics = useMemo(
    () => calculateDashboardMetrics(transactions, accounts, reminders, alerts.length, new Date(), receivables),
    [transactions, accounts, reminders, alerts.length, receivables],
  );
  const focusNote = useMemo(() => buildDashboardFocusNote(metrics), [metrics]);
  const nextReceivable = useMemo(
    () => buildDashboardNextReceivableSummary(reminders, receivables, new Date()),
    [reminders, receivables],
  );
  const reminderSummary = useMemo(
    () => buildDashboardReminderStateSummary(reminders, new Date(), receivables),
    [reminders, receivables],
  );
  const activationStatus = useMemo(
    () => buildDashboardActivationStatus(transactions, accounts, reminders, receivables),
    [accounts, receivables, reminders, transactions],
  );
  const weeklyReviewReport = useMemo(
    () => generateWeeklyCashReport({
      transactions,
      receivables,
      referenceDate: new Date(),
    }),
    [receivables, transactions],
  );
  const weeklyReviewHistory = useMemo(
    () => loadWeeklyCashReviewHistory(activeWorkspaceId),
    [activeWorkspaceId],
  );
  const weeklyReviewRetention = useMemo(
    () => measureWeeklyCashReviewRetention(weeklyReviewHistory, { lookbackWeeks: 4 }),
    [weeklyReviewHistory],
  );
  const currentWeekReview = useMemo(
    () => weeklyReviewHistory.find((entry) => entry.weekStart === weeklyReviewReport.weekStart) ?? null,
    [weeklyReviewHistory, weeklyReviewReport.weekStart],
  );
  const [activationForm, setActivationForm] = useState({
    initialBalance: '',
    inflow: '',
    outflow: '',
    receivable: '',
  });
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);
  const [isActivationSubmitting, setIsActivationSubmitting] = useState(false);
  const [weeklyReviewError, setWeeklyReviewError] = useState<string | null>(null);
  const [weeklyReviewSuccess, setWeeklyReviewSuccess] = useState<string | null>(null);
  const [isWeeklyReviewSubmitting, setIsWeeklyReviewSubmitting] = useState(false);

  const canSubmitActivation = Boolean(onCreateAccount || onAddTransactions || onAddReminder);
  const canSubmitWeeklyReview = Boolean(activeWorkspaceId && userId);

  const handleActivationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitActivation) {
      setActivationError('A captura guiada nao esta disponivel neste contexto.');
      return;
    }

    const initialBalance = parseMoneyInput(activationForm.initialBalance);
    const inflow = parseMoneyInput(activationForm.inflow);
    const outflow = parseMoneyInput(activationForm.outflow);
    const receivable = parseMoneyInput(activationForm.receivable);

    if (initialBalance <= 0 && inflow <= 0 && outflow <= 0 && receivable <= 0) {
      setActivationError('Preencha pelo menos um valor para montar a primeira leitura.');
      return;
    }

    setIsActivationSubmitting(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      if (!activationStatus.hasInitialBalance && initialBalance > 0 && onCreateAccount) {
        await onCreateAccount({
          name: 'Saldo inicial',
          type: 'cash',
          balance: initialBalance,
        });
      }

      const nextTransactions: Partial<Transaction>[] = [];
      if (!activationStatus.hasInflow && inflow > 0) {
        nextTransactions.push({
          amount: inflow,
          type: TransactionType.RECEITA,
          category: Category.NEGOCIO,
          description: 'Entrada inicial',
          date: new Date().toISOString(),
          source: 'manual',
        });
      }

      if (!activationStatus.hasOutflow && outflow > 0) {
        nextTransactions.push({
          amount: outflow,
          type: TransactionType.DESPESA,
          category: Category.NEGOCIO,
          description: 'Saida inicial',
          date: new Date().toISOString(),
          source: 'manual',
        });
      }

      if (nextTransactions.length > 0 && onAddTransactions) {
        await onAddTransactions(nextTransactions);
      }

      if (!activationStatus.hasReceivable && receivable > 0 && onAddReminder) {
        await onAddReminder({
          title: 'Recebivel inicial',
          date: buildDefaultReceivableDate(),
          type: ReminderType.NEGOCIO,
          amount: receivable,
          priority: 'alta',
          completed: false,
        });
      }

      setActivationForm({
        initialBalance: '',
        inflow: '',
        outflow: '',
        receivable: '',
      });
      setActivationSuccess('Base inicial registrada. Revise o dashboard apos a sincronizacao.');
    } catch (error) {
      setActivationError(error instanceof Error ? error.message : 'Nao foi possivel registrar a base inicial.');
    } finally {
      setIsActivationSubmitting(false);
    }
  };

  const handleWeeklyReviewSubmit = useCallback(() => {
    if (!canSubmitWeeklyReview || !activeWorkspaceId || !userId) {
      setWeeklyReviewError('A revisao semanal exige workspace ativo e usuario autenticado.');
      return;
    }

    setIsWeeklyReviewSubmitting(true);
    setWeeklyReviewError(null);
    setWeeklyReviewSuccess(null);

    try {
      const review = recordWeeklyCashReview(weeklyReviewReport, {
        workspaceId: activeWorkspaceId,
        reviewerId: userId,
      });
      const refreshedHistory = loadWeeklyCashReviewHistory(activeWorkspaceId);
      const refreshedRetention = measureWeeklyCashReviewRetention(refreshedHistory, { lookbackWeeks: 4 });
      const isRepeatReview = Boolean(currentWeekReview);
      setWeeklyReviewSuccess(
        isRepeatReview
          ? `Revisao desta semana atualizada para ${review.weekStart}. ${refreshedRetention.completedWeeks}/${refreshedRetention.expectedWeeks} semanas registradas.`
          : `Revisao desta semana registrada em ${review.weekStart}. ${refreshedRetention.completedWeeks}/${refreshedRetention.expectedWeeks} semanas registradas.`,
      );
    } catch (error) {
      setWeeklyReviewError(error instanceof Error ? error.message : 'Nao foi possivel registrar a revisao semanal.');
    } finally {
      setIsWeeklyReviewSubmitting(false);
    }
  }, [activeWorkspaceId, canSubmitWeeklyReview, currentWeekReview, userId, weeklyReviewReport]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  const valueOrHidden = (value: number) => (hideValues ? '••••••' : formatCurrency(value));
  const insightsActionTitle = activeWorkspacePlan === 'pro' ? 'Ver insights completos' : 'Ver insights essenciais';
  const insightsActionDescription = activeWorkspacePlan === 'pro'
    ? 'Abra analises profundas e comparativos historicos do periodo.'
    : 'Abra sinais principais para validar sua leitura de caixa.';
  const PANEL_SURFACE = VISUAL_SURFACES.workspace;
  const SECTION_DIVIDER = 'border-t border-slate-200/80 dark:border-slate-700/80';
  const hasFinancialBase = hasDashboardFinancialBase(metrics);

  useEffect(() => {
    if (!hasFinancialBase) {
      return;
    }

    trackProductEventOnce('activation_first_dashboard_useful', activeWorkspaceId || userId || activeWorkspaceName || 'dashboard', {
      workspace: activeWorkspaceName || null,
      transactions_count: transactions.filter((transaction) => !transaction.generated).length,
      inflow_month: metrics.inflowMonth,
      outflow_month: metrics.outflowMonth,
      pending_revenue_month: metrics.pendingRevenueMonth,
      overdue_revenue_amount: metrics.overdueRevenueAmount,
    });
  }, [
    activeWorkspaceId,
    activeWorkspaceName,
    hasFinancialBase,
    metrics.inflowMonth,
    metrics.outflowMonth,
    metrics.overdueRevenueAmount,
    metrics.pendingRevenueMonth,
    transactions,
    userId,
  ]);

  useEffect(() => {
    if (!activationStatus.isComplete) {
      return;
    }

    trackProductEventOnce(
      'activation_financial_base_completed',
      activeWorkspaceId || userId || activeWorkspaceName || 'dashboard-financial-base',
      {
        source: 'dashboard_activation',
        completed_steps: activationStatus.completedSteps,
        has_initial_balance: activationStatus.hasInitialBalance,
        has_inflow: activationStatus.hasInflow,
        has_outflow: activationStatus.hasOutflow,
        has_receivable: activationStatus.hasReceivable,
      },
    );
  }, [
    activeWorkspaceId,
    activeWorkspaceName,
    activationStatus.completedSteps,
    activationStatus.hasInitialBalance,
    activationStatus.hasInflow,
    activationStatus.hasOutflow,
    activationStatus.hasReceivable,
    activationStatus.isComplete,
    userId,
  ]);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <section className={`${PANEL_SURFACE} overflow-hidden`}>
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Caixa</p>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">Leitura rapida do caixa</h2>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-300">
                    {userName ? `${userName}, veja caixa real, previsto curto, pendente e vencido antes de abrir o resto.` : 'Veja caixa real, previsto curto, pendente e vencido antes de abrir o resto.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                    <span className="truncate">{activeWorkspaceName || 'Workspace ativo'}</span>
                  </span>
                  {onNavigateToSettings && (
                    <button
                      type="button"
                      onClick={onNavigateToSettings}
                      aria-label="Abrir ajustes"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                    >
                      <SettingsIcon size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/85 p-4 xl:hidden dark:border-amber-500/20 dark:bg-amber-500/10">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <CircleAlert size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">O que pede atencao</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{focusNote.title}</p>
                    <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{focusNote.description}</p>
                  </div>
                </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                  <CompactSignal label="Hoje" value={String(reminderSummary.dueTodayCount)} />
                  <CompactSignal label="7 dias" value={String(reminderSummary.dueThisWeekCount)} />
                  <CompactSignal label="Alertas" value={String(metrics.activeAlerts)} />
                </div>
              </div>

              <div className="mt-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Caixa real</p>
                  <h3 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                    {valueOrHidden(metrics.currentBalance)}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm font-semibold text-slate-500 dark:text-slate-300">
                    Dinheiro confirmado nas contas. Pendencia e atraso ficam fora deste total.
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Wallet size={18} />
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <ComparisonMetricCard
                  label="Caixa real"
                  value={valueOrHidden(metrics.currentBalance)}
                  tone="cash"
                  icon={<Wallet size={16} />}
                  description="Dinheiro confirmado agora"
                />
                <ComparisonMetricCard
                  label="Previsto curto"
                  value={valueOrHidden(weeklyReviewReport.projectedWeekCash)}
                  tone="forecast"
                  icon={<CalendarClock size={16} />}
                  description={nextReceivable.amount > 0 ? `${nextReceivable.dueLabel}. ${nextReceivable.note}` : nextReceivable.note}
                />
                <ComparisonMetricCard
                  label="Pendente"
                  value={valueOrHidden(metrics.pendingRevenueMonth)}
                  tone="pending"
                  icon={<Clock3 size={16} />}
                  description={`${reminderSummary.pendingCount} itens no curto prazo`}
                />
                <ComparisonMetricCard
                  label="Vencido"
                  value={valueOrHidden(metrics.overdueRevenueAmount)}
                  tone="overdue"
                  icon={<AlertTriangle size={16} />}
                  description={`${reminderSummary.overdueCount} itens fora do prazo`}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleWeeklyReviewSubmit}
                  disabled={isWeeklyReviewSubmitting || !canSubmitWeeklyReview}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700"
                >
                  {isWeeklyReviewSubmitting ? 'Registrando...' : 'Registrar revisao semanal'}
                </button>
                {onNavigateToFlow && (
                  <button
                    type="button"
                    onClick={onNavigateToFlow}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Abrir fluxo de caixa
                  </button>
                )}
                <span className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  {weeklyReviewRetention.completedWeeks}/{weeklyReviewRetention.expectedWeeks} semanas
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900/30">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Leitura rapida</p>
                <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Priorize caixa real, previsto curto, pendente e vencido antes de abrir o restante.
                </p>
              </div>
            </div>

            <div className="hidden rounded-[1.75rem] border border-amber-200 bg-amber-50/85 p-5 xl:block dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">O que pede atencao</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{focusNote.title}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{focusNote.description}</p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <CircleAlert size={16} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <UrgencyCard
                  label="Hoje"
                  value={String(reminderSummary.dueTodayCount)}
                  description="recebimentos com data de hoje"
                  tone="today"
                />
                <UrgencyCard
                  label="7 dias"
                  value={String(reminderSummary.dueThisWeekCount)}
                  description="recebimentos no curto prazo"
                  tone="week"
                />
                <UrgencyCard
                  label="Alertas"
                  value={String(metrics.activeAlerts)}
                  description="sinais ativos para revisar"
                  tone="alert"
                />
              </div>

              {reminderSummary.pendingCount > 0 && (
                <p className="mt-4 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Recebiveis pendentes no curto prazo: {reminderSummary.pendingCount} · {valueOrHidden(reminderSummary.pendingAmount)}
                </p>
              )}

              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                {currentWeekReview
                  ? `Revisao desta semana registrada em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(currentWeekReview.reviewedAt))}.`
                  : 'Ainda nao ha revisao registrada para a semana atual.'}
              </p>
            </div>
          </div>
        </div>

        <div className={SECTION_DIVIDER}>
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base da revisao</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Confirmado, previsto e vencido da semana</h3>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-300">
                  A acao principal fica no topo. Esta base mostra o que sustenta a revisao semanal de caixa.
                </p>
                <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  {weeklyReviewRetention.completedWeeks}/{weeklyReviewRetention.expectedWeeks} semanas registradas
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <StateRow
                label="Confirmado"
                description="Entradas e saidas desta semana"
                value={valueOrHidden(weeklyReviewReport.confirmedIncome)}
                tone="confirmed"
                icon={<CircleCheckBig size={16} />}
              />
              <StateRow
                label="Previsto"
                description="Caixa projetado ate o fechamento"
                value={valueOrHidden(weeklyReviewReport.projectedWeekCash)}
                tone="pending"
                icon={<CalendarClock size={16} />}
              />
              <StateRow
                label="Vencido"
                description="Recebiveis fora do prazo"
                value={valueOrHidden(weeklyReviewReport.overdueReceivables)}
                tone="overdue"
                icon={<AlertTriangle size={16} />}
              />
            </div>

            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-300">
              {currentWeekReview
                ? `Revisao desta semana registrada em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(currentWeekReview.reviewedAt))}.`
                : 'Ainda nao ha revisao registrada para a semana atual.'}
            </p>

            {(weeklyReviewError || weeklyReviewSuccess) && (
              <p className={`mt-3 text-sm font-semibold ${weeklyReviewError ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`} role="status">
                {weeklyReviewError || weeklyReviewSuccess}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={`${PANEL_SURFACE} overflow-hidden`}>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
          <div className="p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Estados financeiros</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">O que ja entrou, o que ainda nao entrou e o que esta atrasado</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <StateRow
                label="Confirmado"
                description="Ja entrou no caixa neste mes"
                value={valueOrHidden(metrics.confirmedRevenueMonth)}
                tone="confirmed"
                icon={<CircleCheckBig size={16} />}
              />
              <StateRow
                label="Pendente"
                description="Previsto para este mes, fora do saldo atual"
                value={valueOrHidden(metrics.pendingRevenueMonth)}
                tone="pending"
                icon={<Clock3 size={16} />}
              />
              <StateRow
                label="Vencido"
                description="Valor fora do prazo e ainda nao recebido"
                value={valueOrHidden(metrics.overdueRevenueAmount)}
                tone="overdue"
                icon={<AlertTriangle size={16} />}
              />
            </div>
          </div>

          <div className="p-5 sm:p-6 lg:border-l lg:border-slate-200/80 dark:lg:border-slate-700/80">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura de recebiveis</p>
            <div className="mt-4 space-y-3">
              <MiniSummaryRow
                label="Pendente"
                count={reminderSummary.pendingCount}
                value={valueOrHidden(reminderSummary.pendingAmount)}
                tone="pending"
              />
              <MiniSummaryRow
                label="Vencido"
                count={reminderSummary.overdueCount}
                value={valueOrHidden(reminderSummary.overdueAmount)}
                tone="overdue"
              />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-300">
              Recebivel pendente nao aparece como dinheiro disponivel. Recebivel vencido pede acao antes de contar com ele.
            </p>
          </div>
        </div>

        <div className={SECTION_DIVIDER}>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Acoes principais</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Siga para as telas que mudam a decisao do dia</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <PrimaryActionButton
                title="Ver transacoes"
                description="Confira o que entrou, saiu e precisa de ajuste."
                onClick={onNavigateToHistory}
              />
              <PrimaryActionButton
                title="Abrir fluxo de caixa"
                description="Leia o movimento do periodo sem sair do core financeiro."
                onClick={onNavigateToFlow}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <QuickActionButton
                title={insightsActionTitle}
                description={insightsActionDescription}
                onClick={onNavigateToInsights}
              />
              <QuickActionButton
                title="Ver receitas previstas"
                description="Acompanhe o que ainda deve entrar no caixa nos proximos dias."
                onClick={onNavigateToFlow}
              />
            </div>
          </div>
        </div>
      </section>

      {!activationStatus.isComplete && (
        <section className={`${PANEL_SURFACE} p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ativacao</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Monte a primeira leitura de caixa</h3>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-300">
                Registre saldo, entrada, saida e recebivel para o Flow separar caixa real, previsto e risco da semana.
              </p>
              <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                {activationStatus.completedSteps}/{activationStatus.totalSteps} sinais prontos
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {onOpenEntryCapture && (
                <button
                  type="button"
                  onClick={onOpenEntryCapture}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Adicionar lancamento
                </button>
              )}
              {onNavigateToFlow && (
                <button
                  type="button"
                  onClick={onNavigateToFlow}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Ver fluxo previsto
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActivationStep completed={activationStatus.hasInitialBalance} label="1" title="Saldo inicial" description="Quanto existe hoje nas contas." />
            <ActivationStep completed={activationStatus.hasInflow} label="2" title="Entrada confirmada" description="Dinheiro que ja entrou no mes." />
            <ActivationStep completed={activationStatus.hasOutflow} label="3" title="Saida registrada" description="Custo real ja assumido no mes." />
            <ActivationStep completed={activationStatus.hasReceivable} label="4" title="Recebivel pendente" description="Valor previsto fora do caixa atual." />
          </div>

          <form onSubmit={handleActivationSubmit} className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/30 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <ActivationMoneyField
              label="Saldo hoje"
              value={activationForm.initialBalance}
              disabled={activationStatus.hasInitialBalance}
              onChange={(value) => setActivationForm((current) => ({ ...current, initialBalance: value }))}
            />
            <ActivationMoneyField
              label="Entrada"
              value={activationForm.inflow}
              disabled={activationStatus.hasInflow}
              onChange={(value) => setActivationForm((current) => ({ ...current, inflow: value }))}
            />
            <ActivationMoneyField
              label="Saida"
              value={activationForm.outflow}
              disabled={activationStatus.hasOutflow}
              onChange={(value) => setActivationForm((current) => ({ ...current, outflow: value }))}
            />
            <ActivationMoneyField
              label="Recebivel"
              value={activationForm.receivable}
              disabled={activationStatus.hasReceivable}
              onChange={(value) => setActivationForm((current) => ({ ...current, receivable: value }))}
            />
            <button
              type="submit"
              disabled={isActivationSubmitting || !canSubmitActivation}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700"
            >
              {isActivationSubmitting ? 'Salvando...' : 'Salvar base'}
            </button>
            {(activationError || activationSuccess) && (
              <p className={`lg:col-span-5 text-sm font-semibold ${activationError ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`} role="status">
                {activationError || activationSuccess}
              </p>
            )}
          </form>
        </section>
      )}
    </div>
  );
};

const COMPARISON_TONE_CLASS_MAP = {
  cash: 'border-slate-200/80 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200',
  forecast: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  pending: 'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  overdue: 'border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
};

const STATE_TONE_CLASS_MAP = {
  confirmed: 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  pending: 'border-amber-200 bg-amber-50/90 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  overdue: 'border-rose-200 bg-rose-50/90 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
};

const URGENCY_TONE_CLASS_MAP = {
  today: 'border-amber-200 bg-white/80 dark:border-amber-500/20 dark:bg-slate-900/20',
  week: 'border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/20',
  alert: 'border-rose-200 bg-white/80 dark:border-rose-500/20 dark:bg-slate-900/20',
};

const MINI_SUMMARY_TONE_CLASS_MAP = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

const ActivationMoneyField: React.FC<{
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}> = ({
  label,
  value,
  disabled = false,
  onChange,
}) => (
  <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={disabled ? 'Registrado' : '0,00'}
      className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-slate-500 dark:disabled:bg-slate-800"
    />
  </label>
);

const ActivationStep: React.FC<{
  label: string;
  title: string;
  description: string;
  completed?: boolean;
}> = ({ label, title, description, completed = false }) => (
  <div className={`rounded-2xl border p-4 ${completed ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/30'}`}>
    <div className="flex items-start gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${completed ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
        {completed ? 'OK' : label}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-300">{description}</p>
      </div>
    </div>
  </div>
);

const ComparisonMetricCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'cash' | 'forecast' | 'pending' | 'overdue';
  description?: string;
}> = ({
  label,
  value,
  icon,
  tone,
  description,
}) => (
  <div className={`rounded-[1.5rem] border px-4 py-3 shadow-none ${COMPARISON_TONE_CLASS_MAP[tone]}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <span className="rounded-lg p-1.5">{icon}</span>
    </div>
    <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white sm:text-xl">{value}</p>
    {description && <p className="mt-1 text-sm font-medium opacity-80">{description}</p>}
  </div>
);

const StateRow: React.FC<{
  label: string;
  description: string;
  value: string;
  icon: React.ReactNode;
  tone: 'confirmed' | 'pending' | 'overdue';
}> = ({
  label,
  description,
  value,
  icon,
  tone,
}) => (
  <div className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${STATE_TONE_CLASS_MAP[tone]}`}>
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 rounded-xl p-2">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">{label}</p>
        <p className="mt-1 text-sm font-medium opacity-80">{description}</p>
      </div>
    </div>
    <p className="text-right text-xl font-semibold tracking-tight">{value}</p>
  </div>
);

const UrgencyCard: React.FC<{
  label: string;
  value: string;
  description: string;
  tone: 'today' | 'week' | 'alert';
}> = ({
  label,
  value,
  description,
  tone,
}) => (
  <div className={`rounded-2xl border p-4 ${URGENCY_TONE_CLASS_MAP[tone]}`}>
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">{description}</p>
  </div>
);

const CompactSignal: React.FC<{
  label: string;
  value: string;
}> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/20">
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-base font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
  </div>
);

const MiniSummaryRow: React.FC<{
  label: string;
  count: number;
  value: string;
  tone: 'pending' | 'overdue';
}> = ({
  label,
  count,
  value,
  tone,
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-700">
    <div>
      <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">{count} item{count === 1 ? '' : 's'}</p>
    </div>
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${MINI_SUMMARY_TONE_CLASS_MAP[tone]}`}>
      {value}
    </span>
  </div>
);

const PrimaryActionButton: React.FC<{ title: string; description: string; onClick?: () => void }> = ({
  title,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-between rounded-2xl border border-slate-900 bg-slate-900 px-5 py-4 text-left text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.5)] transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
  >
    <span>
      <span className="block text-sm font-semibold tracking-tight">{title}</span>
      <span className="mt-1 block text-sm font-medium text-slate-200 dark:text-slate-700">{description}</span>
    </span>
    <ChevronRight size={16} className="text-current" />
  </button>
);

const QuickActionButton: React.FC<{ title: string; description: string; onClick?: () => void }> = ({
  title,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-500 dark:hover:bg-slate-900/70"
  >
    <span>
      <span className="block text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</span>
      <span className="mt-1 block text-sm font-medium text-slate-500 dark:text-slate-300">{description}</span>
    </span>
    <ChevronRight size={16} className="text-slate-400" />
  </button>
);

export default Dashboard;
