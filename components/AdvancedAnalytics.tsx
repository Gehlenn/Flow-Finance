import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { formatCurrency } from '../utils/helpers';
import { Transaction, TransactionType } from '../types';
import { TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import { buildMonthlyForecast } from '../src/engines/finance/forecastEngine';

interface AdvancedAnalyticsProps {
  activeWorkspaceName?: string | null;
  transactions: Transaction[];
  hideValues: boolean;
}

const COLORS = {
  income: '#10b981', // emerald
  expenses: '#ef4444', // red
  balance: '#6366f1', // indigo
  categories: [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
  ]
};

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ activeWorkspaceName, transactions, hideValues }) => {

  // 1. Balance Trend Over Time (Line Chart)
  const balanceTrendData = useMemo(() => {
    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningBalance = 0;
    return sortedTransactions.map((transaction, index) => {
      runningBalance += transaction.type === TransactionType.RECEITA ? transaction.amount : -transaction.amount;
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
        categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
      }
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8); // Top 8 categories
  }, [transactions]);

  // 3. Income vs Expenses (Pie Chart)
  const incomeExpenseData = useMemo(() => {
    const totals = transactions.reduce((acc, transaction) => {
      if (transaction.type === TransactionType.RECEITA) {
        acc.income += transaction.amount;
      } else {
        acc.expenses += transaction.amount;
      }
      return acc;
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

    const dailyAverage = last30Days.reduce((acc, t) => {
      const amount = t.type === TransactionType.RECEITA ? t.amount : -t.amount;
      return acc + amount;
    }, 0) / 30;

    const currentBalance = transactions.reduce((acc, t) =>
      acc + (t.type === TransactionType.RECEITA ? t.amount : -t.amount), 0
    );

    return Array.from({ length: 90 }, (_, i) => ({
      day: i + 1,
      balance: currentBalance + (dailyAverage * i),
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
    return `R$ ${(value / 1000).toFixed(0)}k`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Analytics</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Relatorios Avancados</h2>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right dark:bg-slate-700">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Workspace ativo</p>
            <p className="text-sm font-black text-slate-700 dark:text-slate-100">
              {activeWorkspaceName || 'Carregando workspace'}
            </p>
          </div>
        </div>
      </div>

      {/* Balance Trend Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Tendência de Saldo</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Evolução do seu patrimônio ao longo do tempo</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceTrendData}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.balance} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.balance} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis tickFormatter={formatAxisValue} stroke="#64748b" fontSize={12} />
              <Tooltip
                formatter={(value: number) => [formatTooltipValue(value), 'Saldo']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
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
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Distribution Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Gastos por Categoria</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Principais categorias de despesa</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={formatAxisValue} stroke="#64748b" fontSize={12} />
              <YAxis dataKey="category" type="category" width={80} stroke="#64748b" fontSize={12} />
              <Tooltip
                formatter={(value: number) => [formatTooltipValue(value), 'Total']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="amount" fill={COLORS.expenses} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Income vs Expenses Pie Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Receitas vs Despesas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Distribuição geral do fluxo financeiro</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
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
                formatter={(value: number) => [formatTooltipValue(value), '']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span style={{ color: '#374151', fontSize: '14px', fontWeight: 'bold' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Projection */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-500/10 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Projeção de Fluxo de Caixa</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Previsão baseada nos últimos 30 dias</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashFlowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="day"
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Dias', position: 'insideBottom', offset: -5 }}
              />
              <YAxis tickFormatter={formatAxisValue} stroke="#64748b" fontSize={12} />
              <Tooltip
                formatter={(value: number) => [formatTooltipValue(value), 'Saldo Projetado']}
                labelFormatter={(label) => `Dia ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
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
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Tendência Mensal</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Receitas e despesas nos últimos 6 meses</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatAxisValue} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatTooltipValue(value),
                  name === 'receitas' ? 'Receitas' : name === 'despesas' ? 'Despesas' : 'Saldo',
                ]}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="receitas" fill={COLORS.income} radius={[6, 6, 0, 0]} barSize={16} opacity={0.9} />
              <Bar dataKey="despesas" fill={COLORS.expenses} radius={[6, 6, 0, 0]} barSize={16} opacity={0.9} />
              <Line type="monotone" dataKey="saldo" stroke={COLORS.balance} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.balance, stroke: 'white', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.income }} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receitas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.expenses }} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Despesas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: COLORS.balance }} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo</span>
          </div>
        </div>
      </div>

      {/* Monthly Report Table */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">Relatório Mensal</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Comparativo mês a mês com variação percentual</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left pb-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Mês</th>
                <th className="text-right pb-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Receitas</th>
                <th className="text-right pb-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Despesas</th>
                <th className="text-right pb-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Saldo</th>
                <th className="text-right pb-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Var. Desp.</th>
              </tr>
            </thead>
            <tbody>
              {monthlyReport.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <td className="py-3 text-xs font-black text-slate-700 dark:text-slate-300 capitalize">{row.label}</td>
                  <td className="py-3 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {hideValues ? '••••' : formatCurrency(row.receitas)}
                  </td>
                  <td className="py-3 text-right text-xs font-bold text-rose-500">
                    {hideValues ? '••••' : formatCurrency(row.despesas)}
                  </td>
                  <td className={`py-3 text-right text-xs font-black ${row.saldo >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                    {hideValues ? '••••' : formatCurrency(row.saldo)}
                  </td>
                  <td className="py-3 text-right">
                    {row.despesaChange !== null ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
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
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {monthlyReport.every(r => r.receitas === 0 && r.despesas === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
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

export default AdvancedAnalytics;
