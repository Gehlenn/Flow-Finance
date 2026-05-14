import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';

export interface ClinicAIEnrichmentTask {
  id: string;
  transactionId: string;
  externalEventId: string;
  workspaceId: string;
  description: string;
  amount: number;
  eventType: string;
  createdAt: string;
  retriesRemaining: number;
}

export interface ClinicAIEnrichmentSnapshot {
  taskId: string;
  transactionId: string;
  externalEventId: string;
  workspaceId: string;
  amountBand: 'low' | 'medium' | 'high';
  suggestedCategory: string;
  riskLevel: 'low' | 'medium' | 'high';
  notes: string[];
  createdAt: string;
}

/**
 * ClinicAIEnrichmentQueue: Processa eventos da clínica através de IA para enriquecimento.
 * 
 * Características:
 * - Fire-and-forget: a fila é processada assincronamente
 * - Fallback automático: falha da IA não bloqueia a persistência do evento
 * - Retries exponenciais: até 3 tentativas com backoff
 * - Logging estruturado: rastreamento de sucesso/falha
 */
export class ClinicAIEnrichmentQueue {
  private readonly queue: ClinicAIEnrichmentTask[] = [];
  private readonly enrichmentSnapshots = new Map<string, ClinicAIEnrichmentSnapshot>();
  private readonly logger: Logger;
  private readonly maxRetries: number = 3;
  private readonly processingIntervalMs: number = 5000; // 5 segundos
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Enfileirar tarefa de enriquecimento IA.
   * Não bloqueia a resposta da requisição HTTP.
   */
  enqueue(
    externalEventId: string,
    workspaceId: string,
    description: string,
    amount: number,
    eventType: string,
    transactionId: string,
  ): void {
    const task: ClinicAIEnrichmentTask = {
      id: uuidv4(),
      transactionId,
      externalEventId,
      workspaceId,
      description,
      amount,
      eventType,
      createdAt: new Date().toISOString(),
      retriesRemaining: this.maxRetries,
    };

    this.queue.push(task);
    this.logger.debug(
      { taskId: task.id, externalEventId },
      'ClinicAI enrichment task enqueued',
    );

    // Iniciar processamento se ainda não está ativo
    if (!this.processingInterval) {
      this.startProcessing();
    }
  }

  /**
   * Processar fila de enriquecimento.
   * Executa de forma assíncrona sem bloquear.
   */
  private startProcessing(): void {
    // Dispara um ciclo imediato para evitar atraso inicial de 5s no primeiro item.
    this.runProcessingCycle();

    this.processingInterval = setInterval(() => {
      this.runProcessingCycle();
    }, this.processingIntervalMs);
  }

  private runProcessingCycle(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processAvailableTasks()
      .catch((error) => {
        this.logger.error(
          {
            error,
            queueSize: this.queue.length,
            processingIntervalActive: !!this.processingInterval,
            fallback: 'clinic-ai-enrichment-cycle-failed',
          },
          'Error processing clinic AI enrichment queue',
        );
      })
      .finally(() => {
        this.isProcessing = false;
      });
  }

