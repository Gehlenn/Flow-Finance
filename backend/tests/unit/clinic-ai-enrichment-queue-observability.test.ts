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

  beforeEach(() => {
    loggerMocks.error.mockClear();
    loggerMocks.warn.mockClear();
    loggerMocks.info.mockClear();
    loggerMocks.debug.mockClear();
    queue = new ClinicAIEnrichmentQueue(loggerMocks as any);
  });

  afterEach(() => {
    queue.stop();
  });

  it('registra contexto quando o ciclo da fila falha', async () => {
    (queue as any).enrichWithAI = vi.fn().mockRejectedValueOnce(new Error('enrichment exploded'));

    queue.enqueue('evt-1', 'workspace-1', 'Descricao', 100, 'payment_received', 'tx-1');

    await vi.waitFor(() => {
      expect(loggerMocks.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          queueSize: 1,
          processingIntervalActive: true,
          fallback: 'clinic-ai-enrichment-cycle-failed',
        }),
        'Error processing clinic AI enrichment queue',
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

    await (queue as any).enrichWithAI(task);

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
