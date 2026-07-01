import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart
} from 'recharts';
import { formatCurrency } from '../utils/helpers';
import { Transaction, TransactionType } from '../types';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import { buildMonthlyForecast } from '../src/engines/finance/forecastEngine';
import { addMoney, compareMoney, divideMoney, multiplyMoney, roundMoney, subtractMoney } from '../src/security/moneyMath';
import { FLOW_CHART_COLORS, FLOW_CHART_UI } from '../src/styles/chartPalette';

interface AdvancedAnalyticsProps {
  activeWorkspaceName?: string | null;
  transactions: Transaction[];
  hideValues: boolean;
}

const COLORS = FLOW_CHART_COLORS;
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: FLOW_CHART_UI.tooltipBackground,
  border: `1px solid ${FLOW_CHART_UI.tooltipBorder}`,
  borderRadius: '0.75rem',
  boxShadow: FLOW_CHART_UI.tooltipShadow,
};
const TOOLTIP_LABEL_STYLE = { color: FLOW_CHART_UI.tooltipText };
const LEGEND_TEXT_STYLE = { color: FLOW_CHART_UI.tooltipText, fontSize: '14px', fontWeight: 600 };
const SECTION_SHELL = 'overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-800/90';
const EMPTY_CHART_SHELL = 'flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40';

type ChartSize = { width: number; height: number };

