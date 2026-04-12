import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  Wallet,
} from 'lucide-react';
import { Account } from '../models/Account';
import { Reminder, Transaction, TransactionType } from '../types';

interface DashboardProps {
  userName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  activeWorkspaceName?: string | null;
  activeWorkspacePlan?: 'free' | 'pro';
  transactions?: Transaction[];
  accounts?: Account[];
  alerts?: Array<{ id: string }>;
  reminders?: Reminder[];
  hideValues?: boolean;
  onNavigateToAccounts?: () => void;
  onNavigateToInsights?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToFlow?: () => void;
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

function isSameMonth(dateIso: string, referenceDate: Date): boolean {
  const date = new Date(dateIso);
  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
  );
}

function isSameDay(dateIso: string, referenceDate: Date): boolean {
  const date = new Date(dateIso);
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
  return new Date(reminder.date).getTime() < startOfDay(referenceDate).getTime();
}

function hasFinancialImpact(reminder: Reminder): boolean {
  return !reminder.completed && Boolean(reminder.amount && reminder.amount > 0);
}

function daysBetween(dateIso: string, referenceDate: Date): number {
  const reminderDay = startOfDay(new Date(dateIso)).getTime();
  const currentDay = startOfDay(referenceDate).getTime();
  return Math.round((reminderDay - currentDay) / (1000 * 60 * 60 * 24));
}

export function calculateDashboardMetrics(
  transactions: Transaction[],
  accounts: Account[],
  reminders: Reminder[],
  activeAlerts: number,
  referenceDate: Date = new Date(),
): DashboardMetrics {
  const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0);

  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.date, referenceDate));
  const inflowMonth = monthTransactions
    .filter((transaction) => transaction.type === TransactionType.RECEITA)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const outflowMonth = monthTransactions
    .filter((transaction) => transaction.type === TransactionType.DESPESA)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const monthFinancialReminders = reminders.filter((reminder) => hasFinancialImpact(reminder) && isSameMonth(reminder.date, referenceDate));
  const pendingRevenueMonth = monthFinancialReminders
    .filter((reminder) => !isOverdueReminder(reminder, referenceDate))
    .reduce((sum, reminder) => sum + (reminder.amount || 0), 0);
  const overdueRevenueAmount = reminders
    .filter((reminder) => hasFinancialImpact(reminder) && isOverdueReminder(reminder, referenceDate))
    .reduce((sum, reminder) => sum + (reminder.amount || 0), 0);
  const projectedRevenueMonth = pendingRevenueMonth + overdueRevenueAmount;

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
): DashboardReminderStateSummary {
  const financialReminders = reminders.filter((reminder) => hasFinancialImpact(reminder));
  const pendingReminders = financialReminders.filter((reminder) => !isOverdueReminder(reminder, referenceDate));
  const overdueReminders = financialReminders.filter((reminder) => isOverdueReminder(reminder, referenceDate));

  return {
    pendingCount: pendingReminders.length,
    pendingAmount: pendingReminders.reduce((sum, reminder) => sum + (reminder.amount || 0), 0),
    overdueCount: overdueReminders.length,
    overdueAmount: overdueReminders.reduce((sum, reminder) => sum + (reminder.amount || 0), 0),
    dueTodayCount: pendingReminders.filter((reminder) => isSameDay(reminder.date, referenceDate)).length,
    dueThisWeekCount: pendingReminders.filter((reminder) => {
      const distance = daysBetween(reminder.date, referenceDate);
      return distance >= 0 && distance <= 7;
    }).length,
  };
}

