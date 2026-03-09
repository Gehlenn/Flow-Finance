/**
 * AI CONTROL PANEL — src/pages/AIControlPanel.tsx
 *
 * PART 6 — Painel de controle para o sistema de IA do Flow Finance.
 * PART 7 — Visível apenas em modo desenvolvimento (IS_DEV).
 *
 * Design: dark terminal / command-center — monospace, scanline aesthetic,
 * deliberate brutalist density. Think "NASA mission control meets developer DevTools".
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction } from '../types';
import { Account } from '../models/Account';

// Services
import { getAIMemory, AIMemory }              from '../src/ai/aiMemory';
import { getAIDebugLogs, clearAIDebugLogs, AIDebugEntry } from '../src/ai/aiDebugService';
import { generateFinancialInsights, AIInsight } from '../src/ai/insightGenerator';
import { buildCashflowPrediction }             from '../src/ai/riskAnalyzer';
import { runFinancialAutopilot, AutopilotAction } from '../src/ai/financialAutopilot';
import { getFinancialEvents, clearFinancialEvents } from '../src/events/eventEngine';
import { FinancialEvent }                      from '../models/FinancialEvent';
import { getAdaptiveLearningStats }            from '../src/ai/adaptiveAIEngine';
import { detectSubscriptions, DetectedSubscription, formatCycle, formatNextCharge } from '../src/ai/subscriptionDetector';
import { calculateMoneyDistribution }          from '../src/finance/moneyMap';
import { parseOFX }                            from '../src/finance/ofxParser';
import { parseCSV }                            from '../src/finance/csvParser';
import { detectFinancialLeaks, FinancialLeak } from '../src/ai/leakDetector';
import { generateMonthlyReport, FinancialReport } from '../src/finance/reportEngine';
import { simulateFinancialScenario, FinancialSimulationResult, SimulationScenario } from '../src/ai/financialSimulator';
import { getAuditLogs, AUDIT_EVENTS, AuditLogEntry } from '../src/security/auditLogService';

// Icons
import {
  Brain, Cpu, Zap, Activity, Database, RefreshCw, Trash2,
  ChevronRight, ChevronDown, Terminal, Shield, Sparkles,
  BarChart3, CreditCard, FileText, Calendar, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, TrendingDown, Eye, EyeOff,
  Code2, GitBranch, Package, Hash, Layers, Search, Filter,
  ArrowRight, X, Info, Bot, Target, Repeat2, Map, Network
} from 'lucide-react';

// ─── Dev guard ────────────────────────────────────────────────────────────────

const IS_DEV = import.meta.env.DEV;

// ─── Shared primitives ────────────────────────────────────────────────────────

const TermBadge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'text-emerald-400' }) => (
  <span className={`font-mono text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 bg-black/40 border border-current/20 rounded ${color}`}>
    {children}
  </span>
);

const ConfBar: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[9px]" style={{ color }}>{pct}%</span>
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count?: number; onRefresh?: () => void; onClear?: () => void }> = ({
  icon, title, count, onRefresh, onClear
}) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/50">
    <div className="flex items-center gap-2">
      <span className="text-emerald-400">{icon}</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">{title}</span>
      {count !== undefined && (
        <span className="bg-slate-700 text-slate-400 font-mono text-[8px] px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
    <div className="flex gap-1">
      {onRefresh && (
        <button onClick={onRefresh} className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors">
          <RefreshCw size={11} />
        </button>
      )}
      {onClear && (
        <button onClick={onClear} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
    <span className="opacity-40">{icon}</span>
    <p className="font-mono text-[9px] uppercase tracking-widest">{message}</p>
  </div>
);

// ─── TAB: Memory ─────────────────────────────────────────────────────────────

const MemoryTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [entries, setEntries] = useState<AIMemory[]>([]);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    const mem = await getAIMemory(userId);
    setEntries(mem.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    entries.filter(e =>
      !filter || e.key.includes(filter) || e.value.includes(filter)
    ), [entries, filter]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Database size={11} />} title="AI Memory" count={entries.length} onRefresh={load} />

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2 bg-black/40 border border-slate-700 rounded px-3 py-1.5">
          <Search size={10} className="text-slate-500" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrar por chave ou valor..."
            className="flex-1 bg-transparent font-mono text-[10px] text-slate-300 placeholder-slate-600 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={<Brain size={32} />} message="Nenhuma memória encontrada" />
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(entry => (
              <div key={entry.id} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash size={9} className="text-emerald-500 shrink-0" />
                      <span className="font-mono text-[10px] text-emerald-300 truncate">{entry.key}</span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 ml-3.5 truncate">→ {entry.value}</p>
                  </div>
                  <ConfBar value={entry.confidence} />
                </div>
                <p className="font-mono text-[8px] text-slate-600 mt-1.5 ml-3.5 flex items-center gap-1">
                  <Clock size={7} /> {new Date(entry.updated_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Insights ────────────────────────────────────────────────────────────

const InsightsTab: React.FC<{ transactions: Transaction[]; userId: string }> = ({ transactions, userId }) => {
  const insights = useMemo(() => generateFinancialInsights(transactions, userId), [transactions, userId]);

  const typeIcon: Record<string, React.ReactNode> = {
    spending: <TrendingUp size={10} className="text-rose-400" />,
    saving:   <TrendingDown size={10} className="text-emerald-400" />,
    warning:  <AlertTriangle size={10} className="text-amber-400" />,
  };
  const typeBg: Record<string, string> = {
    spending: 'border-rose-900/40 bg-rose-900/10',
    saving:   'border-emerald-900/40 bg-emerald-900/10',
    warning:  'border-amber-900/40 bg-amber-900/10',
  };
  const severityColor: Record<string, string> = {
    high:   'text-rose-400',
    medium: 'text-amber-400',
    low:    'text-emerald-400',
  };

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Sparkles size={11} />} title="Financial Insights" count={insights.length} />
      <div className="flex-1 overflow-y-auto">
        {insights.length === 0 ? (
          <EmptyState icon={<Sparkles size={32} />} message="Sem insights — adicione transações" />
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {insights.map(insight => (
              <div key={insight.id} className={`border rounded-lg p-3 ${typeBg[insight.type] ?? 'border-slate-700 bg-slate-800/30'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {typeIcon[insight.type]}
                    <TermBadge color={insight.type === 'warning' ? 'text-amber-400' : insight.type === 'saving' ? 'text-emerald-400' : 'text-rose-400'}>
                      {insight.type}
                    </TermBadge>
                  </div>
                  {insight.severity && (
                    <span className={`font-mono text-[8px] font-bold uppercase ${severityColor[insight.severity]}`}>
                      {insight.severity}
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-slate-300 leading-relaxed">{insight.message}</p>
                <p className="font-mono text-[8px] text-slate-600 mt-2 flex items-center gap-1">
                  <Clock size={7} /> {new Date(insight.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Autopilot ──────────────────────────────────────────────────────────

const AutopilotTab: React.FC<{ transactions: Transaction[]; accounts: Account[] }> = ({ transactions, accounts }) => {
  const actions = useMemo(() => {
    const prediction = buildCashflowPrediction(transactions);
    const insights = generateFinancialInsights(transactions);
    return runFinancialAutopilot(accounts, transactions, prediction, insights);
  }, [transactions, accounts]);

  const typeStyle: Record<string, { border: string; icon: React.ReactNode; label: string }> = {
    warning:      { border: 'border-rose-900/50',   icon: <AlertTriangle size={10} className="text-rose-400" />,   label: 'warning' },
    suggestion:   { border: 'border-sky-900/50',    icon: <Sparkles size={10} className="text-sky-400" />,         label: 'suggestion' },
    optimization: { border: 'border-violet-900/50', icon: <Zap size={10} className="text-violet-400" />,           label: 'optimization' },
    insight:      { border: 'border-amber-900/50',  icon: <Cpu size={10} className="text-amber-400" />,            label: 'insight' },
  };

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Bot size={11} />} title="Autopilot Actions" count={actions.length} />
      <div className="flex-1 overflow-y-auto">
        {actions.length === 0 ? (
          <EmptyState icon={<Bot size={32} />} message="Nenhuma ação — dados insuficientes" />
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {actions.map(action => {
              const style = typeStyle[action.type] ?? typeStyle.insight;
              return (
                <div key={action.id} className={`border ${style.border} bg-slate-800/20 rounded-lg p-3`}>
                  <div className="flex items-start gap-2 mb-1.5">
                    {style.icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-mono text-[10px] text-slate-200 font-bold leading-tight">{action.title}</p>
                        <TermBadge>{style.label}</TermBadge>
                      </div>
                      <p className="font-mono text-[9px] text-slate-400 leading-relaxed">{action.description}</p>
                      {action.value !== undefined && (
                        <p className="font-mono text-[9px] text-emerald-400 mt-1.5">
                          ↗ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(action.value)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Events ─────────────────────────────────────────────────────────────

const EventsTab: React.FC = () => {
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setEvents(getFinancialEvents().slice().reverse());
  }, []);

  useEffect(() => { load(); }, [load]);

  const eventColor: Record<string, string> = {
    transaction_created:   'text-indigo-400',
    recurring_generated:   'text-violet-400',
    insight_generated:     'text-amber-400',
    risk_detected:         'text-rose-400',
    autopilot_action:      'text-emerald-400',
    goal_created:          'text-sky-400',
    transactions_imported: 'text-teal-400',
    bank_transactions_synced: 'text-cyan-400',
  };

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        icon={<Activity size={11} />}
        title="Event Bus"
        count={events.length}
        onRefresh={load}
        onClear={() => { clearFinancialEvents(); setEvents([]); }}
      />
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <EmptyState icon={<Activity size={32} />} message="Nenhum evento registrado" />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {events.map(ev => (
              <div key={ev.id}>
                <button
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <span className={`font-mono text-[8px] font-bold uppercase tracking-wider ${eventColor[ev.type] ?? 'text-slate-400'}`}>
                    {ev.type}
                  </span>
                  <span className="flex-1 font-mono text-[8px] text-slate-600 truncate">
                    {new Date(ev.created_at).toLocaleTimeString('pt-BR')}
                  </span>
                  {expanded === ev.id ? <ChevronDown size={10} className="text-slate-500" /> : <ChevronRight size={10} className="text-slate-600" />}
                </button>
                {expanded === ev.id && (
                  <div className="px-4 pb-3">
                    <pre className="font-mono text-[8px] text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: AI Logs ─────────────────────────────────────────────────────────────

const AILogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AIDebugEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => setLogs(getAIDebugLogs()), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        icon={<Code2 size={11} />}
        title="AI Debug Logs"
        count={logs.length}
        onRefresh={load}
        onClear={() => { clearAIDebugLogs(); setLogs([]); }}
      />
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <EmptyState icon={<Code2 size={32} />} message="Nenhum log de debug" />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {logs.map(log => (
              <div key={log.id}>
                <button
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[9px] text-slate-300 truncate">{log.input}</p>
                    {log.predicted_category && (
                      <p className="font-mono text-[8px] text-emerald-500 mt-0.5">→ {log.predicted_category}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {log.confidence !== undefined && <ConfBar value={log.confidence} />}
                    {log.processing_ms && (
                      <span className="font-mono text-[7px] text-slate-600">{log.processing_ms}ms</span>
                    )}
                  </div>
                </button>
                {expanded === log.id && (
                  <div className="px-4 pb-3">
                    <pre className="font-mono text-[8px] text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40">
                      {JSON.stringify({ ...log, input: undefined }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Subscriptions ──────────────────────────────────────────────────────

const SubscriptionsTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const summary = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Repeat2 size={11} />} title="Subscription Detector" count={summary.count} />
      <div className="flex-1 overflow-y-auto">
        {/* Summary bar */}
        <div className="grid grid-cols-2 gap-0 border-b border-slate-700/60">
          {[
            { label: 'Mensal',  value: fmt(summary.total_monthly),  color: 'text-rose-400' },
            { label: 'Anual',   value: fmt(summary.total_annual),   color: 'text-amber-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 border-r border-slate-700/40 last:border-r-0">
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest">{label}</p>
              <p className={`font-mono text-sm font-bold ${color} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>

        {summary.subscriptions.length === 0 ? (
          <EmptyState icon={<Repeat2 size={32} />} message="Nenhuma assinatura detectada" />
        ) : (
          <div className="divide-y divide-slate-800/60">
            {summary.subscriptions.map(sub => (
              <div key={sub.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">{sub.logo}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-mono text-[10px] text-slate-200 font-bold">{sub.name}</p>
                      <span className="font-mono text-[10px] text-rose-400 font-bold">{fmt(sub.amount)}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <TermBadge color="text-sky-400">{formatCycle(sub.cycle)}</TermBadge>
                      <TermBadge color="text-slate-400">{sub.category}</TermBadge>
                      <TermBadge color="text-violet-400">{sub.occurrences}× detectado</TermBadge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Calendar size={8} className="text-slate-500" />
                      <span className="font-mono text-[8px] text-slate-500">
                        Próxima: {formatNextCharge(sub.next_expected)}
                      </span>
                      <span className="font-mono text-[8px] text-slate-600 ml-auto">
                        Total: {fmt(sub.total_spent)}
                      </span>
                    </div>
                    <ConfBar value={sub.confidence} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Money Map ──────────────────────────────────────────────────────────

const MoneyMapTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const [period, setPeriod] = useState(30);
  const map = useMemo(() => calculateMoneyDistribution(transactions, period), [transactions, period]);
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Map size={11} />} title="Money Map" />

      {/* Period selector */}
      <div className="flex border-b border-slate-700/60">
        {[7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setPeriod(d)}
            className={`flex-1 py-2 font-mono text-[8px] uppercase tracking-widest transition-colors
              ${period === d ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Net summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Receitas',  value: fmt(map.total_income),   color: 'text-emerald-400' },
            { label: 'Despesas',  value: fmt(map.total_expenses), color: 'text-rose-400' },
            { label: 'Saldo',     value: fmt(map.net),            color: map.net >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black/30 border border-slate-700/50 rounded-lg p-2.5">
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest">{label}</p>
              <p className={`font-mono text-xs font-bold ${color} mt-0.5 truncate`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Segmented bar */}
        {map.distribution.length > 0 && (
          <div className="mb-4">
            <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mb-2">Distribuição</p>
            <div className="flex h-3 rounded overflow-hidden gap-px">
              {map.distribution.slice(0, 6).map(item => (
                <div
                  key={item.category}
                  className="h-full transition-all"
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  title={`${item.category}: ${item.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Category table */}
        {map.distribution.length === 0 ? (
          <EmptyState icon={<BarChart3 size={32} />} message="Sem despesas no período" />
        ) : (
          <div className="flex flex-col gap-1.5">
            {map.distribution.map(item => (
              <div key={item.category} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-mono text-[9px] text-slate-300 flex-1 truncate">{item.category}</span>
                <span className="font-mono text-[9px] text-slate-500">{item.count}×</span>
                <div className="flex items-center gap-1">
                  {item.trend === 'up'   && <TrendingUp  size={8} className="text-rose-400"    />}
                  {item.trend === 'down' && <TrendingDown size={8} className="text-emerald-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400 w-12 text-right">{item.percentage.toFixed(1)}%</span>
                <span className="font-mono text-[9px] text-slate-200 w-20 text-right">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Leaks ──────────────────────────────────────────────────────────────

const LeaksTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const leaks = useMemo(() => detectFinancialLeaks(transactions), [transactions]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<AlertTriangle size={11} />} title="Financial Leaks" count={leaks.length} />

      <div className="flex-1 overflow-y-auto">
        {leaks.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={32} />} message="Nenhum vazamento detectado" />
        ) : (
          <div className="divide-y divide-slate-800">
            {leaks.map((leak, idx) => (
              <div key={idx} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={9} className="text-rose-500 shrink-0" />
                      <span className="font-mono text-[10px] text-rose-300 truncate">{leak.merchant}</span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-400 ml-3.5">R$ {leak.monthly_cost.toFixed(2)}/mês - {leak.occurrences} ocorrências</p>
                    <p className="font-mono text-[8px] text-slate-500 ml-3.5 mt-1">{leak.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Report ─────────────────────────────────────────────────────────────

const ReportTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const report = useMemo(() => generateMonthlyReport(transactions), [transactions]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<BarChart3 size={11} />} title="Monthly Report" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded p-4">
          <h3 className="font-mono text-[10px] text-emerald-400 mb-3">{report.month}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[8px] text-slate-500">Receitas</p>
              <p className="font-mono text-[12px] text-emerald-400">R$ {report.total_income.toFixed(2)}</p>
            </div>
            <div>
              <p className="font-mono text-[8px] text-slate-500">Despesas</p>
              <p className="font-mono text-[12px] text-rose-400">R$ {report.total_expenses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded p-4">
          <h4 className="font-mono text-[9px] text-slate-300 mb-2">Top Categorias</h4>
          <div className="space-y-2">
            {report.top_categories.map(cat => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-slate-400">{cat.category}</span>
                <span className="font-mono text-[9px] text-emerald-400">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {report.insights.length > 0 && (
          <div className="bg-slate-800/50 rounded p-4">
            <h4 className="font-mono text-[9px] text-slate-300 mb-2">Insights</h4>
            <div className="space-y-1">
              {report.insights.map((insight, idx) => (
                <p key={idx} className="font-mono text-[8px] text-slate-400">{insight}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Simulation ─────────────────────────────────────────────────────────

const SimulationTab: React.FC<{ transactions: Transaction[]; accounts: Account[] }> = ({ transactions, accounts }) => {
  const [scenario, setScenario] = useState<SimulationScenario>({
    type: 'extra_spending',
    amount: 500,
    description: 'uma viagem de fim de semana'
  });
  const [result, setResult] = useState<FinancialSimulationResult | null>(null);

  const runSimulation = () => {
    const res = simulateFinancialScenario(accounts, transactions, scenario);
    setResult(res);
  };

  useEffect(() => {
    runSimulation();
  }, [scenario]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<TrendingUp size={11} />} title="Financial Simulation" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded p-4">
          <h4 className="font-mono text-[9px] text-slate-300 mb-3">Configurar Cenário</h4>
          <div className="space-y-3">
            <select
              value={scenario.type}
              onChange={e => setScenario({ ...scenario, type: e.target.value as any })}
              className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
            >
              <option value="extra_spending">Gasto Extra</option>
              <option value="monthly_savings">Economia Mensal</option>
              <option value="months">Projeção por Meses</option>
            </select>

            {scenario.type === 'extra_spending' && (
              <>
                <input
                  type="number"
                  value={scenario.amount}
                  onChange={e => setScenario({ ...scenario, amount: Number(e.target.value) })}
                  placeholder="Valor"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
                />
                <input
                  value={scenario.description}
                  onChange={e => setScenario({ ...scenario, description: e.target.value })}
                  placeholder="Descrição"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
                />
              </>
            )}

            {scenario.type === 'monthly_savings' && (
              <>
                <input
                  type="number"
                  value={scenario.amount}
                  onChange={e => setScenario({ ...scenario, amount: Number(e.target.value) })}
                  placeholder="Valor mensal"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
                />
                <input
                  value={scenario.description}
                  onChange={e => setScenario({ ...scenario, description: e.target.value })}
                  placeholder="Descrição"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
                />
              </>
            )}

            {scenario.type === 'months' && (
              <input
                type="number"
                value={(scenario as any).months || 3}
                onChange={e => setScenario({ ...scenario, months: Number(e.target.value) })}
                placeholder="Meses"
                className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-[10px] text-slate-300"
              />
            )}

            <button
              onClick={runSimulation}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] py-2 rounded transition-colors"
            >
              Simular
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-slate-800/50 rounded p-4">
            <h4 className="font-mono text-[9px] text-emerald-400 mb-3">Resultado</h4>
            <p className="font-mono text-[10px] text-slate-300 mb-3">{result.summary}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-[8px] text-slate-500">Saldo Projetado</p>
                <p className="font-mono text-[12px] text-emerald-400">R$ {result.projected_balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-mono text-[8px] text-slate-500">Período</p>
                <p className="font-mono text-[12px] text-slate-300">{result.simulation_period} meses</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Audit ──────────────────────────────────────────────────────────────

const AuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    const auditLogs = getAuditLogs();
    setLogs(auditLogs);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    logs.filter(log =>
      !filter || log.event_type.includes(filter) || log.entity.includes(filter)
    ), [logs, filter]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Shield size={11} />} title="Audit Logs" count={logs.length} onRefresh={load} />

      <div className="px-4 py-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2 bg-black/40 border border-slate-700 rounded px-3 py-1.5">
          <Search size={10} className="text-slate-500" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filtrar por evento ou entidade..."
            className="flex-1 bg-transparent font-mono text-[10px] text-slate-300 placeholder-slate-600 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={<Shield size={32} />} message="Nenhum log de auditoria" />
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[9px] text-emerald-400">{log.event_type}</span>
                      <span className="font-mono text-[8px] text-slate-500">→</span>
                      <span className="font-mono text-[9px] text-slate-300">{log.entity}:{log.entity_id}</span>
                    </div>
                    <p className="font-mono text-[8px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="font-mono text-[7px] text-slate-600 mt-1 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: Parser Lab ─────────────────────────────────────────────────────────

const ParserLabTab: React.FC = () => {
  const [input, setInput]   = useState('');
  const [format, setFormat] = useState<'ofx' | 'csv'>('ofx');
  const [result, setResult] = useState<any[] | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const run = () => {
    setError(null);
    try {
      const txs = format === 'ofx' ? parseOFX(input) : parseCSV(input);
      setResult(txs);
    } catch (e: any) {
      setError(e?.message ?? 'Parse error');
      setResult(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<FileText size={11} />} title="Parser Lab" />
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Format selector */}
        <div className="flex gap-1">
          {(['ofx', 'csv'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest rounded transition-colors
                ${format === f ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300 border border-slate-700'}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={format === 'ofx' ? '<STMTTRN>\n<DTPOSTED>20260301\n<TRNAMT>-89.90\n<MEMO>iFood\n</STMTTRN>' : 'Data,Descrição,Valor\n01/03/2026,iFood,-89.90\n01/03/2026,Salário,3200.00'}
          rows={8}
          className="w-full bg-black/50 border border-slate-700 rounded font-mono text-[9px] text-slate-300 p-3 resize-none outline-none focus:border-emerald-500/50 placeholder-slate-700"
        />

        <button
          onClick={run}
          className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded font-mono text-[9px] uppercase tracking-widest hover:bg-emerald-500/20 transition-colors"
        >
          <Terminal size={11} /> Executar Parser
        </button>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3">
            <p className="font-mono text-[9px] text-rose-400">{error}</p>
          </div>
        )}

        {result && (
          <div>
            <p className="font-mono text-[8px] text-slate-500 mb-2 uppercase tracking-widest">{result.length} transações parseadas</p>
            <pre className="font-mono text-[8px] text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40 max-h-64">
              {JSON.stringify(result.slice(0, 5), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PART 7 — Graph Visualization Tab ────────────────────────────────────────

type GraphViewMode = 'overview' | 'merchants' | 'categories' | 'subscriptions' | 'edges';

const GraphTab: React.FC<{ transactions: Transaction[]; accounts: Account[]; userId: string }> = ({
  transactions, accounts, userId
}) => {
  const [view, setView] = useState<GraphViewMode>('overview');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const graph = useMemo(
    () => buildFinancialGraph(userId, accounts, transactions),
    [userId, accounts, transactions]
  );

  const topMerchants    = useMemo(() => getTopMerchants(graph, 20), [graph]);
  const categorySpend   = useMemo(() => getCategorySpending(graph), [graph]);
  const subCandidates   = useMemo(() => detectSubscriptionCandidates(graph), [graph]);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const nodeTypeColor: Record<string, string> = {
    user:         'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    account:      'bg-sky-500/20 text-sky-300 border-sky-500/30',
    transaction:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
    merchant:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
    category:     'bg-violet-500/20 text-violet-300 border-violet-500/30',
    subscription: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  const viewBtns: Array<{ id: GraphViewMode; label: string }> = [
    { id: 'overview',      label: 'Overview' },
    { id: 'merchants',     label: 'Merchants' },
    { id: 'categories',    label: 'Categories' },
    { id: 'subscriptions', label: 'Subs' },
    { id: 'edges',         label: 'Edges' },
  ];

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Network size={11} />} title="Financial Graph" count={graph.stats.node_count} />

      {/* Stats bar */}
      <div className="grid grid-cols-5 border-b border-slate-700/60">
        {[
          { label: 'Nodes',    value: graph.stats.node_count,        color: 'text-slate-300' },
          { label: 'Edges',    value: graph.stats.edge_count,        color: 'text-slate-400' },
          { label: 'Merch.',   value: graph.stats.merchant_count,    color: 'text-amber-400' },
          { label: 'Cats.',    value: graph.stats.category_count,    color: 'text-violet-400' },
          { label: 'Subs.',    value: graph.stats.subscription_count,color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="py-2 text-center border-r border-slate-700/40 last:border-r-0">
            <p className={`font-mono text-xs font-bold ${s.color}`}>{s.value}</p>
            <p className="font-mono text-[6px] text-slate-600 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex overflow-x-auto border-b border-slate-700/60">
        {viewBtns.map(btn => (
          <button
            key={btn.id}
            onClick={() => setView(btn.id)}
            className={`px-3 py-1.5 shrink-0 font-mono text-[7px] uppercase tracking-widest transition-colors border-b-2
              ${view === btn.id ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW — node type distribution + graph schema */}
        {view === 'overview' && (
          <div className="p-3 flex flex-col gap-3">
            {/* Schema legend */}
            <div>
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mb-2">Schema</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(nodeTypeColor).map(([type, cls]) => (
                  <span key={type} className={`font-mono text-[8px] px-2 py-0.5 rounded border ${cls}`}>{type}</span>
                ))}
              </div>
            </div>

            {/* Edge relation legend */}
            <div>
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mb-2">Relations</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ['owns',            'user → account'],
                  ['has_transaction', 'account → tx'],
                  ['paid_to',         'tx → merchant'],
                  ['belongs_to',      'tx → category'],
                  ['same_category',   'merchant → category'],
                  ['is_subscription', 'merchant → sub'],
                  ['co_occurs',       'merchant ↔ merchant'],
                  ['recurring_from',  'sub → merchant'],
                ].map(([rel, desc]) => (
                  <div key={rel} className="flex items-center gap-1.5">
                    <ArrowRight size={7} className="text-slate-600 shrink-0" />
                    <span className="font-mono text-[7px] text-emerald-400">{rel}</span>
                    <span className="font-mono text-[7px] text-slate-600 truncate">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Built at */}
            <div className="flex items-center gap-2 bg-black/30 border border-slate-700/50 rounded-lg px-3 py-2">
              <Clock size={9} className="text-slate-500" />
              <span className="font-mono text-[8px] text-slate-400">
                Rebuilt: {new Date(graph.built_at).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          </div>
        )}

        {/* MERCHANTS view */}
        {view === 'merchants' && (
          <div>
            <div className="px-3 py-2 border-b border-slate-700/40">
              <div className="flex items-center gap-2 bg-black/40 border border-slate-700 rounded px-2 py-1">
                <Search size={9} className="text-slate-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar merchant…"
                  className="flex-1 bg-transparent font-mono text-[9px] text-slate-300 placeholder-slate-600 outline-none"
                />
              </div>
            </div>
            {topMerchants.length === 0
              ? <EmptyState icon={<Package size={28} />} message="Sem merchants" />
              : (
                <div className="divide-y divide-slate-800/60">
                  {topMerchants
                    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()))
                    .map((m, i) => (
                      <div
                        key={m.merchant_id}
                        className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setSelectedNode(selectedNode === m.merchant_id ? null : m.merchant_id)}
                      >
                        <span className="font-mono text-[8px] text-slate-600 w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[9px] text-amber-300 truncate">{m.name}</p>
                          <p className="font-mono text-[7px] text-slate-500 mt-0.5">{m.visit_count}× · avg {fmt(m.avg_amount)}</p>
                        </div>
                        <span className="font-mono text-[9px] text-slate-200 font-bold">{fmt(m.total_spent)}</span>
                        {selectedNode === m.merchant_id
                          ? <ChevronDown size={9} className="text-slate-500 shrink-0" />
                          : <ChevronRight size={9} className="text-slate-600 shrink-0" />}
                      </div>
                    ))}
                </div>
              )
            }
          </div>
        )}

        {/* CATEGORIES view */}
        {view === 'categories' && (
          <div className="p-3 flex flex-col gap-2">
            {categorySpend.length === 0
              ? <EmptyState icon={<Layers size={28} />} message="Sem categorias" />
              : categorySpend.map(cat => (
                <div key={cat.category_id} className="bg-black/20 border border-slate-700/40 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                      <span className="font-mono text-[9px] text-violet-300 font-bold">{cat.name}</span>
                      <TermBadge color={
                        cat.trend === 'up' ? 'text-rose-400' :
                        cat.trend === 'down' ? 'text-emerald-400' : 'text-slate-400'
                      }>{cat.trend}</TermBadge>
                    </div>
                    <span className="font-mono text-[9px] text-slate-200 font-bold">{fmt(cat.total)}</span>
                  </div>
                  {/* progress bar */}
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[7px] text-slate-500">{cat.count} transações · {cat.percentage.toFixed(1)}%</span>
                    {cat.top_merchants.length > 0 && (
                      <span className="font-mono text-[7px] text-slate-500 truncate max-w-[120px]">{cat.top_merchants.join(', ')}</span>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* SUBSCRIPTIONS view */}
        {view === 'subscriptions' && (
          <div className="divide-y divide-slate-800/60">
            {subCandidates.length === 0
              ? <EmptyState icon={<Repeat2 size={28} />} message="Sem candidatos" />
              : subCandidates.map(sub => (
                <div key={sub.merchant_id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sub.is_confirmed_subscription ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[9px] text-slate-200 truncate">{sub.name}</p>
                    <p className="font-mono text-[7px] text-slate-500 mt-0.5">
                      {sub.visit_count}× · {sub.is_confirmed_subscription ? '✓ confirmada' : '? candidata'}
                    </p>
                  </div>
                  <span className={`font-mono text-[9px] font-bold ${sub.is_confirmed_subscription ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {fmt(sub.estimated_amount)}
                  </span>
                </div>
              ))
            }
          </div>
        )}

        {/* EDGES view */}
        {view === 'edges' && (
          <div>
            {/* Relation type breakdown */}
            <div className="p-3 border-b border-slate-700/40">
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mb-2">Relation counts</p>
              {(() => {
                const counts: Record<string, number> = {};
                for (const e of graph.edges) {
                  counts[e.relation] = (counts[e.relation] ?? 0) + 1;
                }
                return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([rel, cnt]) => (
                  <div key={rel} className="flex items-center gap-2 mb-1.5">
                    <ArrowRight size={8} className="text-emerald-500 shrink-0" />
                    <span className="font-mono text-[8px] text-emerald-300 w-32 shrink-0">{rel}</span>
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${Math.min(100, (cnt / graph.edges.length) * 100 * 5)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[8px] text-slate-400 w-8 text-right">{cnt}</span>
                  </div>
                ));
              })()}
            </div>

            {/* Co-occurrence edges (interesting pairs) */}
            <div className="p-3">
              <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mb-2">Co-occurrence pairs</p>
              {graph.edges
                .filter(e => e.relation === 'co_occurs')
                .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                .slice(0, 8)
                .map((e, i) => {
                  const fromLabel = graph.nodes.get(e.from)?.label ?? e.from;
                  const toLabel   = graph.nodes.get(e.to)?.label   ?? e.to;
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="font-mono text-[7px] text-slate-600 w-3">{e.weight}×</span>
                      <span className="font-mono text-[8px] text-amber-400 truncate max-w-[90px]">{fromLabel}</span>
                      <ArrowRight size={7} className="text-slate-600 shrink-0" />
                      <span className="font-mono text-[8px] text-amber-300 truncate max-w-[90px]">{toLabel}</span>
                    </div>
                  );
                })}
              {graph.edges.filter(e => e.relation === 'co_occurs').length === 0 && (
                <p className="font-mono text-[8px] text-slate-600">Sem co-ocorrências</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PART 7 — System Stats (quick read at a glance) ──────────────────────────

const SystemStats: React.FC<{ transactions: Transaction[]; accounts: Account[]; userId: string }> = ({
  transactions, accounts, userId
}) => {
  const stats = useMemo(() => getAdaptiveLearningStats(userId), [userId]);
  const events = useMemo(() => getFinancialEvents(), []);

  return (
    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
      {[
        { label: 'Transações',     value: transactions.length,       icon: <ArrowRight size={9} />, color: 'text-indigo-400' },
        { label: 'Contas',         value: accounts.length,           icon: <Database size={9} />,   color: 'text-sky-400' },
        { label: 'Memórias',       value: stats.memories_stored,     icon: <Brain size={9} />,      color: 'text-violet-400' },
        { label: 'Padrões',        value: stats.patterns_detected,   icon: <GitBranch size={9} />,  color: 'text-amber-400' },
        { label: 'Eventos',        value: events.length,             icon: <Activity size={9} />,   color: 'text-emerald-400' },
        { label: 'Insights+',      value: stats.insights_enhanced,   icon: <Sparkles size={9} />,   color: 'text-rose-400' },
      ].map(({ label, value, icon, color }) => (
        <div key={label} className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-slate-700/40 rounded-lg">
          <span className={color}>{icon}</span>
          <div>
            <p className={`font-mono text-sm font-bold leading-none ${color}`}>{value}</p>
            <p className="font-mono text-[7px] text-slate-500 uppercase tracking-widest mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

interface AIControlPanelProps {
  transactions: Transaction[];
  accounts: Account[];
  userId: string;
}

type PanelTab = 'stats' | 'memory' | 'insights' | 'autopilot' | 'events' | 'logs' | 'subscriptions' | 'moneymap' | 'leaks' | 'report' | 'simulation' | 'audit' | 'parser' | 'graph';

const TAB_CONFIG: Array<{ id: PanelTab; label: string; icon: React.ReactNode }> = [
  { id: 'stats',         label: 'Stats',         icon: <Layers size={11} />       },
  { id: 'memory',        label: 'Memory',        icon: <Database size={11} />     },
  { id: 'insights',      label: 'Insights',      icon: <Sparkles size={11} />     },
  { id: 'autopilot',     label: 'Autopilot',     icon: <Bot size={11} />          },
  { id: 'events',        label: 'Events',        icon: <Activity size={11} />     },
  { id: 'logs',          label: 'Logs',          icon: <Code2 size={11} />        },
  { id: 'subscriptions', label: 'Subs',          icon: <Repeat2 size={11} />      },
  { id: 'moneymap',      label: 'MoneyMap',      icon: <Map size={11} />          },
  { id: 'leaks',         label: 'Leaks',         icon: <AlertTriangle size={11} />},
  { id: 'report',        label: 'Report',        icon: <BarChart3 size={11} />    },
  { id: 'simulation',    label: 'Simulate',      icon: <TrendingUp size={11} />  },
  { id: 'audit',         label: 'Audit',         icon: <Shield size={11} />       },
  { id: 'parser',        label: 'Parser',        icon: <FileText size={11} />     },
  { id: 'graph',         label: 'Graph',         icon: <Network size={11} />      },
];

const AIControlPanel: React.FC<AIControlPanelProps> = ({ transactions, accounts, userId }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('stats');

  // PART 7 — Only render in development mode
  if (!IS_DEV) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
        <Shield size={40} className="opacity-30" />
        <p className="font-mono text-[10px] uppercase tracking-widest">Disponível apenas em modo DEV</p>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'stats':         return <div className="py-3"><SystemStats transactions={transactions} accounts={accounts} userId={userId} /></div>;
      case 'memory':        return <MemoryTab userId={userId} />;
      case 'insights':      return <InsightsTab transactions={transactions} userId={userId} />;
      case 'autopilot':     return <AutopilotTab transactions={transactions} accounts={accounts} />;
      case 'events':        return <EventsTab />;
      case 'logs':          return <AILogsTab />;
      case 'subscriptions': return <SubscriptionsTab transactions={transactions} />;
      case 'leaks':         return <LeaksTab transactions={transactions} />;
      case 'report':        return <ReportTab transactions={transactions} />;
      case 'simulation':    return <SimulationTab transactions={transactions} accounts={accounts} />;
      case 'audit':         return <AuditTab />;
      default:              return null;
    }
  };

  return (
    <div className="flex flex-col gap-0 pb-8">
      {/* Header — dark terminal style */}
      <div className="bg-slate-950 border border-slate-700/60 rounded-[1.5rem] overflow-hidden shadow-2xl shadow-black/40">

        {/* Title bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/60 bg-black/40">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Terminal size={13} className="text-emerald-400" />
            <span className="font-mono text-[10px] text-emerald-300 font-bold uppercase tracking-widest">
              flow.ai.control_panel
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[7px] text-emerald-400 uppercase tracking-widest">dev mode</span>
          </div>
        </div>

        {/* Tab bar — horizontal scrolling */}
        <div className="flex overflow-x-auto border-b border-slate-700/60 bg-slate-900/50 scrollbar-none">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 shrink-0 font-mono text-[8px] uppercase tracking-widest transition-colors border-b-2
                ${activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[400px] max-h-[65vh] overflow-hidden flex flex-col bg-slate-950/80">
          {renderTab()}
        </div>
      </div>

      {/* Footer */}
      <p className="font-mono text-[7px] text-slate-600 text-center pt-2 uppercase tracking-widest">
        Flow Finance v0.4.0 · AI Control Panel · {IS_DEV ? 'Development' : 'Production'}
      </p>
    </div>
  );
};

export default AIControlPanel;