const ResponsiveChartFrame: React.FC<{ className?: string; children: (size: ChartSize) => React.ReactNode }> = ({ className = 'h-64 w-full min-w-0', children }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={frameRef} className={className}>{size.width > 0 && size.height > 0 ? children(size) : null}</div>;
};

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ activeWorkspaceName, transactions, hideValues }) => {
  // 1. Balance Trend Over Time (Line Chart)
  const balanceTrendData = useMemo(() => {
    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningBalance = 0;
    return sortedTransactions.map((transaction, index) => {
      runningBalance = transaction.type === TransactionType.RECEITA
        ? addMoney(runningBalance, transaction.amount)
        : subtractMoney(runningBalance, transaction.amount);
      return {
        date: new Date(transaction.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        balance: runningBalance,
        day: index + 1
      };
    });
  }, [transactions]);

  // 2. Category Distribution (Bar Chart)
  const categoryData = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};

    transactions.forEach(transaction => {
      if (transaction.type === TransactionType.DESPESA) {
        const category = transaction.category || 'Outros';
        categoryTotals[category] = addMoney(categoryTotals[category] || 0, transaction.amount);
      }
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .filter((item) => compareMoney(item.amount, 0) > 0)
      .sort((a, b) => compareMoney(b.amount, a.amount))
      .slice(0, 8); // Top 8 categories
  }, [transactions]);

  // 3. Income vs Expenses (Pie Chart)
  const incomeExpenseData = useMemo(() => {
    const totals = transactions.reduce((acc, transaction) => {
      if (transaction.type === TransactionType.RECEITA) {
        return { ...acc, income: addMoney(acc.income, transaction.amount) };
      }
      return { ...acc, expenses: addMoney(acc.expenses, transaction.amount) };
    }, { income: 0, expenses: 0 });

    return [
      { name: 'Receitas', value: totals.income, color: COLORS.income },
      { name: 'Despesas', value: totals.expenses, color: COLORS.expenses }
    ];
  }, [transactions]);

  // 4. Cash Flow Projection (Area Chart)
  const cashFlowProjection = useMemo(() => {
    // Simple projection based on last 30 days average
    const last30Days = transactions.filter(t =>
      new Date(t.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    const signedLast30Days = last30Days.map((transaction) => (
      transaction.type === TransactionType.RECEITA
        ? transaction.amount
        : multiplyMoney(transaction.amount, -1)
    ));
    const dailyAverage = divideMoney(
      signedLast30Days.reduce((acc, amount) => addMoney(acc, amount), 0),
      30,
    );

    const currentBalance = transactions.reduce((acc, transaction) => (
      transaction.type === TransactionType.RECEITA
        ? addMoney(acc, transaction.amount)
        : subtractMoney(acc, transaction.amount)
    ), 0);

    return Array.from({ length: 90 }, (_, i) => ({
      day: i + 1,
      balance: roundMoney(addMoney(currentBalance, multiplyMoney(dailyAverage, i))),
      projected: true
    }));
  }, [transactions]);

  // 5. Monthly Trends (last 6 months)
  const monthlyTrends = useMemo(
    () => buildMonthlyForecast(transactions, 6).map((p) => ({ ...p, label: p.month })),
    [transactions]
  );

  // 6. Monthly Report with % change
  const monthlyReport = useMemo(() => {
    return monthlyTrends.map((m, i) => {
      const prev = i > 0 ? monthlyTrends[i - 1] : null;
      const despesaChange = prev && prev.despesas > 0 ? ((m.despesas - prev.despesas) / prev.despesas) * 100 : null;
      return { ...m, despesaChange };
    });
  }, [monthlyTrends]);

  const formatTooltipValue = (value: number) => {
    if (hideValues) return '••••';
    return formatCurrency(value, 'pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatAxisValue = (value: number) => {
    if (hideValues) return '••••';
    if (Math.abs(value) < 1000) {
      return formatCurrency(value, 'pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      });
    }
    if (Math.abs(value) < 10000) {
      return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
    }
    return `R$ ${(value / 1000).toFixed(0)}k`;
  };

  return (
    <div className="space-y-6">
      <div className={`${SECTION_SHELL} flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Analytics</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Relatórios Avançados</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900/70 sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Workspace ativo</p>
          <p className="text-sm text-slate-700 dark:text-slate-100">
            {activeWorkspaceName || 'Carregando workspace'}
          </p>
        </div>
      </div>

      {/* Balance Trend Chart */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Tendência de Saldo</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Evolução do seu patrimônio ao longo do tempo</p>
          </div>
        </div>
        <ResponsiveChartFrame>
          {({ width, height }) => (
            <AreaChart width={width} height={height} data={balanceTrendData}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.balance} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.balance} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={FLOW_CHART_UI.grid} />
              <XAxis dataKey="date" stroke={FLOW_CHART_UI.axis} fontSize={12} />
              <YAxis tickFormatter={formatAxisValue} stroke={FLOW_CHART_UI.axis} fontSize={12} />
              <Tooltip
                formatter={(value) => [formatTooltipValue(Number(value)), 'Saldo']}
                labelStyle={TOOLTIP_LABEL_STYLE}
                contentStyle={TOOLTIP_CONTENT_STYLE}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={COLORS.balance}
                fillOpacity={1}
                fill="url(#balanceGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveChartFrame>
      </div>

      {/* Category Distribution Chart */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Gastos por Categoria</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Principais categorias de despesa</p>
          </div>
        </div>
        <ResponsiveChartFrame>
          {({ width, height }) => (
            categoryData.length > 0 ? (
              <BarChart width={width} height={height} data={categoryData} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={FLOW_CHART_UI.grid} />
                <XAxis type="number" tickFormatter={formatAxisValue} stroke={FLOW_CHART_UI.axis} fontSize={12} />
                <YAxis dataKey="category" type="category" width={80} stroke={FLOW_CHART_UI.axis} fontSize={12} />
                <Tooltip
                  formatter={(value) => [formatTooltipValue(Number(value)), 'Total']}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                />
                <Bar dataKey="amount" fill={COLORS.expenses} radius={[0, 4, 4, 0]} />
              </BarChart>
            ) : (
              <div className={EMPTY_CHART_SHELL}>
                <div className="max-w-xs">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sem gastos categorizados</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    A distribuição por categoria aparece quando houver despesas classificadas.
                  </p>
                </div>
              </div>
            )
          )}
        </ResponsiveChartFrame>
      </div>

      {/* Income vs Expenses Pie Chart */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Receitas vs Despesas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Distribuição geral do fluxo financeiro</p>
          </div>
        </div>
        <ResponsiveChartFrame>
          {({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie
                data={incomeExpenseData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {incomeExpenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [formatTooltipValue(Number(value)), '']}
                contentStyle={TOOLTIP_CONTENT_STYLE}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span style={LEGEND_TEXT_STYLE}>{value}</span>}
              />
            </PieChart>
          )}
        </ResponsiveChartFrame>
      </div>

      {/* Cash Flow Projection */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-cyan-300">
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Projeção de Fluxo de Caixa</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Previsão baseada nos últimos 30 dias</p>
          </div>
        </div>
        <ResponsiveChartFrame>
          {({ width, height }) => (
            <LineChart width={width} height={height} data={cashFlowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke={FLOW_CHART_UI.grid} />
              <XAxis
                dataKey="day"
                stroke={FLOW_CHART_UI.axis}
                fontSize={12}
                label={{ value: 'Dias', position: 'insideBottom', offset: -5 }}
              />
              <YAxis tickFormatter={formatAxisValue} stroke={FLOW_CHART_UI.axis} fontSize={12} />
              <Tooltip
                formatter={(value) => [formatTooltipValue(Number(value)), 'Saldo Projetado']}
                labelFormatter={(label) => `Dia ${label}`}
                contentStyle={TOOLTIP_CONTENT_STYLE}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke={COLORS.balance}
                strokeWidth={3}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          )}
        </ResponsiveChartFrame>
      </div>

      {/* Monthly Trends Chart */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Relatório Mensal</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Receitas e despesas nos últimos 6 meses</p>
          </div>
        </div>
        <ResponsiveChartFrame>
          {({ width, height }) => (
            <ComposedChart width={width} height={height} data={monthlyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={FLOW_CHART_UI.grid} vertical={false} />
              <XAxis dataKey="label" stroke={FLOW_CHART_UI.axis} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatAxisValue} stroke={FLOW_CHART_UI.axis} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => [
                  formatTooltipValue(Number(value)),
                  name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Saldo',
                ]}
                contentStyle={TOOLTIP_CONTENT_STYLE}
              />
              <Bar dataKey="receitas" fill={COLORS.income} radius={[6, 6, 0, 0]} barSize={16} opacity={0.9} />
              <Bar dataKey="despesas" fill={COLORS.expenses} radius={[6, 6, 0, 0]} barSize={16} opacity={0.9} />
              <Line type="monotone" dataKey="saldo" stroke={COLORS.balance} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.balance, stroke: 'white', strokeWidth: 2 }} />
            </ComposedChart>
          )}
        </ResponsiveChartFrame>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-[var(--flow-chart-income)]" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Receitas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-[var(--flow-chart-expenses)]" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Despesas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 rounded bg-[var(--flow-chart-balance)]" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Saldo</span>
          </div>
        </div>
      </div>

      {/* Monthly Report Table */}
      <div className={`${SECTION_SHELL} p-5 sm:p-6`}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Comparativo Mensal</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Receitas e despesas nos últimos 6 meses</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Mês</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Receitas</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Despesas</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Saldo</th>
                <th className="text-right pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">Var. Desp.</th>
              </tr>
            </thead>
            <tbody>
              {monthlyReport.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <td className="py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">{row.label}</td>
                  <td className="py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {hideValues ? '••••' : formatCurrency(row.receitas)}
                  </td>
                  <td className="py-3 text-right text-xs font-semibold text-rose-500">
                    {hideValues ? '••••' : formatCurrency(row.despesas)}
                  </td>
                  <td className={`py-3 text-right text-xs font-semibold ${row.saldo >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-500'}`}>
                    {hideValues ? '••••' : formatCurrency(row.saldo)}
                  </td>
                  <td className="py-3 text-right">
                    {row.despesaChange !== null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        row.despesaChange > 5
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                          : row.despesaChange < -5
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-700 text-slate-400'
                      }`}>
                        {row.despesaChange > 5 ? <TrendingUp size={10} /> : row.despesaChange < -5 ? <TrendingDown size={10} /> : <Minus size={10} />}
                        {Math.abs(row.despesaChange).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {monthlyReport.every(r => r.receitas === 0 && r.despesas === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.08em]">
                    Sem dados nos últimos 6 meses
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export function formatAnalyticsDateLabel(value: unknown): string {
  if (!value || typeof value !== 'string') return 'Data inválida';
  // Aceitar formato date-only: YYYY-MM-DD (interpreta como local para evitar off-by-one)
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return 'Data inválida';
    return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '.');
  }
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return 'Data inválida';
  return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '.');
}

export default AdvancedAnalytics;
