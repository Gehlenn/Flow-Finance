/**
 * AI QUEUE LISTENER
 *
 * Observa eventos financeiros e encaminha tarefas relevantes
 * para o AITaskQueue (análise de insights, riscos, recorrências).
 */

import { subscribeToFinancialEvents } from '../eventEngine';
import { aiTaskQueue } from '../../ai/queue/AITaskQueue';
import { AITaskType } from '../../ai/queue/taskTypes';
import type { FinancialEvent } from '../../../models/FinancialEvent';

type EventToTask = {
  eventType: FinancialEvent['type'];
  taskType: AITaskType;
};

const EVENT_TO_TASK_MAP: EventToTask[] = [
  { eventType: 'transaction_created',      taskType: AITaskType.INSIGHT_GENERATION },
  { eventType: 'transactions_imported',    taskType: AITaskType.INSIGHT_GENERATION },
  { eventType: 'bank_transactions_synced', taskType: AITaskType.RISK_ANALYSIS },
  { eventType: 'risk_detected',            taskType: AITaskType.RISK_ANALYSIS },
  { eventType: 'recurring_generated',      taskType: AITaskType.SUBSCRIPTION_DETECTION },
];

export function registerAIQueueListener(): () => void {
  return subscribeToFinancialEvents((event) => {
    for (const { eventType, taskType } of EVENT_TO_TASK_MAP) {
      if (event.type !== eventType) continue;

      try {
        aiTaskQueue.enqueueTask(taskType, event.payload, 'event-listener');
        console.debug(`[AIQueueListener] Tarefa ${taskType} enfileirada via evento "${event.type}"`);
      } catch {
        // AITaskQueue pode não estar inicializado em testes — ignora silenciosamente
      }
      break;
    }
  });
}
