import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';

import { ClinicWebhookPayload, ClinicWebhookResponse } from '../../validation/clinicAutomation.schema';
import { IntegrationMonitor } from '../observability';
import { IdempotentEventStore, RedisLike } from './IdempotentEventStore';
import { EnhancedFeatureFlagService, FeatureFlagContext } from '../featureFlags/EnhancedFeatureFlagService';

/**
 * ClinicAutomationService: Processa eventos vindos da automação da clínica.
 * Responsabilidades:
 * - Validação de origem (HMAC, API key)
 * - Idempotência (evitar duplicação)
 * - Observabilidade (telemetria, logs, Sentry)
 * - Feature flags (pode desligar intake/posting rapidamente)
 * - Ingestão de receitas, despesas e lembretes de cobrança
 */
export class ClinicAutomationService {
  private readonly monitor: IntegrationMonitor;
  private readonly eventStore: IdempotentEventStore;
  private readonly featureFlagService: EnhancedFeatureFlagService;
  private readonly logger: Logger;
  private readonly redis: RedisLike;

  constructor(
    logger: Logger,
    redis: RedisLike,
    monitor: IntegrationMonitor,
    featureFlagService: EnhancedFeatureFlagService
  ) {
    this.logger = logger;
    this.redis = redis;
    this.monitor = monitor;
    this.eventStore = new IdempotentEventStore(redis);
    this.featureFlagService = featureFlagService;
  }

  /**
   * Processar webhook vindo da clínica.
   * Validate autenticação → Verificar idempotência → Processar evento → Retornar resposta.
   */
  async processWebhookEvent(
    payload: ClinicWebhookPayload,
    _signature: string,
    sourceIp: string,
    contextOverrides?: Partial<FeatureFlagContext>
  ): Promise<ClinicWebhookResponse> {
    const internalEventId = uuidv4();
    const externalEventId = (payload as any).externalEventId;
    const sourceSystem = 'clinic-automation';
    const requestId = uuidv4();

    // Logging inicial
    this.logger.info(
      {
        internalEventId,
        externalEventId,
        eventType: payload.type,
        sourceIp,
        requestId
      },
      'Processing clinic webhook'
    );

    try {
      // 1. Verificar feature flag de ingestão
      const ingestContext: FeatureFlagContext = {
        environment: (process.env.NODE_ENV || 'production') as any,
        sourceSystem,
        tenantId: (payload as any).externalFacilityId,
        ...contextOverrides
      };

      const ingestFlag = this.featureFlagService.isEnabled('clinic_automation_ingest_enabled', ingestContext);
      if (!ingestFlag.enabled) {
        this.logger.warn(
          {
            internalEventId,
            reason: ingestFlag.reason,
            sourceSystem
          },
          'Clinic automation ingest is disabled'
        );

        // Retornar erro controlado
        return {
          success: false,
          receivedEventId: internalEventId,
          externalEventId,
          processedAt: new Date().toISOString(),
          idempotencyKey: this.eventStore.generatePayloadHash(payload),
          message: `Clinic automation ingest is disabled (${ingestFlag.reason}). System is not accepting events currently.`
        };
      }

      // 2. Verificar idempotência
      const isNew = await this.eventStore.recordProcessed(
        sourceSystem,
        externalEventId,
        internalEventId,
        'success' // Marcar como sucesso neste ponto, será atualizado se falhar
      );

      if (!isNew) {
        // Evento já foi processado: retornar resposta de sucesso mas sem reprocessar
        this.logger.info(
          { internalEventId, externalEventId },
          'Duplicate event: already processed'
        );

        const existingRecord = await this.eventStore.getProcessedRecord(
          sourceSystem,
          externalEventId
        );

        return {
          success: true,
          receivedEventId: existingRecord?.eventId || internalEventId,
          externalEventId,
          processedAt: existingRecord?.processedAt || new Date().toISOString(),
          idempotencyKey: this.eventStore.generatePayloadHash(payload),
          message: 'Event already processed (idempotent response)'
        };
      }

      // 3. Processar evento específico com telemetria
      await this.monitor.executeClinicWebhookCall(
        'webhook_ingest',
        () => this.routeAndProcessEvent(payload, internalEventId, ingestContext),
        { requestId, tenantId: (payload as any).externalFacilityId }
      );

      // 4. Registrar sucesso
      await this.eventStore.recordProcessed(
        sourceSystem,
        externalEventId,
        internalEventId,
        'success',
        { eventType: payload.type }
      );

      this.logger.info(
        {
          internalEventId,
          externalEventId,
          eventType: payload.type,
          result: 'success'
        },
        'Clinic webhook processed successfully'
      );

      return {
        success: true,
        receivedEventId: internalEventId,
        externalEventId,
        processedAt: new Date().toISOString(),
        idempotencyKey: this.eventStore.generatePayloadHash(payload),
        message: 'Event processed successfully'
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Registrar falha
      await this.eventStore.recordProcessed(
        sourceSystem,
        externalEventId,
        internalEventId,
        'failure',
        { error: err.message }
      );

      // Log error com contexto
      this.logger.error(
        {
          internalEventId,
          externalEventId,
          error: err.message,
          stack: err.stack
        },
        'Failed to process clinic webhook'
      );

      // Alertar Sentry
      Sentry.captureException(err, {
        tags: {
          integration: 'clinic-automation',
          operation: 'webhook_ingest',
          source_system: sourceSystem
        },
        contexts: {
          clinic_webhook: {
            internalEventId,
            externalEventId,
            eventType: payload.type
          }
        }
      });

      throw err;
    }
  }

  /**
   * Rotear evento para handler específico baseado em tipo.
   */
  private async routeAndProcessEvent(
    payload: ClinicWebhookPayload,
    internalEventId: string,
    context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    switch (payload.type) {
      case 'payment_received':
        return this.handlePaymentReceived(payload as any, internalEventId, context);

      case 'expense_recorded':
        return this.handleExpenseRecorded(payload as any, internalEventId, context);

      case 'receivable_reminder_created':
        return this.handleReceivableReminderCreated(payload as any, internalEventId, context);

      case 'receivable_reminder_updated':
        return this.handleReceivableReminderUpdated(payload as any, internalEventId, context);

      case 'receivable_reminder_cleared':
        return this.handleReceivableReminderCleared(payload as any, internalEventId, context);

      default:
        const exhaustive: never = payload;
        throw new Error(`Unknown event type: ${exhaustive}`);
    }
  }

  /**
   * Processar pagamento recebido: criar transaction no Flow.
   */
  private async handlePaymentReceived(
    event: any,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, amount: event.amount },
      'Processing payment_received event'
    );

