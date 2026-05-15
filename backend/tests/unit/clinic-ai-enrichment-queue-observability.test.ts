import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: loggerMocks,
}));

import { ClinicAIEnrichmentQueue } from '../../src/services/clinic/ClinicAIEnrichmentQueue';

describe('ClinicAIEnrichmentQueue observability', () => {
  let queue: ClinicAIEnrichmentQueue;

  type QueueLike = ClinicAIEnrichmentQueue & {
    enrichWithAI(task: {
      id: string;
      transactionId: string;
      externalEventId: string;
      workspaceId: string;
      description: string;
      amount: number;
      eventType: string;
      createdAt: string;
      retriesRemaining: number;
    }): Promise<unknown>;
  };

  beforeEach(() => {
    loggerMocks.error.mockClear();
    loggerMocks.warn.mockClear();
    loggerMocks.info.mockClear();
    loggerMocks.debug.mockClear();
    queue = new ClinicAIEnrichmentQueue(loggerMocks as never);
  });

  afterEach(() => {
    queue.stop();
  });

  it('registra contexto quando o ciclo da fila falha', async () => {
    (queue as QueueLike).enrichWithAI = vi.fn().mockRejectedValueOnce(new Error('enrichment exploded')) as never;

    queue.enqueue('evt-1', 'workspace-1', 'Descricao', 100, 'payment_received', 'tx-1');

    await vi.waitFor(() => {
      expect(loggerMocks.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          retriesRemaining: 2,
          fallback: 'clinic-ai-enrichment-retry',
        }),
        'ClinicAI enrichment failed, retrying',
      );
    });
  });

  it('gera snapshot heuristico local quando a IA nao esta disponivel', async () => {
    const task = {
      id: 'task-1',
      transactionId: 'tx-1',
      externalEventId: 'evt-1',
      workspaceId: 'workspace-1',
      description: 'Consulta particular e exames',
      amount: 1200,
      eventType: 'payment_received',
      createdAt: new Date().toISOString(),
      retriesRemaining: 3,
    };

    await (queue as QueueLike).enrichWithAI(task);

    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        externalEventId: 'evt-1',
        workspaceId: 'workspace-1',
        suggestedCategory: 'Saúde',
        amountBand: 'high',
        riskLevel: 'high',
        fallback: 'clinic-ai-enrichment-local-heuristic',
      }),
      'ClinicAI enrichment fallback heuristic applied',
    );

    expect(queue.getEnrichmentSnapshot('task-1')).toMatchObject({
      taskId: 'task-1',
      transactionId: 'tx-1',
      externalEventId: 'evt-1',
      workspaceId: 'workspace-1',
      suggestedCategory: 'Saúde',
      amountBand: 'high',
      riskLevel: 'high',
    });
  });
});
