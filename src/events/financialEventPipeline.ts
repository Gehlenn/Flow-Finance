import { eventBus } from './EventBus';
import { TransactionCreatedEvent, TRANSACTION_CREATED_EVENT } from './financialEvents/TransactionCreated';
import { AITaskType, aiTaskQueue } from '../ai/queue';
import { FinancialAutopilot } from '../engines/autopilot/financialAutopilot';
import { recordDuration, recordMetric } from '../observability';

let initialized = false;

export function initializeFinancialEventPipeline(): void {
  if (initialized) {
    return;
  }

  const autopilot = new FinancialAutopilot();

  eventBus.on<TransactionCreatedEvent>(TRANSACTION_CREATED_EVENT, async (payload) => {
    const start = Date.now();

    try {
      const transaction = payload.transaction;
      const monthlyIncome = transaction.type === 'income' ? transaction.amount : 0;
      const monthlyExpenses = transaction.type === 'expense' ? transaction.amount : 0;

      const alerts = autopilot.analyze({
        monthlyIncome,
        monthlyExpenses,
        currentBalance: monthlyIncome - monthlyExpenses,
      });

      recordMetric('autopilot.alerts.count', alerts.length);

      if (!aiTaskQueue.isInitialized()) {
        aiTaskQueue.initialize();
      }

      aiTaskQueue.enqueueTask(
        AITaskType.INSIGHT_GENERATION,
        {
          trigger: TRANSACTION_CREATED_EVENT,
          transaction,
          alerts,
        },
        payload.userId
      );

      const stats = aiTaskQueue.getQueueStats();
      recordMetric('ai.queue.pending', stats.pending);
      recordMetric('ai.queue.processing', stats.processing);
      recordMetric('ai.queue.completed', stats.completed);
    } finally {
      recordDuration('event.transaction_created.total_ms', start);
    }
  });

  initialized = true;
}
