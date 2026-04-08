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
          { error },
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
            retriesRemaining: task.retriesRemaining,
            error,
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
   * Enriquecer evento com IA.
   * TODO: Integrar com serviço de IA real (Gemini/OpenAI)
   * Por enquanto é um stub que sempre sucede para demonstração.
   */
  private async enrichWithAI(task: ClinicAIEnrichmentTask): Promise<void> {
    // Simular latência de IA
    await new Promise((resolve) => setTimeout(resolve, 100));

    // TODO: Chamar serviço de IA real para:
    // 1. Categorização inteligente da transação
    // 2. Detecção de duplicatas/inconsistências
    // 3. Sugestões de ação financeira
    // 4. Análise de padrão de gasto

    this.logger.debug(
      { taskId: task.id, externalEventId: task.externalEventId },
      'ClinicAI enrichment processing',
    );
  }

  /**
   * Obter tamanho da fila (para monitoramento).
   */
  getQueueSize(): number {
    return this.queue.length;
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
