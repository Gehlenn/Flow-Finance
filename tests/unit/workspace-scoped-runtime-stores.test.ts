import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_WORKSPACE_STORAGE_KEY } from '../../src/config/api.config';
import { logAIDebug, getAIDebugLogs, clearAIDebugLogs } from '../../src/ai/aiDebugService';
import { clearFinancialEvents, emitFinancialEvent, getFinancialEvents } from '../../src/events/eventEngine';
import { aiMemoryStore } from '../../src/ai/memory/AIMemoryStore';
import { AIMemoryType } from '../../src/ai/memory/memoryTypes';
import { taskStore } from '../../src/ai/queue/taskStore';
import { AITaskPriority, AITaskStatus, AITaskType } from '../../src/ai/queue/taskTypes';

function setWorkspace(workspaceId: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

describe('workspace-scoped runtime stores', () => {
  beforeEach(() => {
    localStorage.clear();
    setWorkspace('ws_default');
    clearAIDebugLogs();
    clearFinancialEvents();
    aiMemoryStore.clear();
    taskStore.clear();
  });

  it('isolates AI debug logs and financial events by active workspace', () => {
    setWorkspace('ws_alpha');
    logAIDebug({ input: 'pizza 42', predicted_category: 'Alimentacao' });
    emitFinancialEvent({ type: 'transaction_created', payload: { description: 'Pizza' } });

    setWorkspace('ws_beta');
    expect(getAIDebugLogs()).toHaveLength(0);
    expect(getFinancialEvents()).toHaveLength(0);

    logAIDebug({ input: 'uber 18', predicted_category: 'Transporte' });
    emitFinancialEvent({ type: 'transaction_created', payload: { description: 'Uber' } });

    expect(getAIDebugLogs()).toHaveLength(1);
    expect(getFinancialEvents()).toHaveLength(1);

    setWorkspace('ws_alpha');
    expect(getAIDebugLogs()).toHaveLength(1);
    expect(getAIDebugLogs()[0].input).toBe('pizza 42');
    expect(getFinancialEvents()).toHaveLength(1);
    expect((getFinancialEvents()[0].payload as { description?: string }).description).toBe('Pizza');
  });

  it('reloads singleton AI memory and task stores when the workspace changes', () => {
    setWorkspace('ws_alpha');
    aiMemoryStore.save({
      type: AIMemoryType.SPENDING_PATTERN,
      value: 'weekend_spending',
      userId: 'user_1',
      key: 'weekend_spending',
    });
    taskStore.addTask({
      id: 'task_alpha',
      userId: 'user_1',
      type: AITaskType.INSIGHT_GENERATION,
      status: AITaskStatus.PENDING,
      priority: AITaskPriority.NORMAL,
      createdAt: Date.now(),
      payload: { prompt: 'alpha' },
      retryCount: 0,
      maxRetries: 2,
    });

    expect(aiMemoryStore.getMemoriesByUser('user_1')).toHaveLength(1);
    expect(taskStore.getTasksByUser('user_1')).toHaveLength(1);

    setWorkspace('ws_beta');
    expect(aiMemoryStore.getMemoriesByUser('user_1')).toHaveLength(0);
    expect(taskStore.getTasksByUser('user_1')).toHaveLength(0);

    aiMemoryStore.save({
      type: AIMemoryType.MERCHANT_CATEGORY,
      value: 'mercado',
      userId: 'user_1',
      key: 'merchant',
    });
    taskStore.addTask({
      id: 'task_beta',
      userId: 'user_1',
      type: AITaskType.FINANCIAL_REPORT,
      status: AITaskStatus.PENDING,
      priority: AITaskPriority.HIGH,
      createdAt: Date.now(),
      payload: { prompt: 'beta' },
      retryCount: 0,
      maxRetries: 2,
    });

    expect(aiMemoryStore.getMemoriesByUser('user_1')).toHaveLength(1);
    expect(taskStore.getTasksByUser('user_1')).toHaveLength(1);

    setWorkspace('ws_alpha');
    expect(aiMemoryStore.getMemoriesByUser('user_1')).toHaveLength(1);
    expect(aiMemoryStore.getMemoriesByUser('user_1')[0].key).toBe('weekend_spending');
    expect(taskStore.getTasksByUser('user_1')).toHaveLength(1);
    expect(taskStore.getTasksByUser('user_1')[0].id).toBe('task_alpha');
  });
});
