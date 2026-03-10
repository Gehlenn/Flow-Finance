/**
 * AI Task Queue Monitor
 * Development component for monitoring task execution
 */

import React, { useEffect, useState } from 'react';
import {
  aiTaskQueue,
  taskStore,
  AITask,
  AITaskStatus,
  AITaskType,
  AITaskPriority,
  AITaskProgress,
  AITaskResult,
} from '../../src/ai/queue';

interface TaskQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const AITaskQueueMonitor: React.FC = () => {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [stats, setStats] = useState<TaskQueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastProgress, setLastProgress] = useState<AITaskProgress | null>(null);
  const [lastResult, setLastResult] = useState<AITaskResult | null>(null);

  useEffect(() => {
    const updateTasks = () => {
      setTasks(taskStore.getAllTasks().slice(0, 20)); // Last 20 tasks
      setStats(aiTaskQueue.getQueueStats());
    };

    updateTasks();
    const interval = setInterval(updateTasks, 2000);

    // Listen to task events
    const handleProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail as AITaskProgress;
      setLastProgress(detail);
    };

    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail as AITaskResult;
      setLastResult(detail);
      updateTasks();
    };

    const handleEnqueued = () => {
      updateTasks();
    };

    window.addEventListener('ai-task-progress', handleProgress);
    window.addEventListener('ai-task-result', handleResult);
    window.addEventListener('ai-task-enqueued', handleEnqueued);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ai-task-progress', handleProgress);
      window.removeEventListener('ai-task-result', handleResult);
      window.removeEventListener('ai-task-enqueued', handleEnqueued);
    };
  }, []);

  const getStatusColor = (status: AITaskStatus): string => {
    switch (status) {
      case AITaskStatus.PENDING:
        return 'bg-yellow-500';
      case AITaskStatus.PROCESSING:
        return 'bg-blue-500 animate-pulse';
      case AITaskStatus.COMPLETED:
        return 'bg-green-500';
      case AITaskStatus.FAILED:
        return 'bg-red-500';
      case AITaskStatus.CANCELLED:
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getPriorityLabel = (priority: AITaskPriority): string => {
    switch (priority) {
      case AITaskPriority.URGENT:
        return '🔴 Urgente';
      case AITaskPriority.HIGH:
        return '🟠 Alta';
      case AITaskPriority.NORMAL:
        return '🟡 Normal';
      case AITaskPriority.LOW:
        return '🟢 Baixa';
      default:
        return '⚪ Desconhecida';
    }
  };

  const getTaskTypeLabel = (type: AITaskType): string => {
    const labels: Record<AITaskType, string> = {
      [AITaskType.INSIGHT_GENERATION]: '💡 Insights',
      [AITaskType.CASHFLOW_SIMULATION]: '💰 Fluxo de Caixa',
      [AITaskType.FINANCIAL_REPORT]: '📊 Relatório',
      [AITaskType.LEAK_DETECTION]: '🔍 Vazamentos',
      [AITaskType.AUTOPILOT_ANALYSIS]: '✈️ Autopilot',
      [AITaskType.RISK_ANALYSIS]: '⚠️ Riscos',
      [AITaskType.SUBSCRIPTION_DETECTION]: '🔄 Assinaturas',
      [AITaskType.SALARY_DETECTION]: '💼 Salário',
      [AITaskType.FIXED_EXPENSE_DETECTION]: '📌 Despesas Fixas',
    };
    return labels[type] || type;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const clearCompleted = () => {
    taskStore.clearCompletedTasks();
    setTasks(taskStore.getAllTasks().slice(0, 20));
    setStats(aiTaskQueue.getQueueStats());
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <span className="text-xl">🤖</span>
          <div className="text-left">
            <div className="text-xs font-semibold">AI Task Queue</div>
            <div className="text-xs opacity-90">
              {stats.pending}⏳ {stats.processing}⚙️ {stats.completed}✅ {stats.failed}❌
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white rounded-lg shadow-2xl w-96 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h3 className="font-bold text-sm">AI Task Queue Monitor</h3>
            <div className="text-xs opacity-90">
              {stats.pending} Pendentes • {stats.processing} Processando
            </div>
          </div>
        </div>
        <button onClick={() => setIsExpanded(false)} className="text-white hover:bg-white/20 rounded p-1">
          ✕
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-gray-800 text-center text-xs">
        <div>
          <div className="text-yellow-400 font-bold">{stats.pending}</div>
          <div className="text-gray-400">Pendentes</div>
        </div>
        <div>
          <div className="text-blue-400 font-bold">{stats.processing}</div>
          <div className="text-gray-400">Processando</div>
        </div>
        <div>
          <div className="text-green-400 font-bold">{stats.completed}</div>
          <div className="text-gray-400">Concluídas</div>
        </div>
        <div>
          <div className="text-red-400 font-bold">{stats.failed}</div>
          <div className="text-gray-400">Falhas</div>
        </div>
      </div>

      {/* Progress indicator */}
      {lastProgress && lastProgress.status === AITaskStatus.PROCESSING && (
        <div className="px-3 py-2 bg-blue-900/50 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span>🔄 {lastProgress.message}</span>
            {lastProgress.progress !== undefined && <span>{lastProgress.progress}%</span>}
          </div>
          {lastProgress.progress !== undefined && (
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${lastProgress.progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Latest result */}
      {lastResult && (
        <div
          className={`px-3 py-2 text-xs ${
            lastResult.success ? 'bg-green-900/50' : 'bg-red-900/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{lastResult.success ? '✅ Concluído' : '❌ Falhou'}</span>
            <span>{formatTime(lastResult.executionTime)}</span>
          </div>
          {!lastResult.success && lastResult.error && (
            <div className="text-red-300 mt-1">{lastResult.error}</div>
          )}
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">Nenhuma tarefa</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-gray-800 rounded p-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                  <span className="font-medium">{getTaskTypeLabel(task.type)}</span>
                </div>
                <span className="text-gray-400">{getPriorityLabel(task.priority)}</span>
              </div>
              <div className="text-gray-400 flex items-center justify-between">
                <span>#{task.id.slice(0, 8)}</span>
                {task.completedAt && (
                  <span>{formatTime(task.completedAt - task.createdAt)}</span>
                )}
                {task.retryCount > 0 && (
                  <span className="text-yellow-400">↻ {task.retryCount}</span>
                )}
              </div>
              {task.error && (
                <div className="text-red-400 mt-1 text-[10px]">{task.error.message}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-700 p-2 flex gap-2">
        <button
          onClick={clearCompleted}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs py-1 px-2 rounded"
        >
          Limpar Concluídas
        </button>
      </div>
    </div>
  );
};

export default AITaskQueueMonitor;
