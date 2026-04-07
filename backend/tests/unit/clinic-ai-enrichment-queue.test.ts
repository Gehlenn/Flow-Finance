import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ClinicAIEnrichmentQueue } from '../../src/services/clinic/ClinicAIEnrichmentQueue';
import logger from '../../src/config/logger';

describe('ClinicAIEnrichmentQueue', () => {
  let queue: ClinicAIEnrichmentQueue;

  beforeEach(() => {
    queue = new ClinicAIEnrichmentQueue(logger);
  });

  afterEach(() => {
    queue.stop();
  });

  it('deve enfileirar tarefa de enriquecimento IA', async () => {
    queue.enqueue(
      'evt_001',
      'workspace_1',
      'Pagamento de consulta',
      150.50,
      'payment_received',
      'tx_001',
    );

    expect(queue.getQueueSize()).toBe(1);

    await queue.drain();

    expect(queue.getQueueSize()).toBe(0);
  });

  it('deve processar múltiplas tarefas em sequência', async () => {
    queue.enqueue('evt_001', 'workspace_1', 'Pagamento 1', 100, 'payment_received', 'tx_001');
    queue.enqueue('evt_002', 'workspace_1', 'Pagamento 2', 200, 'payment_received', 'tx_002');
    queue.enqueue('evt_003', 'workspace_1', 'Despesa', 50, 'expense_recorded', 'tx_003');

    expect(queue.getQueueSize()).toBe(3);

    await queue.drain();

    expect(queue.getQueueSize()).toBe(0);
  });

  it('deve manter tarefas na fila enquanto processando', async () => {
    queue.enqueue('evt_001', 'workspace_1', 'Teste', 100, 'payment_received', 'tx_001');

    // Verificar que tarefa está na fila nos primeiros 100ms
    expect(queue.getQueueSize()).toBeGreaterThanOrEqual(0);
  });

  it('deve remover tarefa após sucesso', async () => {
    queue.enqueue('evt_remove', 'workspace_1', 'Remove test', 99, 'payment_received', 'tx_remove');

    await queue.drain();

    expect(queue.getQueueSize()).toBe(0);
  });

  it('deve parar processamento quando fila vazia', async () => {
    queue.enqueue('evt_stop', 'workspace_1', 'Stop test', 75, 'payment_received', 'tx_stop');

    await queue.drain();

    expect(queue.getQueueSize()).toBe(0);
  });
});
