import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarClock, ChevronRight, Wallet } from 'lucide-react';
import { Account } from '../models/Account';
import { Reminder, Transaction, TransactionType } from '../types';

interface DashboardProps {
  userName?: string | null;
  activeWorkspaceName?: string | null;
  transactions?: Transaction[];
  accounts?: Account[];
  alerts?: Array<{ id: string }>;
  reminders?: Reminder[];
  hideValues?: boolean;
  onNavigateToAccounts?: () => void;
  onNavigateToInsights?: () => void;
}

export interface DashboardMetrics {
  currentBalance: number;
  inflowMonth: number;
  outflowMonth: number;
  projectedRevenueMonth: number;
  confirmedRevenueMonth: number;
  activeAlerts: number;
}

function isSameMonth(dateIso: string, referenceDate: Date): boolean {
  const date = new Date(dateIso);
  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
  );
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

  const projectedRevenueMonth = reminders
    .filter((reminder) => !reminder.completed && Boolean(reminder.amount) && isSameMonth(reminder.date, referenceDate))
    .reduce((sum, reminder) => sum + (reminder.amount || 0), 0);

  return {
    currentBalance,
    inflowMonth,
    outflowMonth,
    projectedRevenueMonth,
    confirmedRevenueMonth: inflowMonth,
    activeAlerts,
  };
}

const Dashboard: React.FC<DashboardProps> = ({
  userName,
  activeWorkspaceName,
  transactions = [],
  accounts = [],
  alerts = [],
  reminders = [],
  hideValues = false,
  onNavigateToAccounts,
  onNavigateToInsights,
}) => {
  const metrics = useMemo(
    () => calculateDashboardMetrics(transactions, accounts, reminders, alerts.length),
    [transactions, accounts, reminders, alerts.length],
  );

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  const valueOrHidden = (value: number) => (hideValues ? '••••••' : formatCurrency(value));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dashboard</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Caixa e Decisao</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {userName ? `Bom trabalho, ${userName}.` : 'Visao financeira do workspace ativo.'}
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

      <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo atual</p>
          <Wallet size={16} className="text-indigo-500" />
        </div>
        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {valueOrHidden(metrics.currentBalance)}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
          Entradas e saidas consolidadas pelas contas cadastradas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Entradas no mes"
          value={valueOrHidden(metrics.inflowMonth)}
          tone="positive"
          icon={<ArrowUpRight size={14} />}
        />
        <MetricCard
          label="Saidas no mes"
          value={valueOrHidden(metrics.outflowMonth)}
          tone="negative"
          icon={<ArrowDownRight size={14} />}
        />
        <MetricCard
          label="Receitas previstas"
          value={valueOrHidden(metrics.projectedRevenueMonth)}
          tone="neutral"
          icon={<CalendarClock size={14} />}
        />
        <MetricCard
          label="Receitas confirmadas"
          value={valueOrHidden(metrics.confirmedRevenueMonth)}
          tone="positive"
          icon={<Wallet size={14} />}
        />
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alertas</p>
          <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
            {metrics.activeAlerts} alerta{metrics.activeAlerts === 1 ? '' : 's'} ativo{metrics.activeAlerts === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            Priorize os alertas para reduzir risco de caixa no curto prazo.
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Acoes rapidas</p>
            <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Acesse detalhes sem poluir a navegacao principal</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickActionButton
            title="Ver insights"
            description="Abra leituras e sinais do periodo atual."
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

const METRIC_TONE_CLASS_MAP = {
  positive: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
  negative: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
  neutral: 'text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/10',
};

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode; tone: 'positive' | 'negative' | 'neutral' }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-center justify-between">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <span className={`rounded-lg p-1.5 ${METRIC_TONE_CLASS_MAP[tone]}`}>{icon}</span>
    </div>
    <p className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
  </div>
);

const QuickActionButton: React.FC<{ title: string; description: string; onClick?: () => void }> = ({
  title,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center justify-between rounded-[1.6rem] border border-slate-100 bg-slate-50 px-4 py-4 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
  >
    <span>
      <span className="block text-sm font-black tracking-tight text-slate-900 dark:text-white">{title}</span>
      <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-300">{description}</span>
    </span>
    <ChevronRight size={16} className="text-slate-400" />
  </button>
);

export default Dashboard;
