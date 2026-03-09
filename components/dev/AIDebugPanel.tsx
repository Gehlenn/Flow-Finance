import React, { useState, useEffect, useCallback } from 'react';
import { getAIDebugLogs, clearAIDebugLogs, AIDebugEntry } from '../../src/ai/aiDebugService';
import { getFinancialEvents, clearFinancialEvents } from '../../src/events/eventEngine';
import { FinancialEvent } from '../../models/FinancialEvent';
import {
  Bug, X, Trash2, RefreshCw, ChevronDown, ChevronUp,
  Cpu, Clock, Tag, Zap, AlertCircle, CheckCircle2,
  Activity, ArrowRightLeft, Sparkles, ShieldAlert,
  Bot, Target, GitBranch
} from 'lucide-react';

const IS_DEV = import.meta.env.DEV;

const EVENT_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  transaction_created: { icon: <ArrowRightLeft size={12} />, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10', label: 'Transação' },
  recurring_generated: { icon: <RefreshCw size={12} />, color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10', label: 'Recorrente' },
  insight_generated: { icon: <Sparkles size={12} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', label: 'Insight' },
  risk_detected: { icon: <ShieldAlert size={12} />, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', label: 'Risco' },
  autopilot_action: { icon: <Bot size={12} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', label: 'Autopilot' },
  goal_created: { icon: <Target size={12} />, color: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10', label: 'Meta' },
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const confidenceBar = (c?: number) => {
  const pct = Math.round((c ?? 0) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  const textColor = pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[9px] font-black ${textColor}`}>{pct}%</span>
    </div>
  );
};

// ─── AI Logs Tab ─────────────────────────────────────────────────────────────

const AILogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AIDebugEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const refresh = useCallback(() => setLogs(getAIDebugLogs()), []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{logs.length} entrada{logs.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-1">
          <button onClick={refresh} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"><RefreshCw size={13} /></button>
          <button onClick={() => { clearAIDebugLogs(); setLogs([]); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300 dark:text-slate-600">
            <Cpu size={36} />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum log ainda</p>
          </div>
        ) : logs.map(entry => (
          <div key={entry.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
              <div className="shrink-0">
                {entry.error ? <AlertCircle size={16} className="text-rose-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate">"{entry.input}"</p>
                <div className="flex items-center gap-3 mt-1">
                  {entry.predicted_category && (
                    <span className="flex items-center gap-1 text-[8px] font-black text-indigo-500 uppercase tracking-widest"><Tag size={8} />{entry.predicted_category}</span>
                  )}
                  <span className="flex items-center gap-1 text-[8px] text-slate-400"><Clock size={8} />{formatTime(entry.timestamp)}</span>
                  {entry.processing_ms && <span className="flex items-center gap-1 text-[8px] text-slate-400"><Zap size={8} />{entry.processing_ms}ms</span>}
                </div>
              </div>
              {entry.confidence !== undefined && <div className="w-20 shrink-0">{confidenceBar(entry.confidence)}</div>}
              <div className="text-slate-300 shrink-0">{expandedId === entry.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
            </button>
            {expandedId === entry.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                {entry.parsed_transaction && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Transação Parseada</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(entry.parsed_transaction).map(([k, v]) => v !== undefined && (
                        <div key={k} className="bg-white dark:bg-slate-800 rounded-xl px-3 py-2">
                          <p className="text-[7px] font-black text-slate-400 uppercase">{k}</p>
                          <p className="text-[10px] font-bold text-slate-800 dark:text-white truncate">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {entry.intent && (
                  <div className="flex items-center gap-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Intent:</p>
                    <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 rounded-full text-[8px] font-black">{entry.intent}</span>
                  </div>
                )}
                {entry.error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Erro</p>
                    <p className="text-[10px] text-rose-600 font-bold">{entry.error}</p>
                  </div>
                )}
                {entry.raw_response && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Resposta Bruta</p>
                    <pre className="text-[8px] bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap">
                      {entry.raw_response.slice(0, 500)}{entry.raw_response.length > 500 ? '...' : ''}
                    </pre>
                  </div>
                )}
                <p className="text-[8px] text-slate-300 text-right">ID: {entry.id}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Financial Events Tab ─────────────────────────────────────────────────────

const FinancialEventsTab: React.FC = () => {
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const refresh = useCallback(() => setEvents(getFinancialEvents()), []);
  useEffect(() => { refresh(); }, [refresh]);

  const byType = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{events.length} evento{events.length !== 1 ? 's' : ''}</span>
        <div className="flex gap-1">
          <button onClick={refresh} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors"><RefreshCw size={13} /></button>
          <button onClick={() => { clearFinancialEvents(); setEvents([]); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      {events.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto shrink-0 border-b border-slate-100 dark:border-slate-800" style={{ scrollbarWidth: 'none' }}>
          {Object.entries(byType).map(([type, count]) => {
            const meta = EVENT_META[type] ?? { color: 'text-slate-500 bg-slate-50', label: type, icon: <Activity size={12} /> };
            return (
              <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${meta.color} shrink-0`}>
                {meta.icon}
                <span className="text-[8px] font-black uppercase tracking-widest">{meta.label}</span>
                <span className="text-[8px] font-black opacity-70">×{count}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300 dark:text-slate-600">
            <GitBranch size={36} />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum evento ainda</p>
            <p className="text-[9px] text-slate-400">Adicione transações para gerar eventos</p>
          </div>
        ) : events.map(ev => {
          const meta = EVENT_META[ev.type] ?? { color: 'text-slate-500 bg-slate-50', label: ev.type, icon: <Activity size={12} /> };
          const isExp = expandedId === ev.id;
          return (
            <div key={ev.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setExpandedId(isExp ? null : ev.id)}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${meta.color}`}>{meta.label}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[8px] text-slate-400"><Clock size={8} />{formatTime(ev.created_at)}</span>
                    {ev.payload?.description && <span className="text-[8px] text-slate-500 font-bold truncate max-w-[120px]">{ev.payload.description}</span>}
                    {ev.payload?.count !== undefined && <span className="text-[8px] text-slate-400">{ev.payload.count} item{ev.payload.count !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div className="text-slate-300 shrink-0">{isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
              </button>
              {isExp && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 animate-in slide-in-from-top-2 duration-200">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Payload</p>
                  <pre className="text-[8px] bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto font-mono whitespace-pre-wrap">
                    {JSON.stringify(ev.payload, null, 2).slice(0, 600)}
                  </pre>
                  <p className="text-[8px] text-slate-300 text-right mt-2">ID: {ev.id}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

type PanelTab = 'ai_logs' | 'events';

const AIDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('ai_logs');
  const [logCount, setLogCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);

  const refreshCounts = useCallback(() => {
    setLogCount(getAIDebugLogs().length);
    setEventCount(getFinancialEvents().length);
  }, []);

  useEffect(() => { refreshCounts(); }, [isOpen, refreshCounts]);

  if (!IS_DEV) return null;

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); refreshCounts(); }}
        className="fixed bottom-24 left-4 z-[200] flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-white/10 hover:bg-slate-800 active:scale-95 transition-all"
      >
        <Bug size={14} className="text-indigo-400" />
        <span className="text-[9px] font-black uppercase tracking-widest">Dev Panel</span>
        {logCount + eventCount > 0 && (
          <span className="bg-indigo-600 text-white text-[7px] font-black rounded-full w-4 h-4 flex items-center justify-center">
            {logCount + eventCount > 99 ? '99+' : logCount + eventCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-4 duration-300 border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center"><Bug size={16} className="text-white" /></div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-sm">Dev Panel</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">somente DEV</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={16} /></button>
            </div>

            <div className="flex px-4 pt-3 gap-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
              {([
                { id: 'ai_logs' as PanelTab, label: 'AI Logs', icon: <Cpu size={13} />, count: logCount },
                { id: 'events' as PanelTab, label: 'Financial Events', icon: <Activity size={13} />, count: eventCount },
              ]).map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); refreshCounts(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-[9px] font-black uppercase tracking-widest transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.icon} {tab.label}
                  {tab.count > 0 && (
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[7px] font-black rounded-full px-1.5 py-0.5 ml-0.5">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'ai_logs' && <AILogsTab />}
              {activeTab === 'events'  && <FinancialEventsTab />}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><Bug size={10} /> NODE_ENV=development</span>
              <span className="text-[8px] font-black text-indigo-400">Flow Finance v0.4.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIDebugPanel;