const Dashboard: React.FC<DashboardProps> = ({
  userName,
  activeWorkspaceName,
  activeWorkspacePlan = 'free',
  transactions = [],
  accounts = [],
  alerts = [],
  reminders = [],
  hideValues = false,
  onNavigateToAccounts,
  onNavigateToInsights,
  onNavigateToHistory,
  onNavigateToFlow,
}) => {
  const metrics = useMemo(
    () => calculateDashboardMetrics(transactions, accounts, reminders, alerts.length),
    [transactions, accounts, reminders, alerts.length],
  );
  const focusNote = useMemo(() => buildDashboardFocusNote(metrics), [metrics]);
  const reminderSummary = useMemo(
    () => buildDashboardReminderStateSummary(reminders),
    [reminders],
  );

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  const valueOrHidden = (value: number) => (hideValues ? '••••••' : formatCurrency(value));
  const netMonth = metrics.inflowMonth - metrics.outflowMonth;
  const insightsActionTitle = activeWorkspacePlan === 'pro' ? 'Ver insights completos' : 'Ver insights essenciais';
  const insightsActionDescription = activeWorkspacePlan === 'pro'
    ? 'Abra analises profundas e comparativos historicos do periodo.'
    : 'Abra sinais principais para validar sua leitura de caixa.';

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dashboard</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Leitura rapida do caixa</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {userName ? `${userName}, veja o que entrou, saiu e exige acao.` : 'Veja o que entrou, saiu e exige acao no workspace ativo.'}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right dark:bg-slate-700">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Workspace ativo</p>
            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
              {activeWorkspaceName || 'Carregando workspace'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Saldo atual</p>
              <h3 className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                {valueOrHidden(metrics.currentBalance)}
              </h3>
              <p className="mt-2 max-w-md text-sm font-semibold text-slate-500 dark:text-slate-300">
                Dinheiro confirmado nas contas. Valores pendentes e vencidos nao entram neste total.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Wallet size={18} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ComparisonMetricCard
              label="Entrou no mes"
              value={valueOrHidden(metrics.inflowMonth)}
              tone="positive"
              icon={<ArrowUpRight size={16} />}
            />
            <ComparisonMetricCard
              label="Saiu no mes"
              value={valueOrHidden(metrics.outflowMonth)}
              tone="negative"
              icon={<ArrowDownRight size={16} />}
            />
            <ComparisonMetricCard
              label="Saldo do mes"
              value={valueOrHidden(netMonth)}
              tone={netMonth >= 0 ? 'positive' : 'negative'}
              icon={<CalendarClock size={16} />}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Estados financeiros</p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">O que ja entrou, o que ainda nao entrou e o que esta atrasado</p>
            </div>
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
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">O que pede atencao</p>
              <p className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">{focusNote.title}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{focusNote.description}</p>
            </div>
            <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <CircleAlert size={16} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
            <p className="mt-4 text-xs font-black text-amber-800 dark:text-amber-200">
              Recebiveis pendentes no curto prazo: {reminderSummary.pendingCount} · {valueOrHidden(reminderSummary.pendingAmount)}
            </p>
          )}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Leitura de recebiveis</p>
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
          <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Recebivel pendente nao aparece como dinheiro disponivel. Recebivel vencido pede acao antes de contar com ele.
          </p>
        </section>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Acoes principais</p>
            <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Siga para as telas que mudam a decisao do dia</p>
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
            title="Gerenciar contas"
            description="Consulte saldos e contas cadastradas do workspace."
            onClick={onNavigateToAccounts}
          />
        </div>
      </div>
    </div>
  );
};

const COMPARISON_TONE_CLASS_MAP = {
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  negative: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
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

const ComparisonMetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode; tone: 'positive' | 'negative' }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className={`rounded-[1.5rem] border p-4 ${COMPARISON_TONE_CLASS_MAP[tone]}`}>
    <div className="flex items-center justify-between">
      <p className="text-[8px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
      <span className="rounded-lg p-1.5">{icon}</span>
    </div>
    <p className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
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
  <div className={`flex items-center justify-between gap-4 rounded-[1.4rem] border px-4 py-3 ${STATE_TONE_CLASS_MAP[tone]}`}>
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 rounded-xl p-2">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-black tracking-tight">{label}</p>
        <p className="mt-1 text-xs font-semibold opacity-80">{description}</p>
      </div>
    </div>
    <p className="text-right text-lg font-black tracking-tight">{value}</p>
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
  <div className={`rounded-[1.4rem] border p-4 ${URGENCY_TONE_CLASS_MAP[tone]}`}>
    <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{description}</p>
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
  <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-slate-200 px-4 py-3 dark:border-slate-700">
    <div>
      <p className="text-sm font-black tracking-tight text-slate-900 dark:text-white">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{count} item{count === 1 ? '' : 's'}</p>
    </div>
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${MINI_SUMMARY_TONE_CLASS_MAP[tone]}`}>
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
    className="flex items-center justify-between rounded-[1.6rem] border border-slate-900 bg-slate-900 px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
  >
    <span>
      <span className="block text-sm font-black tracking-tight">{title}</span>
      <span className="mt-1 block text-xs font-semibold text-slate-200 dark:text-slate-700">{description}</span>
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
    className="flex items-center justify-between rounded-[1.6rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-500 dark:hover:bg-slate-900/70"
  >
    <span>
      <span className="block text-sm font-black tracking-tight text-slate-900 dark:text-white">{title}</span>
      <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">{description}</span>
    </span>
    <ChevronRight size={16} className="text-slate-400" />
  </button>
);

export default Dashboard;