  private async processAvailableTasks(): Promise<void> {
    while (this.queue.length > 0) {
      const shouldContinue = await this.processNextTask();
      if (!shouldContinue) {
        break;
      }
    }

    if (this.queue.length === 0 && this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Processar próxima tarefa na fila.
   */
  private async processNextTask(): Promise<boolean> {
    if (this.queue.length === 0) {
      return false;
    }

    const task = this.queue[0];

    try {
      await this.enrichWithAI(task);
      this.queue.shift(); // Remove tarefa processada com sucesso

      this.logger.info(
        { taskId: task.id, externalEventId: task.externalEventId },
        'ClinicAI enrichment completed',
      );

      return true;
    } catch (error) {
      task.retriesRemaining--;

      if (task.retriesRemaining > 0) {
        this.logger.warn(
          {
            taskId: task.id,
            externalEventId: task.externalEventId,
            retriesRemaining: task.retriesRemaining,
            error,
            fallback: 'clinic-ai-enrichment-retry',
          },
          'ClinicAI enrichment failed, retrying',
        );
        // Deixar na fila para próxima tentativa em um ciclo futuro.
        return false;
      } else {
        this.queue.shift(); // Remove após exaurir retries

        this.logger.error(
          {
            taskId: task.id,
            externalEventId: task.externalEventId,
            error,
            fallback: 'clinic-ai-enrichment-max-retries-exhausted',
          },
          'ClinicAI enrichment failed after max retries',
        );

        // Reportar a Sentry mas não bloquear
        Sentry.captureException(error, {
          tags: {
            feature: 'clinic-ai-enrichment',
            status: 'failed-after-retries',
          },
          contexts: {
            task: {
              taskId: task.id,
              externalEventId: task.externalEventId,
              workspaceId: task.workspaceId,
            },
          },
        });

        return true;
      }
    }
  }

  /**
   * Placeholder: Enrich event with AI.
   * TODO(#ai-enrichment): Integrate with real IA service (Gemini/OpenAI)
   * Current: deterministic local heuristic fallback with observability.
   */
  private async enrichWithAI(task: ClinicAIEnrichmentTask): Promise<void> {
    const normalizedDescription = task.description.toLowerCase().trim();
    const amount = Math.abs(task.amount);
    const amountBand: ClinicAIEnrichmentSnapshot['amountBand'] =
      amount >= 1000 ? 'high' : amount >= 250 ? 'medium' : 'low';

    let suggestedCategory = 'Clínica';
    const notes: string[] = [];

    if (/(consulta|doctor|medic|saude|health|clinic)/i.test(normalizedDescription)) {
      suggestedCategory = 'Saúde';
      notes.push('Descrição associada a atendimento clínico.');
    } else if (/(laborat|exame|test|análise|analise)/i.test(normalizedDescription)) {
      suggestedCategory = 'Exames';
      notes.push('Descrição associada a exames ou laboratório.');
    } else if (/(pagamento|received|payment|receipt|invoice|fatura)/i.test(normalizedDescription)) {
      suggestedCategory = 'Recebimento';
      notes.push('Fluxo financeiro descrito como recebimento/pagamento.');
    }

    if (amountBand === 'high') {
      notes.push('Valor alto para acompanhamento prioritário.');
    } else if (amountBand === 'medium') {
      notes.push('Valor intermediário; revisar alinhamento com histórico.');
    } else {
      notes.push('Valor baixo; manter monitoramento de rotina.');
    }

    const riskLevel: ClinicAIEnrichmentSnapshot['riskLevel'] =
      amountBand === 'high' ? 'high' : amountBand === 'medium' ? 'medium' : 'low';

    const snapshot: ClinicAIEnrichmentSnapshot = {
      taskId: task.id,
      transactionId: task.transactionId,
      externalEventId: task.externalEventId,
      workspaceId: task.workspaceId,
      amountBand,
      suggestedCategory,
      riskLevel,
      notes,
      createdAt: new Date().toISOString(),
    };

    this.enrichmentSnapshots.set(task.id, snapshot);
    this.logger.info(
      {
        taskId: task.id,
        externalEventId: task.externalEventId,
        workspaceId: task.workspaceId,
        suggestedCategory,
        amountBand,
        riskLevel,
        notes,
        fallback: 'clinic-ai-enrichment-local-heuristic',
      },
      'ClinicAI enrichment fallback heuristic applied',
    );
  }

  /**
   * Obter tamanho da fila (para monitoramento).
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Retorna o último snapshot heurístico gerado para uma tarefa.
   */
  getEnrichmentSnapshot(taskId: string): ClinicAIEnrichmentSnapshot | undefined {
    const snapshot = this.enrichmentSnapshots.get(taskId);
    return snapshot ? { ...snapshot, notes: [...snapshot.notes] } : undefined;
  }

  /**
   * Aguardar conclusão de todas as tarefas (útil para testes).
   */
  async drain(): Promise<void> {
    while (this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Parar processamento (útil para desligamento gracioso).
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export function createClinicAIEnrichmentQueue(logger: Logger): ClinicAIEnrichmentQueue {
  return new ClinicAIEnrichmentQueue(logger);
}