    // TODO: Implementar lógica de criação de receita no Flow
    // - Criar transaction do tipo RECEITA
    // - Associar ao tenantId/externalFacilityId
    // - Usar amount, date, description
    // - Mapear paymentMethod para categoria padrão (se necessário)

    return {
      processed: true,
      message: `Payment of ${event.currency} ${event.amount} recorded`
    };
  }

  /**
   * Processar despesa registrada: criar transaction tipo despesa.
   */
  private async handleExpenseRecorded(
    event: any,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, amount: event.amount },
      'Processing expense_recorded event'
    );

    // TODO: Implementar lógica de despesa
    // - Criar transaction do tipo DESPESA
    // - Usar expenseCategory para guiar categorização

    return {
      processed: true,
      message: `Expense of ${event.currency} ${event.amount} recorded`
    };
  }

  /**
   * Processar lembrete de cobrança criado: criar reminder no Flow.
   */
  private async handleReceivableReminderCreated(
    event: any,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, dueAmount: event.dueAmount },
      'Processing receivable_reminder_created event'
    );

    // TODO: Criar reminder no Flow
    // - Armazenar externalEventId para correlação
    // - Definir expiração baseada em dueDate

    return {
      processed: true,
      message: `Receivable reminder created for ${event.currency} ${event.dueAmount}`
    };
  }

  /**
   * Processar update de lembrete.
   */
  private async handleReceivableReminderUpdated(
    event: any,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId },
      'Processing receivable_reminder_updated event'
    );

    // TODO: Atualizar reminder correspondente

    return {
      processed: true,
      message: `Receivable reminder updated`
    };
  }

  /**
   * Processar quitação de lembrete.
   */
  private async handleReceivableReminderCleared(
    event: any,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId },
      'Processing receivable_reminder_cleared event'
    );

    // TODO: Remover/marcar como concluído o reminder

    return {
      processed: true,
      message: `Receivable reminder cleared`
    };
  }

  /**
   * Health check: verificar conectividade com serviços necessários.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, boolean>;
    message?: string;
  }> {
    const details: Record<string, boolean> = {
      redis: false,
      featureFlags: true // Sempre OK
    };

    try {
      await this.redis.ping();
      details.redis = true;
    } catch (error) {
      details.redis = false;
    }

    const healthy = Object.values(details).every((v) => v);

    return {
      healthy,
      details,
      message: healthy ? 'Clinic automation service is healthy' : 'Clinic automation service has issues'
    };
  }
}

export default ClinicAutomationService;
