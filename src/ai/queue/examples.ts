/**
 * AI Queue Integration Examples
 * Demonstrates how to use the AI Task Queue in different scenarios
 */

import { aiTaskQueue, AITaskType, AITaskPriority } from './index';
import { Transaction, Account } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 1: Basic usage in a React component
// ─────────────────────────────────────────────────────────────────────────────

export function useInsightGeneration(userId: string, accounts: Account[], transactions: Transaction[]) {
  const [insights, setInsights] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const generateInsights = () => {
    setLoading(true);

    // Enqueue task
    const taskId = aiTaskQueue.enqueueInsightGeneration(userId, accounts, transactions);

    // Listen for result
    const handleResult = (e: CustomEvent) => {
      if (e.detail.taskId === taskId) {
        if (e.detail.success) {
          setInsights(e.detail.data);
        } else {
          console.error('Failed:', e.detail.error);
        }
        setLoading(false);
        window.removeEventListener('ai-task-result', handleResult as EventListener);
      }
    };

    window.addEventListener('ai-task-result', handleResult as EventListener);

    // Cleanup timeout
    setTimeout(() => {
      const task = aiTaskQueue.getTask(taskId);
      if (task?.status === 'completed') {
        setInsights(task.result);
      }
      setLoading(false);
    }, 30000);
  };

  return { insights, loading, generateInsights };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 2: Orchestrator integration with queue
// ─────────────────────────────────────────────────────────────────────────────

export async function runAIOrchestratorWithQueue(
  userId: string,
  accounts: Account[],
  transactions: Transaction[]
): Promise<string[]> {
  const taskIds: string[] = [];

  // Enqueue all AI tasks with different priorities
  taskIds.push(
    aiTaskQueue.enqueueTask(
      AITaskType.INSIGHT_GENERATION,
      { accounts, transactions },
      userId,
      { priority: AITaskPriority.HIGH }
    )
  );

  taskIds.push(
    aiTaskQueue.enqueueTask(
      AITaskType.LEAK_DETECTION,
      { transactions },
      userId,
      { priority: AITaskPriority.HIGH }
    )
  );

  taskIds.push(
    aiTaskQueue.enqueueTask(
      AITaskType.RISK_ANALYSIS,
      { accounts, transactions },
      userId,
      { priority: AITaskPriority.NORMAL }
    )
  );

  taskIds.push(
    aiTaskQueue.enqueueTask(
      AITaskType.CASHFLOW_SIMULATION,
      { accounts, transactions, horizon: 90 },
      userId,
      { priority: AITaskPriority.LOW }
    )
  );

  return taskIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 3: Wait for task completion with timeout
// ─────────────────────────────────────────────────────────────────────────────

export async function waitForTask(taskId: string, timeoutMs: number = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Listen for result event
    const handleResult = (e: CustomEvent) => {
      if (e.detail.taskId === taskId) {
        window.removeEventListener('ai-task-result', handleResult as EventListener);
        clearInterval(pollInterval);

        if (e.detail.success) {
          resolve(e.detail.data);
        } else {
          reject(new Error(e.detail.error));
        }
      }
    };

    window.addEventListener('ai-task-result', handleResult as EventListener);

    // Poll task status as fallback
    const pollInterval = setInterval(() => {
      const task = aiTaskQueue.getTask(taskId);
      
      if (!task) {
        clearInterval(pollInterval);
        reject(new Error('Task not found'));
        return;
      }

      if (task.status === 'completed') {
        clearInterval(pollInterval);
        window.removeEventListener('ai-task-result', handleResult as EventListener);
        resolve(task.result);
      } else if (task.status === 'failed') {
        clearInterval(pollInterval);
        window.removeEventListener('ai-task-result', handleResult as EventListener);
        reject(new Error(task.error?.message || 'Task failed'));
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(pollInterval);
        window.removeEventListener('ai-task-result', handleResult as EventListener);
        reject(new Error('Task timeout'));
      }
    }, 1000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 4: Batch processing with progress tracking
// ─────────────────────────────────────────────────────────────────────────────

export async function runBatchAnalysis(
  userId: string,
  accounts: Account[],
  transactions: Transaction[],
  onProgress?: (completed: number, total: number, message: string) => void
): Promise<any> {
  const tasks = [
    { type: AITaskType.INSIGHT_GENERATION, priority: AITaskPriority.HIGH },
    { type: AITaskType.LEAK_DETECTION, priority: AITaskPriority.HIGH },
    { type: AITaskType.RISK_ANALYSIS, priority: AITaskPriority.NORMAL },
    { type: AITaskType.SUBSCRIPTION_DETECTION, priority: AITaskPriority.NORMAL },
    { type: AITaskType.CASHFLOW_SIMULATION, priority: AITaskPriority.LOW },
  ];

  const taskIds = tasks.map(({ type, priority }) =>
    aiTaskQueue.enqueueTask(
      type,
      { accounts, transactions },
      userId,
      { priority }
    )
  );

  const results: Record<string, any> = {};
  let completed = 0;

  // Track progress
  const handleResult = (e: CustomEvent) => {
    const { taskId, success, data } = e.detail;
    
    if (taskIds.includes(taskId)) {
      if (success) {
        results[taskId] = data;
      }
      completed++;
      onProgress?.(completed, tasks.length, `Completed ${completed}/${tasks.length} tasks`);

      if (completed === tasks.length) {
        window.removeEventListener('ai-task-result', handleResult as EventListener);
      }
    }
  };

  window.addEventListener('ai-task-result', handleResult as EventListener);

  // Wait for all tasks
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (completed === tasks.length) {
        clearInterval(check);
        resolve(results);
      }
    }, 500);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(check);
      resolve(results);
    }, 120000);
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 5: Priority queue demonstration
// ─────────────────────────────────────────────────────────────────────────────

export function demonstratePriorityQueue(
  userId: string,
  accounts: Account[],
  transactions: Transaction[]
) {
  // Low priority - background simulation
  aiTaskQueue.enqueueTask(
    AITaskType.CASHFLOW_SIMULATION,
    { accounts, transactions, horizon: 90 },
    userId,
    { priority: AITaskPriority.LOW }
  );

  // Normal priority - standard insights
  aiTaskQueue.enqueueTask(
    AITaskType.INSIGHT_GENERATION,
    { accounts, transactions },
    userId,
    { priority: AITaskPriority.NORMAL }
  );

  // High priority - risk detection
  aiTaskQueue.enqueueTask(
    AITaskType.RISK_ANALYSIS,
    { accounts, transactions },
    userId,
    { priority: AITaskPriority.HIGH }
  );

  // Urgent priority - immediate leak detection
  aiTaskQueue.enqueueTask(
    AITaskType.LEAK_DETECTION,
    { transactions },
    userId,
    { priority: AITaskPriority.URGENT }
  );

  // Worker will process in order: URGENT > HIGH > NORMAL > LOW
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE 6: React hook for task queue monitoring
// ─────────────────────────────────────────────────────────────────────────────

export function useTaskQueue(userId: string) {
  const [stats, setStats] = React.useState(() => aiTaskQueue.getQueueStats());
  const [userTasks, setUserTasks] = React.useState(() => aiTaskQueue.getUserTasks(userId));

  React.useEffect(() => {
    const updateStats = () => {
      setStats(aiTaskQueue.getQueueStats());
      setUserTasks(aiTaskQueue.getUserTasks(userId));
    };

    const interval = setInterval(updateStats, 2000);

    const handleEnqueued = () => updateStats();
    const handleResult = () => updateStats();

    window.addEventListener('ai-task-enqueued', handleEnqueued as EventListener);
    window.addEventListener('ai-task-result', handleResult as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('ai-task-enqueued', handleEnqueued as EventListener);
      window.removeEventListener('ai-task-result', handleResult as EventListener);
    };
  }, [userId]);

  return { stats, userTasks };
}
