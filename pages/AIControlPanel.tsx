/**
 * AI CONTROL PANEL â€” src/pages/AIControlPanel.tsx
 *
 * PART 6 â€” Painel de controle para o sistema de IA do Flow Finance.
 * PART 7 â€” Visível apenas em modo desenvolvimento (IS_DEV).
 *
 * Design: dark terminal / command-center â€” monospace, scanline aesthetic,
 * deliberate brutalist density. Think "NASA mission control meets developer DevTools".
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Transaction, TransactionType } from '../types';
import { Account } from '../models/Account';
import { logWarn } from '../src/utils/logger';

// Services
import { getAIMemory, deleteMemory, updateMemory, AIMemory } from '../src/ai/aiMemory';
import { getAIDebugLogs, clearAIDebugLogs, AIDebugEntry } from '../src/ai/aiDebugService';
import { generateFinancialInsights, AIInsight } from '../src/ai/insightGenerator';
import { buildCashflowPrediction }             from '../src/ai/riskAnalyzer';
import { runFinancialAutopilot, AutopilotAction } from '../src/ai/financialAutopilot';
import { getFinancialEvents, clearFinancialEvents } from '../src/events/eventEngine';
import { FinancialEvent }                      from '../models/FinancialEvent';
import { getAdaptiveLearningStats }            from '../src/ai/adaptiveAIEngine';
import { detectSubscriptions, DetectedSubscription, formatCycle, formatNextCharge } from '../src/ai/subscriptionDetector';
import { buildFinancialGraph, getTopMerchants, getCategorySpending, detectSubscriptionCandidates } from '../src/ai/financialGraph';
import { calculateMoneyDistribution }          from '../src/finance/moneyMap';
import { parseOFX }                            from '../src/finance/ofxParser';
import { parseCSV }                            from '../src/finance/csvParser';
import { detectFinancialLeaks, FinancialLeak } from '../src/ai/leakDetector';
import { generateMonthlyReport, FinancialReport } from '../src/finance/reportEngine';
import { simulateFinancialScenario, FinancialSimulationResult, SimulationScenario } from '../src/ai/financialSimulator';
import { getAuditLogs, AUDIT_EVENTS, AuditLogEntry } from '../src/security/auditLogService';
import MetricsViewer from '../components/MetricsViewer';
import { detectSubscriptions as detectRecurringSubscriptions } from '../src/engines/finance/subscriptionDetector';
import { calculateFinancialHealth } from '../src/engines/finance/financialHealth/financialHealthEngine';
import { calculateGoalPlan } from '../src/engines/finance/smartGoals/smartGoalsEngine';
import { recommendGoalAdjustment } from '../src/engines/finance/smartGoals/goalRecommendationEngine';
import { buildFinancialTimeline as buildTimelineAI } from '../src/engines/finance/timeline/financialTimelineEngine';
import { aiTaskQueue } from '../src/ai/queue/AITaskQueue';
import { taskStore } from '../src/ai/queue/taskStore';
import { AITask, AITaskStatus } from '../src/ai/queue/taskTypes';

// Icons
import {
  Brain, Cpu, Zap, Activity, Database, RefreshCw, Trash2,
  ChevronRight, ChevronDown, Terminal, Shield, Sparkles,
  BarChart3, CreditCard, FileText, Calendar, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, TrendingDown, Eye, EyeOff,
  Code2, GitBranch, Package, Hash, Layers, Search, Filter,
  ArrowRight, X, Info, Bot, Target, Repeat2, Map, Network
} from 'lucide-react';

// â”€â”€â”€ Dev guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const IS_DEV = import.meta.env.DEV;

// â”€â”€â”€ Shared primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TermBadge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'text-emerald-400' }) => (
  <span className={`font-mono text-xs font-medium uppercase tracking-[0.08em] px-2 py-0.5 bg-black/40 border border-current/20 rounded ${color}`}>
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
      <span className="font-mono text-xs" style={{ color }}>{pct}%</span>
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; count?: number; onRefresh?: () => void; onClear?: () => void; refreshLabel?: string; clearLabel?: string }> = ({
  icon, title, count, onRefresh, onClear, refreshLabel = 'Atualizar', clearLabel = 'Limpar'
}) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 bg-slate-900/50">
    <div className="flex items-center gap-2">
      <span className="text-emerald-400">{icon}</span>
      <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-slate-300">{title}</span>
      {count !== undefined && (
        <span className="bg-slate-700 text-slate-400 font-mono text-xs px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
    <div className="flex gap-1">
      {onRefresh && (
        <button onClick={onRefresh} aria-label={refreshLabel} title={refreshLabel} className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors">
          <RefreshCw size={11} />
        </button>
      )}
      {onClear && (
        <button onClick={onClear} aria-label={clearLabel} title={clearLabel} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors">
          <Trash2 size={11} />
        </button>
      )}
    </div>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
    <span className="opacity-40">{icon}</span>
    <p className="font-mono text-xs uppercase tracking-[0.08em]">{message}</p>
  </div>
);

const clampConfidence = (value: number): number => Math.min(1, Math.max(0.1, value));

const inferMemoryOrigin = (entry: AIMemory): string => {
  const explicitOrigin = String(entry.metadata?.source ?? entry.metadata?.origin ?? '').trim();
  if (explicitOrigin) {
    return explicitOrigin;
  }

  if (
    entry.key.includes('merchant') ||
    entry.key.includes('category') ||
    entry.key.includes('recurring')
  ) {
    return 'categorização';
  }

  if (
    entry.key.includes('weekend') ||
    entry.key.includes('salary') ||
    entry.key.includes('balance') ||
    entry.key.includes('profile')
  ) {
    return 'inferência recorrente';
  }

  return 'inferência';
};

const getReviewLabel = (entry: AIMemory): string | null => {
  const reviewState = String(entry.metadata?.reviewState ?? '').trim();
  if (reviewState === 'confirmed') return 'confirmada';
  if (reviewState === 'invalidated') return 'invalidada';
  return null;
};

const STATUS_LABEL: Record<AITaskStatus, string> = {
  [AITaskStatus.PENDING]: 'Pendente',
  [AITaskStatus.PROCESSING]: 'Processando',
  [AITaskStatus.COMPLETED]: 'Concluida',
  [AITaskStatus.FAILED]: 'Falhou',
  [AITaskStatus.CANCELLED]: 'Cancelada',
};

const TASK_TYPE_LABEL: Record<string, string> = {
  INSIGHT_GENERATION: 'Insight',
  CASHFLOW_SIMULATION: 'Simulacao',
  FINANCIAL_REPORT: 'Relatorio',
  LEAK_DETECTION: 'Leak',
  AUTOPILOT_ANALYSIS: 'Autopilot',
  RISK_ANALYSIS: 'Risco',
  SUBSCRIPTION_DETECTION: 'Assinaturas',
  SALARY_DETECTION: 'Salario',
  FIXED_EXPENSE_DETECTION: 'Despesa fixa',
};

const QueueTab: React.FC = () => {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [isMutating, setIsMutating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const load = useCallback(() => {
    setTasks(taskStore.getAllTasks());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleQueueMutation = () => {
      load();
    };

    window.addEventListener('ai-task-enqueued', handleQueueMutation);
    window.addEventListener('ai-task-updated', handleQueueMutation);
    window.addEventListener('ai-task-queue-cleared', handleQueueMutation);

    return () => {
      window.removeEventListener('ai-task-enqueued', handleQueueMutation);
      window.removeEventListener('ai-task-updated', handleQueueMutation);
      window.removeEventListener('ai-task-queue-cleared', handleQueueMutation);
    };
  }, [load]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  useEffect(() => {
    if (selectedTaskId && !selectedTask) {
      setSelectedTaskId(null);
    }
  }, [selectedTask, selectedTaskId]);

  const stats = useMemo(() => tasks.reduce((acc, task) => {
    acc[task.status] += 1;
    return acc;
  }, {
    [AITaskStatus.PENDING]: 0,
    [AITaskStatus.PROCESSING]: 0,
    [AITaskStatus.COMPLETED]: 0,
    [AITaskStatus.FAILED]: 0,
    [AITaskStatus.CANCELLED]: 0,
  } as Record<AITaskStatus, number>), [tasks]);

  const handleCancelTask = useCallback((taskId: string) => {
    setIsMutating(true);
    try {
      if (aiTaskQueue.cancelTask(taskId)) {
        load();
      }
    } finally {
      setIsMutating(false);
    }
  }, [load]);

  const handleClearCompleted = useCallback(() => {
    if (!tasks.some((task) => task.status === AITaskStatus.COMPLETED || task.status === AITaskStatus.FAILED)) {
      return;
    }

    if (!window.confirm('Limpar tarefas concluídas e falhas da fila?')) {
      return;
    }

    setIsMutating(true);
    try {
      aiTaskQueue.clearCompletedTasks();
      load();
    } finally {
      setIsMutating(false);
    }
  }, [load, tasks]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        icon={<Activity size={11} />}
        title="AI Task Queue"
        count={tasks.length}
        onRefresh={load}
        onClear={handleClearCompleted}
        refreshLabel="Atualizar fila"
        clearLabel="Limpar tarefas concluídas e falhas da fila"
      />
      <div className="px-4 pt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {Object.entries(stats).map(([status, count]) => (
          <div key={status} className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{STATUS_LABEL[status as AITaskStatus]}</p>
            <p className="font-mono text-sm text-slate-100">{count}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Fila ativa</p>
          <p className="font-mono text-sm text-sky-300">{stats.pending + stats.processing}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Concluídas</p>
          <p className="font-mono text-sm text-emerald-300">{stats.completed}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Falhas</p>
          <p className="font-mono text-sm text-rose-300">{stats.failed}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Canceladas</p>
          <p className="font-mono text-sm text-slate-200">{stats.cancelled}</p>
        </div>
      </div>
      {selectedTask && (
        <div className="mx-4 mt-3 rounded-xl border border-sky-500/20 bg-slate-900/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-sky-300">Detalhes da tarefa</p>
              <p className="font-mono text-xs text-slate-300 truncate">{TASK_TYPE_LABEL[selectedTask.type] ?? selectedTask.type}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Fechar
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono uppercase tracking-[0.08em] text-slate-500">
            <span>Status: {STATUS_LABEL[selectedTask.status]}</span>
            <span>Prioridade: {selectedTask.priority}</span>
            <span>Retries: {selectedTask.retryCount}/{selectedTask.maxRetries}</span>
            <span>Usuário: {selectedTask.userId}</span>
          </div>
          <pre className="mt-2 max-h-36 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-2 font-mono text-[10px] text-slate-300 whitespace-pre-wrap">
            {JSON.stringify(selectedTask.payload, null, 2)}
          </pre>
          {selectedTask.error && (
            <p className="mt-2 font-mono text-[10px] text-rose-300">
              Erro: {selectedTask.error.message}
            </p>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 mt-3">
        {tasks.length === 0 ? (
          <EmptyState icon={<Activity size={32} />} message="Fila vazia" />
        ) : (
          tasks.slice(0, 12).map((task) => (
            <div key={task.id} className={`px-4 py-3 ${selectedTaskId === task.id ? 'bg-slate-800/20' : ''}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-emerald-300 truncate">{TASK_TYPE_LABEL[task.type] ?? task.type}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    {STATUS_LABEL[task.status]} · prioridade {task.priority}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  {new Date(task.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-500 truncate">
                {task.userId} · {task.id}
              </p>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                  aria-label={`Ver detalhes da tarefa ${task.id}`}
                  title={`Ver detalhes da tarefa ${task.id}`}
                  className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-sky-300 transition-colors hover:border-sky-400/50 hover:text-sky-200"
                >
                  <Info size={9} />
                  Detalhes
                </button>
                {task.status === AITaskStatus.PENDING && (
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleCancelTask(task.id)}
                    aria-label={`Cancelar tarefa ${task.id}`}
                    title={`Cancelar tarefa ${task.id}`}
                    className="inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X size={9} />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const buildReviewedMemory = (entry: AIMemory, reviewState: 'confirmed' | 'invalidated'): AIMemory => {
  const confidenceDelta = reviewState === 'confirmed' ? 0.08 : -0.18;
  return {
    ...entry,
    confidence: clampConfidence(entry.confidence + confidenceDelta),
    metadata: {
      ...(entry.metadata ?? {}),
      source: entry.metadata?.source ?? inferMemoryOrigin(entry),
      reviewState,
      reviewedAt: new Date().toISOString(),
    },
  };
};

// â”€â”€â”€ TAB: Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MemoryTab: React.FC<{ userId: string }> = ({ userId }) => {
  const [entries, setEntries] = useState<AIMemory[]>([]);
  const [filter, setFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'patterns' | 'profile' | 'merchants'>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadDiagnostic, setLoadDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoadDiagnostic(null);
    try {
      const mem = await getAIMemory(userId);
      setEntries([...mem].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    } catch (error) {
      logWarn('[AIControlPanel] Failed to load AI memory', {
        userId,
        error,
        fallback: 'ai-control-panel-memory-load-failed',
      });
      setEntries([]);
      setLoadError('Nao foi possivel carregar as memorias da IA agora.');
      setLoadDiagnostic({
        title: 'Falha ao carregar memorias',
        message: 'A consulta de memoria da IA nao concluiu agora.',
        suggestion: 'Atualize a tela ou tente novamente com a mesma sessao.',
      });
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteMemory = useCallback(async (entry: AIMemory) => {
    if (!window.confirm(`Excluir memoria ${entry.key}?`)) {
      return;
    }

    setIsMutating(true);
    try {
      await deleteMemory(entry.id);
      await load();
    } catch (error) {
      logWarn('[AIControlPanel] Failed to delete AI memory', {
        userId,
        memoryId: entry.id,
        error,
        fallback: 'ai-control-panel-memory-delete-failed',
      });
      setLoadError('Nao foi possivel excluir a memoria agora.');
      setLoadDiagnostic({
        title: 'Falha ao excluir memoria',
        message: 'A operacao de exclusao nao concluiu agora.',
        suggestion: 'Recarregue a tela e tente novamente com a mesma sessao.',
      });
    } finally {
      setIsMutating(false);
    }
  }, [load, userId]);

  const handleReviewMemory = useCallback(async (entry: AIMemory, reviewState: 'confirmed' | 'invalidated') => {
    setIsMutating(true);
    setLoadError(null);
    setLoadDiagnostic(null);
    const reviewedEntry = buildReviewedMemory(entry, reviewState);

    try {
      await updateMemory(reviewedEntry);
      setEntries((current) => current.map((memory) => (
        memory.id === entry.id ? reviewedEntry : memory
      )));
    } catch (error) {
      logWarn('[AIControlPanel] Failed to review AI memory', {
        userId,
        memoryId: entry.id,
        reviewState,
        error,
        fallback: 'ai-control-panel-memory-review-failed',
      });
      setLoadError('Nao foi possivel revisar a memoria agora.');
      setLoadDiagnostic({
        title: 'Falha ao revisar memoria',
        message: 'A confirmacao ou invalidacao da memoria nao concluiu agora.',
        suggestion: 'Recarregue a tela e tente novamente com a mesma sessao.',
      });
    } finally {
      setIsMutating(false);
    }
  }, [userId]);

  const handleClearMemories = useCallback(async () => {
    if (entries.length === 0) {
      return;
    }

    if (!window.confirm('Limpar todas as memorias desta sessao?')) {
      return;
    }

    setIsMutating(true);
    try {
      await Promise.all(entries.map((entry) => deleteMemory(entry.id)));
      await load();
    } catch (error) {
      logWarn('[AIControlPanel] Failed to clear AI memory', {
        userId,
        error,
        fallback: 'ai-control-panel-memory-clear-failed',
      });
      setLoadError('Nao foi possivel limpar as memorias agora.');
      setLoadDiagnostic({
        title: 'Falha ao limpar memorias',
        message: 'A exclusao em massa nao concluiu agora.',
        suggestion: 'Atualize a tela e tente novamente com a mesma sessao.',
      });
    } finally {
      setIsMutating(false);
    }
  }, [entries, load, userId]);

  const filtered = useMemo(() =>
    entries.filter((entry) => {
      const matchesText = !filter || entry.key.includes(filter) || entry.value.includes(filter);
      if (!matchesText) return false;

      switch (qualityFilter) {
        case 'high':
          return entry.confidence >= 0.75;
        case 'medium':
          return entry.confidence >= 0.5 && entry.confidence < 0.75;
        case 'low':
          return entry.confidence < 0.5;
        case 'patterns':
          return entry.key.includes('pattern') || entry.key.includes('weekend');
        case 'profile':
          return entry.key.includes('profile') || entry.key.includes('recurring');
        case 'merchants':
          return entry.key.includes('merchant');
        case 'all':
        default:
          return true;
      }
    }), [entries, filter, qualityFilter]);

  const handleClearFilteredMemories = useCallback(async () => {
    if (filtered.length === 0) {
      return;
    }

    if (!window.confirm(`Limpar ${filtered.length} memorias filtradas desta sessao?`)) {
      return;
    }

    setIsMutating(true);
    try {
      await Promise.all(filtered.map((entry) => deleteMemory(entry.id)));
      await load();
    } catch (error) {
      logWarn('[AIControlPanel] Failed to clear filtered AI memory', {
        userId,
        error,
        fallback: 'ai-control-panel-filtered-memory-clear-failed',
      });
      setLoadError('Nao foi possivel limpar as memorias filtradas agora.');
      setLoadDiagnostic({
        title: 'Falha ao limpar memorias filtradas',
        message: 'A exclusao do subconjunto filtrado nao concluiu agora.',
        suggestion: 'Recarregue a tela e tente novamente com a mesma sessao.',
      });
    } finally {
      setIsMutating(false);
    }
  }, [filtered, load, userId]);

  const memorySummary = useMemo(() => {
    const highConfidence = entries.filter((entry) => entry.confidence >= 0.75).length;
    const mediumConfidence = entries.filter((entry) => entry.confidence >= 0.5 && entry.confidence < 0.75).length;
    const lowConfidence = entries.filter((entry) => entry.confidence < 0.5).length;
    const patternEntries = entries.filter((entry) => entry.key.includes('pattern') || entry.key.includes('weekend'));
    const profileEntries = entries.filter((entry) => entry.key.includes('profile') || entry.key.includes('recurring'));
    const merchantEntries = entries.filter((entry) => entry.key.includes('merchant'));

    return {
      total: entries.length,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      patternCount: patternEntries.length,
      profileCount: profileEntries.length,
      merchantCount: merchantEntries.length,
      patternEntries,
      profileEntries,
      merchantEntries,
      latestUpdatedAt: entries[0]?.updated_at ?? null,
    };
  }, [entries]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Database size={11} />} title="AI Memory" count={entries.length} onRefresh={load} />

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Total</p>
            <p className="font-mono text-sm text-slate-100">{memorySummary.total}</p>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-400">Alta confianca</p>
            <p className="font-mono text-sm text-emerald-300">{memorySummary.highConfidence}</p>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-amber-400">Confianca media</p>
            <p className="font-mono text-sm text-amber-300">{memorySummary.mediumConfidence}</p>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-rose-400">Baixa confianca</p>
            <p className="font-mono text-sm text-rose-300">{memorySummary.lowConfidence}</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Padrões</p>
            <p className="font-mono text-sm text-slate-200">{memorySummary.patternCount}</p>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Perfil</p>
            <p className="font-mono text-sm text-slate-200">{memorySummary.profileCount}</p>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-black/30 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">Comerciantes</p>
            <p className="font-mono text-sm text-slate-200">{memorySummary.merchantCount}</p>
          </div>
        </div>
        {memorySummary.latestUpdatedAt && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
            Atualizado em {new Date(memorySummary.latestUpdatedAt).toLocaleString('pt-BR')}
          </p>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            { label: 'Padr?es', items: memorySummary.patternEntries },
            { label: 'Perfil financeiro', items: memorySummary.profileEntries },
            { label: 'Comerciantes', items: memorySummary.merchantEntries },
          ].map((group) => (
            <div key={group.label} className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">{group.label}</p>
              <div className="mt-2 space-y-2">
                {group.items.length > 0 ? (
                  group.items.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-slate-800 bg-black/20 px-2.5 py-2">
                      <p className="font-mono text-[10px] text-emerald-300 truncate">{entry.key}</p>
                      <p className="font-mono text-[10px] text-slate-400 truncate">{entry.value}</p>
                      <p className="font-mono text-[10px] text-slate-500">Confian?a {Math.round(entry.confidence * 100)}%</p>
                    </div>
                  ))
                ) : (
                  <p className="font-mono text-[10px] text-slate-500">Nenhuma mem?ria neste grupo</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'high', label: 'Alta confiança' },
            { id: 'medium', label: 'Confiança média' },
            { id: 'low', label: 'Baixa confiança' },
            { id: 'patterns', label: 'Padrões' },
            { id: 'profile', label: 'Perfil' },
            { id: 'merchants', label: 'Comerciantes' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setQualityFilter(chip.id as typeof qualityFilter)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                qualityFilter === chip.id
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 bg-black/40 border border-slate-700 rounded px-3 py-1.5">
            <Search size={10} className="text-slate-500" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filtrar por chave ou valor..."
              className="flex-1 bg-transparent font-mono text-xs text-slate-300 placeholder-slate-600 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleClearMemories()}
            disabled={isMutating || entries.length === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={10} />
            Limpar memorias
          </button>
          <button
            type="button"
            onClick={() => void handleClearFilteredMemories()}
            disabled={isMutating || filtered.length === 0 || filtered.length === entries.length}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={10} />
            Limpar filtradas
          </button>
        </div>
      </div>

      {loadError && loadDiagnostic && (
        <div className="px-4 pt-3">
          <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-amber-400">{loadDiagnostic.title}</p>
            <p className="font-mono text-xs text-amber-100">{loadDiagnostic.message}</p>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-amber-300">Proximo passo: {loadDiagnostic.suggestion}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !loadError ? (
          <EmptyState icon={<Brain size={32} />} message="Nenhuma memória encontrada" />
        ) : (
          <div className="divide-y divide-slate-800">
            {filtered.map(entry => (
              <div key={entry.id} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash size={9} className="text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs text-emerald-300 truncate">{entry.key}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-400 ml-3.5 truncate">? {entry.value}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 ml-3.5 mt-1">
                      Origem: {inferMemoryOrigin(entry)}
                    </p>
                    {getReviewLabel(entry) && (
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-400 ml-3.5 mt-0.5">
                        Revis?o: {getReviewLabel(entry)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <ConfBar value={entry.confidence} />
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleReviewMemory(entry, 'confirmed')}
                        disabled={isMutating}
                        aria-label={`Confirmar memoria ${entry.key}`}
                        title={`Confirmar memoria ${entry.key}`}
                        className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-300 transition-colors hover:border-emerald-400/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircle2 size={9} />
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReviewMemory(entry, 'invalidated')}
                        disabled={isMutating}
                        aria-label={`Invalidar memoria ${entry.key}`}
                        title={`Invalidar memoria ${entry.key}`}
                        className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-300 transition-colors hover:border-amber-400/50 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X size={9} />
                        Invalidar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMemory(entry)}
                        disabled={isMutating}
                        aria-label={`Excluir memoria ${entry.key}`}
                        title={`Excluir memoria ${entry.key}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-700/60 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={9} />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-600 mt-1.5 ml-3.5 flex items-center gap-1">
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

// â”€â”€â”€ TAB: Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <EmptyState icon={<Sparkles size={32} />} message="Sem insights â€” adicione transações" />
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
                    <span className={`font-mono text-xs font-medium uppercase ${severityColor[insight.severity]}`}>
                      {insight.severity}
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-slate-300 leading-relaxed">{insight.message}</p>
                <p className="font-mono text-xs text-slate-600 mt-2 flex items-center gap-1">
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

// â”€â”€â”€ TAB: Autopilot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          <EmptyState icon={<Bot size={32} />} message="Nenhuma ação â€” dados insuficientes" />
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
                        <p className="font-mono text-xs text-slate-200 font-medium leading-tight">{action.title}</p>
                        <TermBadge>{style.label}</TermBadge>
                      </div>
                      <p className="font-mono text-xs text-slate-400 leading-relaxed">{action.description}</p>
                      {action.value !== undefined && (
                        <p className="font-mono text-xs text-emerald-400 mt-1.5">
                          â†— {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(action.value)}
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

// â”€â”€â”€ TAB: Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                  <span className={`font-mono text-xs font-medium uppercase tracking-[0.08em] ${eventColor[ev.type] ?? 'text-slate-400'}`}>
                    {ev.type}
                  </span>
                  <span className="flex-1 font-mono text-xs text-slate-600 truncate">
                    {new Date(ev.created_at).toLocaleTimeString('pt-BR')}
                  </span>
                  {expanded === ev.id ? <ChevronDown size={10} className="text-slate-500" /> : <ChevronRight size={10} className="text-slate-600" />}
                </button>
                {expanded === ev.id && (
                  <div className="px-4 pb-3">
                    <pre className="font-mono text-xs text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40">
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

// â”€â”€â”€ TAB: AI Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                    <p className="font-mono text-xs text-slate-300 truncate">{log.input}</p>
                    {log.predicted_category && (
                      <p className="font-mono text-xs text-emerald-500 mt-0.5">â†’ {log.predicted_category}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {log.confidence !== undefined && <ConfBar value={log.confidence} />}
                    {log.processing_ms && (
                      <span className="font-mono text-xs text-slate-600">{log.processing_ms}ms</span>
                    )}
                  </div>
                </button>
                {expanded === log.id && (
                  <div className="px-4 pb-3">
                    <pre className="font-mono text-xs text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40">
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

// â”€â”€â”€ TAB: Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em]">{label}</p>
              <p className={`font-mono text-sm font-medium ${color} mt-0.5`}>{value}</p>
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
                      <p className="font-mono text-xs text-slate-200 font-medium">{sub.name}</p>
                      <span className="font-mono text-xs text-rose-400 font-medium">{fmt(sub.amount)}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <TermBadge color="text-sky-400">{formatCycle(sub.cycle)}</TermBadge>
                      <TermBadge color="text-slate-400">{sub.category}</TermBadge>
                      <TermBadge color="text-violet-400">{sub.occurrences}Ã— detectado</TermBadge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Calendar size={8} className="text-slate-500" />
                      <span className="font-mono text-xs text-slate-500">
                        Próxima: {formatNextCharge(sub.next_expected)}
                      </span>
                      <span className="font-mono text-xs text-slate-600 ml-auto">
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

// â”€â”€â”€ TAB: Money Map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            className={`flex-1 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-colors
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
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em]">{label}</p>
              <p className={`font-mono text-xs font-medium ${color} mt-0.5 truncate`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Segmented bar */}
        {map.distribution.length > 0 && (
          <div className="mb-4">
            <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Distribuição</p>
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
                <span className="font-mono text-xs text-slate-300 flex-1 truncate">{item.category}</span>
                <span className="font-mono text-xs text-slate-500">{item.count}Ã—</span>
                <div className="flex items-center gap-1">
                  {item.trend === 'up'   && <TrendingUp  size={8} className="text-rose-400"    />}
                  {item.trend === 'down' && <TrendingDown size={8} className="text-emerald-400" />}
                </div>
                <span className="font-mono text-xs text-slate-400 w-12 text-right">{item.percentage.toFixed(1)}%</span>
                <span className="font-mono text-xs text-slate-200 w-20 text-right">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ TAB: Leaks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LeaksTab: React.FC<{ transactions: Transaction[]; leaks?: FinancialLeak[] }> = ({ transactions, leaks }) => {
  const computedLeaks = useMemo(() => detectFinancialLeaks(transactions), [transactions]);
  const leakList = leaks ?? computedLeaks;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<AlertTriangle size={11} />} title="Financial Leaks" count={leakList.length} />

      <div className="flex-1 overflow-y-auto">
        {leakList.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={32} />} message="Nenhum vazamento detectado" />
        ) : (
          <div className="divide-y divide-slate-800">
            {leakList.map((leak, idx) => (
              <div key={idx} className="px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={9} className="text-rose-500 shrink-0" />
                      <span className="font-mono text-xs text-rose-300 truncate">{leak.merchant}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-400 ml-3.5">R$ {leak.monthly_cost.toFixed(2)}/mês - {leak.occurrences} ocorrências</p>
                    <p className="font-mono text-xs text-slate-500 ml-3.5 mt-1">{leak.suggestion}</p>
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

// â”€â”€â”€ TAB: Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ReportTab: React.FC<{ transactions: Transaction[]; report?: FinancialReport | null }> = ({ transactions, report }) => {
  const computedReport = useMemo(() => generateMonthlyReport(transactions), [transactions]);
  const reportSnapshot = report ?? computedReport;

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<BarChart3 size={11} />} title="Monthly Report" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded p-4">
          <h3 className="font-mono text-xs text-emerald-400 mb-3">{reportSnapshot.month}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-xs text-slate-500">Receitas</p>
              <p className="font-mono text-[12px] text-emerald-400">R$ {reportSnapshot.total_income.toFixed(2)}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-slate-500">Despesas</p>
              <p className="font-mono text-[12px] text-rose-400">R$ {reportSnapshot.total_expenses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded p-4">
          <h4 className="font-mono text-xs text-slate-300 mb-2">Top Categorias</h4>
          <div className="space-y-2">
            {reportSnapshot.top_categories.map(cat => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{cat.category}</span>
                <span className="font-mono text-xs text-emerald-400">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {reportSnapshot.insights.length > 0 && (
          <div className="bg-slate-800/50 rounded p-4">
            <h4 className="font-mono text-xs text-slate-300 mb-2">Insights</h4>
            <div className="space-y-1">
              {reportSnapshot.insights.map((insight, idx) => (
                <p key={idx} className="font-mono text-xs text-slate-400">{insight}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ TAB: Simulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SimulationTab: React.FC<{ transactions: Transaction[]; accounts: Account[] }> = ({ transactions, accounts }) => {
  const [scenario, setScenario] = useState<SimulationScenario>({
    type: 'extra_spending',
    amount: 500,
    description: 'uma viagem de fim de semana'
  });
  const [amountRaw, setAmountRaw] = useState('500');
  const [result, setResult] = useState<FinancialSimulationResult | null>(null);
  const hasRunRef = useRef(false);

  const setSimulationType = useCallback((nextType: SimulationScenario['type']) => {
    if (nextType === 'months') {
      setScenario((current) => ({
        type: 'months',
        months: current.type === 'months' ? current.months : 3,
        description: current.description,
      }));
      return;
    }

    setScenario((current) => ({
      type: nextType,
      amount: nextType === 'extra_spending'
        ? (current.type === 'extra_spending' ? current.amount : 500)
        : (current.type === 'monthly_savings' ? current.amount : 500),
      description: current.description,
    }));

    if (nextType === 'extra_spending') {
      setAmountRaw((current) => current || '500');
    }
  }, []);

  const buildScenarioWithParsedAmount = (): SimulationScenario => {
    if (scenario.type === 'months') return scenario;
    const parsed = parseFloat(String(amountRaw).replace(',', '.'));
    const amount = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    return { ...scenario, amount } as SimulationScenario;
  };

  const runSimulation = () => {
    const finalScenario = buildScenarioWithParsedAmount();
    const monthsScenario = finalScenario.type === 'months'
      ? { ...finalScenario, months: Math.max(1, finalScenario.months) }
      : finalScenario;
    const res = simulateFinancialScenario(accounts, transactions, monthsScenario as SimulationScenario);
    setResult(res);
    hasRunRef.current = true;
  };

  useEffect(() => {
    if (hasRunRef.current) {
      runSimulation();
    }
  }, [transactions]);

  // Auto-run na montagem
  useEffect(() => {
    runSimulation();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<TrendingUp size={11} />} title="Financial Simulation" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded p-4">
          <h4 className="font-mono text-xs text-slate-300 mb-3">Configurar Cenário</h4>
          <div className="space-y-3">
            <select
              value={scenario.type}
              onChange={e => setSimulationType(e.target.value as SimulationScenario['type'])}
              className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
            >
              <option value="extra_spending">Gasto Extra</option>
              <option value="monthly_savings">Economia Mensal</option>
              <option value="months">Projeção por Meses</option>
            </select>

            {scenario.type === 'extra_spending' && (
              <>
                <label htmlFor="sim-amount-extra" className="font-mono text-xs text-slate-400">Valor do gasto extra (R$)</label>
                <input
                  id="sim-amount-extra"
                  type="text"
                  inputMode="decimal"
                  value={amountRaw}
                  onChange={e => setAmountRaw(e.target.value)}
                  placeholder="Valor"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
                />
                <input
                  value={scenario.description}
                  onChange={e => setScenario({ ...scenario, description: e.target.value })}
                  placeholder="Descrição"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
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
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
                />
                <input
                  value={scenario.description}
                  onChange={e => setScenario({ ...scenario, description: e.target.value })}
                  placeholder="Descrição"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
                />
              </>
            )}

            {scenario.type === 'months' && (
              <>
                <label htmlFor="sim-months" className="font-mono text-xs text-slate-400">Meses da projeção</label>
              <input
                  id="sim-months"
                  type="number"
                  value={scenario.type === 'months' ? scenario.months : 3}
                  onChange={e => setScenario({ type: 'months', months: Number(e.target.value) || 0, description: scenario.description })}
                  placeholder="Meses"
                  className="w-full bg-black/40 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-slate-300"
                />
              </>
            )}

            <button
              onClick={runSimulation}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs py-2 rounded transition-colors"
            >
              Simular
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-slate-800/50 rounded p-4">
            <h4 className="font-mono text-xs text-emerald-400 mb-3">Resultado</h4>
            <p className="font-mono text-xs text-slate-300 mb-3">{result.summary}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-xs text-slate-500">Saldo Projetado</p>
                <p className="font-mono text-[12px] text-emerald-400">R$ {result.projected_balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-slate-500">Período</p>
                <p className="font-mono text-[12px] text-slate-300">{result.simulation_period} meses</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ TAB: Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            className="flex-1 bg-transparent font-mono text-xs text-slate-300 placeholder-slate-600 outline-none"
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
                      <span className="font-mono text-xs text-emerald-400">{log.event_type}</span>
                      <span className="font-mono text-xs text-slate-500">â†’</span>
                      <span className="font-mono text-xs text-slate-300">{log.entity}:{log.entity_id}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <pre className="font-mono text-xs text-slate-600 mt-1 overflow-x-auto">
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

// â”€â”€â”€ TAB: Parser Lab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ParserLabTab: React.FC = () => {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState<'ofx' | 'csv'>('ofx');
  const [result, setResult] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{ title: string; message: string; suggestion: string } | null>(null);

  const buildDiagnostic = (currentFormat: 'ofx' | 'csv', currentInput: string, parsedCount: number) => {
    if (parsedCount > 0) return null;

    const sample = currentFormat === 'ofx'
      ? 'Exemplo: <STMTTRN>...<TRNAMT>-89.90...'
      : 'Exemplo: Data,Descricao,Valor';

    return {
      title: 'Nenhuma transacao foi identificada',
      message: currentInput.trim()
        ? `O arquivo nao bateu com o formato ${currentFormat.toUpperCase()} esperado ou nao trouxe campos mapeaveis.`
        : 'Cole um extrato valido para o formato selecionado antes de executar o parser.',
      suggestion: currentInput.trim()
        ? `Revise o separador, o cabecalho e os campos obrigatorios. ${sample}`
        : `Cole um exemplo minimo no formato ${currentFormat.toUpperCase()} e execute novamente. ${sample}`,
    };
  };

  const run = () => {
    setError(null);
    setDiagnostic(null);
    try {
      const txs = format === 'ofx' ? parseOFX(input) : parseCSV(input);
      if (!txs.length) {
        setDiagnostic(buildDiagnostic(format, input, txs.length));
      }
      setResult(txs);
    } catch (error: unknown) {
      const parserError = error instanceof Error ? error : new Error('Nao foi possivel processar o arquivo.');
      logWarn('[AIControlPanel] Parser Lab failed to process input', {
        format,
        inputLength: input.length,
        error: parserError,
        fallback: 'ai-control-panel-parser-lab-failed',
      });
      setError(parserError.message);
      setDiagnostic({
        title: 'Falha ao processar o arquivo',
        message: `O parser interrompeu a leitura do arquivo ${format.toUpperCase()}.`,
        suggestion: `Confirme se o conteudo segue o formato ${format.toUpperCase()} e tente novamente.`,
      });
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
              onClick={() => { setFormat(f); setError(null); setDiagnostic(null); setResult(null); }}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] rounded transition-colors
                ${format === f ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-500 hover:text-slate-300 border border-slate-700'}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); setResult(null); setError(null); setDiagnostic(null); }}
          placeholder={format === 'ofx' ? '<STMTTRN>\n<DTPOSTED>20260301\n<TRNAMT>-89.90\n<MEMO>iFood\n</STMTTRN>' : 'Data,Descricao,Valor\n01/03/2026,iFood,-89.90\n01/03/2026,Salario,3200.00'}
          rows={8}
          className="w-full bg-black/50 border border-slate-700 rounded font-mono text-xs text-slate-300 p-3 resize-none outline-none focus:border-emerald-500/50 placeholder-slate-700"
        />

        <button
          onClick={run}
          className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 rounded font-mono text-xs uppercase tracking-[0.08em] hover:bg-emerald-500/20 transition-colors"
        >
          <Terminal size={11} /> Executar Parser
        </button>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded p-3">
            <p className="font-mono text-xs text-rose-400">{error}</p>
          </div>
        )}

        {diagnostic && (
          <div role="status" className="bg-amber-500/10 border border-amber-500/30 rounded p-3">
            <p className="font-mono text-xs text-amber-300 uppercase tracking-[0.08em]">{diagnostic.title}</p>
            <p className="font-mono text-xs text-amber-200 mt-1 leading-relaxed">{diagnostic.message}</p>
            <p className="font-mono text-xs text-amber-100 mt-2 uppercase tracking-[0.08em]">Proximo passo: {diagnostic.suggestion}</p>
          </div>
        )}

        {result && (
          <div>
            <p className="font-mono text-xs text-slate-500 mb-2 uppercase tracking-[0.08em]">{result.length} transacoes parseadas</p>
            <pre className="font-mono text-xs text-slate-400 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap border border-slate-700/40 max-h-64">
              {JSON.stringify(result.slice(0, 5), null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
// â”€â”€â”€ PART 7 â€” Graph Visualization Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â€” Graph Visualization Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            <p className={`font-mono text-xs font-medium ${s.color}`}>{s.value}</p>
            <p className="font-mono text-xs text-slate-600 uppercase tracking-[0.08em]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex overflow-x-auto border-b border-slate-700/60">
        {viewBtns.map(btn => (
          <button
            key={btn.id}
            onClick={() => setView(btn.id)}
            className={`px-3 py-1.5 shrink-0 font-mono text-xs uppercase tracking-[0.08em] transition-colors border-b-2
              ${view === btn.id ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW â€” node type distribution + graph schema */}
        {view === 'overview' && (
          <div className="p-3 flex flex-col gap-3">
            {/* Schema legend */}
            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Schema</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(nodeTypeColor).map(([type, cls]) => (
                  <span key={type} className={`font-mono text-xs px-2 py-0.5 rounded border ${cls}`}>{type}</span>
                ))}
              </div>
            </div>

            {/* Edge relation legend */}
            <div>
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Relations</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ['owns',            'user â†’ account'],
                  ['has_transaction', 'account â†’ tx'],
                  ['paid_to',         'tx â†’ merchant'],
                  ['belongs_to',      'tx â†’ category'],
                  ['same_category',   'merchant â†’ category'],
                  ['is_subscription', 'merchant â†’ sub'],
                  ['co_occurs',       'merchant â†” merchant'],
                  ['recurring_from',  'sub â†’ merchant'],
                ].map(([rel, desc]) => (
                  <div key={rel} className="flex items-center gap-1.5">
                    <ArrowRight size={7} className="text-slate-600 shrink-0" />
                    <span className="font-mono text-xs text-emerald-400">{rel}</span>
                    <span className="font-mono text-xs text-slate-600 truncate">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Built at */}
            <div className="flex items-center gap-2 bg-black/30 border border-slate-700/50 rounded-lg px-3 py-2">
              <Clock size={9} className="text-slate-500" />
              <span className="font-mono text-xs text-slate-400">
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
                  placeholder="Buscar merchantâ€¦"
                  className="flex-1 bg-transparent font-mono text-xs text-slate-300 placeholder-slate-600 outline-none"
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
                        <span className="font-mono text-xs text-slate-600 w-4 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-amber-300 truncate">{m.name}</p>
                          <p className="font-mono text-xs text-slate-500 mt-0.5">{m.visit_count}Ã— · avg {fmt(m.avg_amount)}</p>
                        </div>
                        <span className="font-mono text-xs text-slate-200 font-medium">{fmt(m.total_spent)}</span>
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
                      <span className="font-mono text-xs text-violet-300 font-medium">{cat.name}</span>
                      <TermBadge color={
                        cat.trend === 'up' ? 'text-rose-400' :
                        cat.trend === 'down' ? 'text-emerald-400' : 'text-slate-400'
                      }>{cat.trend}</TermBadge>
                    </div>
                    <span className="font-mono text-xs text-slate-200 font-medium">{fmt(cat.total)}</span>
                  </div>
                  {/* progress bar */}
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{cat.count} transações · {cat.percentage.toFixed(1)}%</span>
                    {cat.top_merchants.length > 0 && (
                      <span className="font-mono text-xs text-slate-500 truncate max-w-[120px]">{cat.top_merchants.join(', ')}</span>
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
                    <p className="font-mono text-xs text-slate-200 truncate">{sub.name}</p>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">
                      {sub.visit_count}Ã— · {sub.is_confirmed_subscription ? 'âœ“ confirmada' : '? candidata'}
                    </p>
                  </div>
                  <span className={`font-mono text-xs font-medium ${sub.is_confirmed_subscription ? 'text-emerald-400' : 'text-amber-400'}`}>
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
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Relation counts</p>
              {(() => {
                const counts: Record<string, number> = {};
                for (const e of graph.edges) {
                  counts[e.relation] = (counts[e.relation] ?? 0) + 1;
                }
                return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([rel, cnt]) => (
                  <div key={rel} className="flex items-center gap-2 mb-1.5">
                    <ArrowRight size={8} className="text-emerald-500 shrink-0" />
                    <span className="font-mono text-xs text-emerald-300 w-32 shrink-0">{rel}</span>
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${Math.min(100, (cnt / graph.edges.length) * 100 * 5)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-slate-400 w-8 text-right">{cnt}</span>
                  </div>
                ));
              })()}
            </div>

            {/* Co-occurrence edges (interesting pairs) */}
            <div className="p-3">
              <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Co-occurrence pairs</p>
              {graph.edges
                .filter(e => e.relation === 'co_occurs')
                .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                .slice(0, 8)
                .map((e, i) => {
                  const fromLabel = graph.nodes.get(e.from)?.label ?? e.from;
                  const toLabel   = graph.nodes.get(e.to)?.label   ?? e.to;
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="font-mono text-xs text-slate-600 w-3">{e.weight}Ã—</span>
                      <span className="font-mono text-xs text-amber-400 truncate max-w-[90px]">{fromLabel}</span>
                      <ArrowRight size={7} className="text-slate-600 shrink-0" />
                      <span className="font-mono text-xs text-amber-300 truncate max-w-[90px]">{toLabel}</span>
                    </div>
                  );
                })}
              {graph.edges.filter(e => e.relation === 'co_occurs').length === 0 && (
                <p className="font-mono text-xs text-slate-600">Sem co-ocorrências</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ PART 7 â€” System Stats (quick read at a glance) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SystemStats: React.FC<{ transactions: Transaction[]; accounts: Account[]; userId: string }> = ({
  transactions, accounts, userId
}) => {
  const stats = useMemo(() => getAdaptiveLearningStats(userId), [userId]);
  const events = useMemo(() => getFinancialEvents(), []);
  const [queueStats, setQueueStats] = useState(() => aiTaskQueue.getQueueStats());

  useEffect(() => {
    const syncQueueStats = () => {
      setQueueStats(aiTaskQueue.getQueueStats());
    };

    syncQueueStats();
    window.addEventListener('ai-task-enqueued', syncQueueStats);
    window.addEventListener('ai-task-updated', syncQueueStats);
    window.addEventListener('ai-task-queue-cleared', syncQueueStats);

    return () => {
      window.removeEventListener('ai-task-enqueued', syncQueueStats);
      window.removeEventListener('ai-task-updated', syncQueueStats);
      window.removeEventListener('ai-task-queue-cleared', syncQueueStats);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
      {[
        { label: 'Transações',     value: transactions.length,       icon: <ArrowRight size={9} />, color: 'text-indigo-400' },
        { label: 'Contas',         value: accounts.length,           icon: <Database size={9} />,   color: 'text-sky-400' },
        { label: 'Memórias',       value: stats.memory_count,        icon: <Brain size={9} />,      color: 'text-violet-400' },
        { label: 'Padrões',        value: stats.pattern_count,       icon: <GitBranch size={9} />,  color: 'text-amber-400' },
        { label: 'Eventos',        value: events.length,             icon: <Activity size={9} />,   color: 'text-emerald-400' },
        { label: 'Fila AI',        value: queueStats.pending + queueStats.processing, icon: <Activity size={9} />, color: 'text-sky-300' },
        { label: 'Canceladas',     value: queueStats.cancelled,      icon: <X size={9} />,          color: 'text-slate-300' },
        { label: 'Insights+',      value: stats.is_learning ? stats.pattern_count : 0, icon: <Sparkles size={9} />,   color: 'text-rose-400' },
      ].map(({ label, value, icon, color }) => (
        <div key={label} aria-label={`${label}: ${value}`} className="flex items-center gap-2 px-3 py-2 bg-black/30 border border-slate-700/40 rounded-lg">
          <span className={color}>{icon}</span>
          <div>
            <p className={`font-mono text-sm font-medium leading-none ${color}`}>{value}</p>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const FinancialHealthTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const prediction = useMemo(() => buildCashflowPrediction(transactions), [transactions]);
  const subscriptions = useMemo(() =>
    detectRecurringSubscriptions(
      transactions.map((t) => ({
        date: t.date,
        amount: t.type === TransactionType.DESPESA ? -Math.abs(t.amount) : t.amount,
        description: t.description,
        merchant: t.merchant,
      }))
    ),
  [transactions]);

  const expenseRatio = prediction.projected_income > 0
    ? prediction.projected_expenses / prediction.projected_income
    : 1;
  const savingsRate = prediction.projected_income > 0
    ? (prediction.projected_income - prediction.projected_expenses) / prediction.projected_income
    : 0;

  const score = useMemo(() => calculateFinancialHealth({
    expenseRatio,
    savingsRate,
    forecast: { in30Days: prediction.balance_30_days },
    subscriptionCount: subscriptions.length,
  }), [expenseRatio, savingsRate, prediction.balance_30_days, subscriptions.length]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Shield size={11} />} title="Financial Health" />
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded p-4">
          <p className="font-mono text-xs text-slate-400 uppercase tracking-[0.08em]">Score</p>
          <p className="font-mono text-[22px] font-medium text-emerald-400">{score.score} / 100</p>
          <p className="font-mono text-xs text-slate-300 uppercase tracking-[0.08em] mt-1">{score.status}</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-700/50 rounded p-3">
          <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-2">Alertas</p>
          {score.alerts.length === 0
            ? <p className="font-mono text-xs text-emerald-400">Nenhum alerta crítico detectado.</p>
            : score.alerts.map((alert, idx) => (
              <p key={idx} className="font-mono text-xs text-amber-300 mb-1">â€¢ {alert}</p>
            ))}
        </div>
      </div>
    </div>
  );
};

const SmartGoalsTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const prediction = useMemo(() => buildCashflowPrediction(transactions), [transactions]);

  const goalPlan = useMemo(() => calculateGoalPlan({
    targetAmount: 10000,
    currentAmount: Math.max(0, prediction.current_balance),
    targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 12, 1).toISOString(),
  }), [prediction.current_balance]);

  const health = useMemo(() => calculateFinancialHealth({
    expenseRatio: prediction.projected_income > 0 ? prediction.projected_expenses / prediction.projected_income : 1,
    savingsRate: prediction.projected_income > 0 ? (prediction.projected_income - prediction.projected_expenses) / prediction.projected_income : 0,
    forecast: { in30Days: prediction.balance_30_days },
  }), [prediction]);

  const recommendation = useMemo(() => recommendGoalAdjustment(
    goalPlan,
    { in30Days: prediction.balance_30_days },
    { score: health.score }
  ), [goalPlan, prediction.balance_30_days, health.score]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Target size={11} />} title="Smart Goals Preview" />
      <div className="p-4 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/40 rounded p-3">
            <p className="font-mono text-xs text-slate-500">Restante</p>
            <p className="font-mono text-[12px] text-emerald-400">R$ {goalPlan.remaining.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/40 rounded p-3">
            <p className="font-mono text-xs text-slate-500">Economia mensal</p>
            <p className="font-mono text-[12px] text-amber-400">
              {goalPlan.recommendedMonthlySavings === null
                ? 'N/A'
                : `R$ ${goalPlan.recommendedMonthlySavings.toFixed(2)}`}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-700/50 rounded p-3">
          <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.08em] mb-1">Recomendação IA</p>
          <p className="font-mono text-xs text-slate-200">{recommendation}</p>
        </div>
      </div>
    </div>
  );
};

const FinancialTimelineTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const timeline = useMemo(() => buildTimelineAI(
    transactions.map((t) => ({
      date: t.date,
      amount: t.type === TransactionType.RECEITA ? t.amount : -Math.abs(t.amount),
      category: String(t.category),
      merchant: t.merchant,
    }))
  ), [transactions]);

  return (
    <div className="flex flex-col h-full">
      <SectionHeader icon={<Calendar size={11} />} title="Financial Timeline" count={timeline.length} />
      <div className="overflow-y-auto divide-y divide-slate-800/60">
        {timeline.map((item) => (
          <div key={item.month} className="px-4 py-3">
            <p className="font-mono text-xs text-sky-300 font-medium">{item.month}</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <p className="font-mono text-xs text-emerald-400">+ R$ {item.income.toFixed(2)}</p>
              <p className="font-mono text-xs text-rose-400">- R$ {item.expenses.toFixed(2)}</p>
              <p className={`font-mono text-xs ${item.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                Saldo: R$ {item.balance.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
        {timeline.length === 0 && (
          <div className="px-4 py-6">
            <p className="font-mono text-xs text-slate-500">Sem dados suficientes para timeline.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AIControlPanelProps {
  transactions: Transaction[];
  accounts: Account[];
  userId: string;
  leaks?: FinancialLeak[];
  report?: FinancialReport | null;
}

type PanelTab = 'stats' | 'memory' | 'queue' | 'insights' | 'autopilot' | 'events' | 'logs' | 'subscriptions' | 'moneymap' | 'leaks' | 'report' | 'simulation' | 'audit' | 'parser' | 'graph' | 'metrics' | 'health' | 'goals' | 'timeline';

const TAB_CONFIG: Array<{ id: PanelTab; label: string; icon: React.ReactNode }> = [
  { id: 'stats',         label: 'Stats',         icon: <Layers size={11} />       },
  { id: 'memory',        label: 'Memory',        icon: <Database size={11} />     },
  { id: 'queue',         label: 'Queue',         icon: <Activity size={11} />     },
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
  { id: 'metrics',       label: 'Metrics',       icon: <BarChart3 size={11} />    },
  { id: 'health',        label: 'Health',        icon: <Shield size={11} />       },
  { id: 'goals',         label: 'Goals',         icon: <Target size={11} />       },
  { id: 'timeline',      label: 'Timeline',      icon: <Calendar size={11} />     },
];

const AIControlPanel: React.FC<AIControlPanelProps> = ({ transactions, accounts, userId, leaks, report }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('stats');

  // PART 7 â€” Only render in development mode
  if (!IS_DEV) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
        <Shield size={40} className="opacity-30" />
        <p className="font-mono text-xs uppercase tracking-[0.08em]">Disponível apenas em modo DEV</p>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'stats':         return <div className="py-3"><SystemStats transactions={transactions} accounts={accounts} userId={userId} /></div>;
      case 'memory':        return <MemoryTab userId={userId} />;
      case 'queue':         return <QueueTab />;
      case 'insights':      return <InsightsTab transactions={transactions} userId={userId} />;
      case 'autopilot':     return <AutopilotTab transactions={transactions} accounts={accounts} />;
      case 'events':        return <EventsTab />;
      case 'logs':          return <AILogsTab />;
      case 'subscriptions': return <SubscriptionsTab transactions={transactions} />;
      case 'leaks':         return <LeaksTab transactions={transactions} leaks={leaks} />;
      case 'report':        return <ReportTab transactions={transactions} report={report} />;
      case 'simulation':    return <SimulationTab transactions={transactions} accounts={accounts} />;
      case 'audit':         return <AuditTab />;
      case 'parser':        return <ParserLabTab />;
      case 'metrics':       return <MetricsViewer />;
      case 'health':        return <FinancialHealthTab transactions={transactions} />;
      case 'goals':         return <SmartGoalsTab transactions={transactions} />;
      case 'timeline':      return <FinancialTimelineTab transactions={transactions} />;
      default:              return null;
    }
  };

  return (
    <div className="flex flex-col gap-0 pb-8">
      {/* Header â€” dark terminal style */}
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
            <span className="font-mono text-xs text-emerald-300 font-medium uppercase tracking-[0.08em]">
              flow.ai.control_panel
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-emerald-400 uppercase tracking-[0.08em]">dev mode</span>
          </div>
        </div>

        {/* Tab bar â€” horizontal scrolling */}
        <div className="flex overflow-x-auto border-b border-slate-700/60 bg-slate-900/50 scrollbar-none">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 shrink-0 font-mono text-xs uppercase tracking-[0.08em] transition-colors border-b-2
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
      <p className="font-mono text-xs text-slate-600 text-center pt-2 uppercase tracking-[0.08em]">
        Flow Finance v0.4.0 · AI Control Panel · {IS_DEV ? 'Development' : 'Production'}
      </p>
    </div>
  );
};

export function formatPanelDateTime(timestamp: string): string {
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return 'Data inválida';
  return dt.toLocaleString('pt-BR');
}

export function formatPanelTime(timestamp: string): string {
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return 'Horário inválido';
  return dt.toLocaleTimeString('pt-BR');
}

export function createDefaultSimulationScenario(type: 'extra_spending' | 'monthly_savings' | 'months'): SimulationScenario {
  if (type === 'months') {
    return { type, months: 3, description: 'uma viagem de fim de semana' };
  }
  return { type, amount: 500, description: 'uma viagem de fim de semana' } as SimulationScenario;
}

export function createParserLabState(format: 'ofx' | 'csv'): { format: string; input: string; result: null; error: null; diagnostic: null } {
  return { format, input: '', result: null, error: null, diagnostic: null };
}

export default AIControlPanel;






