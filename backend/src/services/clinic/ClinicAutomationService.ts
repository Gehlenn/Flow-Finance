import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';

import {
  ClinicWebhookPayload,
  ClinicWebhookResponse,
  PaymentReceivedEvent as ClinicPaymentReceivedEvent,
  ExpenseRecordedEvent as ClinicExpenseRecordedEvent,
  ReceivableReminderCreatedEvent as ClinicReceivableReminderCreatedEvent,
  ReceivableReminderUpdatedEvent as ClinicReceivableReminderUpdatedEvent,
  ReceivableReminderClearedEvent as ClinicReceivableReminderClearedEvent,
} from '../../validation/clinicAutomation.schema';
import { IntegrationMonitor } from '../observability';
import { IdempotentEventStore, RedisLike } from './IdempotentEventStore';
import { EnhancedFeatureFlagService, FeatureFlagContext } from '../featureFlags/EnhancedFeatureFlagService';
import { processExternalIntegrationEvent } from '../externalIntegrationService';
import type {
  ExternalIntegrationEvent,
  PaymentReceivedEvent,
  ExpenseRecordedEvent,
  ReceivableReminderCreatedEvent,
  ReceivableReminderUpdatedEvent,
  ReceivableReminderClearedEvent,
} from '../../types/externalIntegration';
import { getRequestContextValue } from '../../middleware/requestContextStore';

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
    const requestId = getRequestContextValue('requestId') || uuidv4();

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

      const autoPostFlag = this.featureFlagService.isEnabled('clinic_automation_auto_post_enabled', ingestContext);
      if (!autoPostFlag.enabled) {
        this.logger.warn(
          {
            internalEventId,
            reason: autoPostFlag.reason,
            sourceSystem,
          },
          'Clinic automation auto-post is disabled'
        );

        return {
          success: false,
          receivedEventId: internalEventId,
          externalEventId,
          processedAt: new Date().toISOString(),
          idempotencyKey: this.eventStore.generatePayloadHash(payload),
          message: `Clinic automation auto-post is disabled (${autoPostFlag.reason}). Flow persistence is blocked currently.`,
        };
      }

      // 2. Verificar idempotência sem marcar sucesso antecipadamente.
      const existingRecord = await this.eventStore.getProcessedRecord(sourceSystem, externalEventId);
      if (existingRecord?.result === 'success') {
        this.logger.info(
          { internalEventId, externalEventId },
          'Duplicate event: already processed'
        );

        return {
          success: true,
          receivedEventId: existingRecord.eventId || internalEventId,
          externalEventId,
          processedAt: existingRecord.processedAt || new Date().toISOString(),
          idempotencyKey: this.eventStore.generatePayloadHash(payload),
          message: 'Event already processed (idempotent response)'
        };
      }

      if (existingRecord?.result === 'failure') {
        await this.eventStore.clearRecord(sourceSystem, externalEventId);
      }

      // 3. Processar evento específico com telemetria
      const outcome = await this.monitor.executeClinicWebhookCall(
        'webhook_ingest',
        () => this.routeAndProcessEvent(payload, internalEventId, ingestContext),
        { requestId, tenantId: (payload as any).externalFacilityId }
      );

      if (!outcome.processed) {
        await this.eventStore.recordProcessed(
          sourceSystem,
          externalEventId,
          internalEventId,
          'failure',
          { eventType: payload.type, reason: outcome.message }
        );

        return {
          success: false,
          receivedEventId: internalEventId,
          externalEventId,
          processedAt: new Date().toISOString(),
          idempotencyKey: this.eventStore.generatePayloadHash(payload),
          message: outcome.message,
        };
      }

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
        message: outcome.message,
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
    event: ClinicPaymentReceivedEvent,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, amount: event.amount },
      'Processing payment_received event'
    );

    return this.persistClinicEvent(event, internalEventId);
  }

  /**
   * Processar despesa registrada: criar transaction tipo despesa.
   */
  private async handleExpenseRecorded(
    event: ClinicExpenseRecordedEvent,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, amount: event.amount },
      'Processing expense_recorded event'
    );

    return this.persistClinicEvent(event, internalEventId);
  }

  /**
   * Processar lembrete de cobrança criado: criar reminder no Flow.
   */
  private async handleReceivableReminderCreated(
    event: ClinicReceivableReminderCreatedEvent,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId, dueAmount: event.dueAmount },
      'Processing receivable_reminder_created event'
    );

    return this.persistClinicEvent(event, internalEventId);
  }

  /**
   * Processar update de lembrete.
   */
  private async handleReceivableReminderUpdated(
    event: ClinicReceivableReminderUpdatedEvent,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId },
      'Processing receivable_reminder_updated event'
    );

    return this.persistClinicEvent(event, internalEventId);
  }

  /**
   * Processar quitação de lembrete.
   */
  private async handleReceivableReminderCleared(
    event: ClinicReceivableReminderClearedEvent,
    internalEventId: string,
    _context: FeatureFlagContext
  ): Promise<{ processed: boolean; message: string }> {
    this.logger.info(
      { internalEventId, externalEventId: event.externalEventId },
      'Processing receivable_reminder_cleared event'
    );

    return this.persistClinicEvent(event, internalEventId);
  }

  private async persistClinicEvent(
    payload: ClinicWebhookPayload,
    internalEventId: string,
  ): Promise<{ processed: boolean; message: string }> {
    const mapped = this.mapClinicPayloadToExternalEvent(payload);

    if ('message' in mapped) {
      this.logger.warn(
        { internalEventId, eventType: payload.type, reason: mapped.message },
        'Clinic event could not be routed to Flow persistence'
      );
      return {
        processed: false,
        message: mapped.message,
      };
    }

    const result = await processExternalIntegrationEvent(mapped.event);

    this.logger.info(
      {
        internalEventId,
        externalEventId: payload.externalEventId,
        eventType: payload.type,
        workspaceId: mapped.event.workspaceId,
        operation: result.operation,
        status: result.status,
      },
      'Clinic event persisted in Flow'
    );

    return {
      processed: true,
      message: `${payload.type} persisted as ${result.operation}`,
    };
  }

  private mapClinicPayloadToExternalEvent(
    payload: ClinicWebhookPayload,
  ): { event: ExternalIntegrationEvent } | { message: string } {
    const workspaceId = payload.externalFacilityId?.trim();
    if (!workspaceId) {
      return {
        message: 'externalFacilityId is required to route clinic events to a Flow workspace',
      };
    }

    switch (payload.type) {
      case 'payment_received': {
        const currency = this.normalizeCurrency(payload.currency);
        if (!currency) {
          return {
            message: `Unsupported clinic event currency: ${payload.currency}`,
          };
        }
        return { event: this.mapPaymentReceivedEvent(payload, workspaceId, currency) };
      }
      case 'expense_recorded': {
        const currency = this.normalizeCurrency(payload.currency);
        if (!currency) {
          return {
            message: `Unsupported clinic event currency: ${payload.currency}`,
          };
        }
        return { event: this.mapExpenseRecordedEvent(payload, workspaceId, currency) };
      }
      case 'receivable_reminder_created': {
        const currency = this.normalizeCurrency(payload.currency);
        if (!currency) {
          return {
            message: `Unsupported clinic event currency: ${payload.currency}`,
          };
        }
        return { event: this.mapReminderCreatedEvent(payload, workspaceId, currency) };
      }
      case 'receivable_reminder_updated': {
        const currency = this.normalizeCurrency(payload.currency);
        if (!currency) {
          return {
            message: `Unsupported clinic event currency: ${payload.currency}`,
          };
        }
        return { event: this.mapReminderUpdatedEvent(payload, workspaceId, currency) };
      }
      case 'receivable_reminder_cleared':
        return { event: this.mapReminderClearedEvent(payload, workspaceId, 'BRL') };
      default: {
        const exhaustive: never = payload;
        return { message: `Unsupported clinic event type: ${(exhaustive as any).type}` };
      }
    }
  }

  private normalizeCurrency(currency: string | undefined): 'BRL' | null {
    return currency === 'BRL' ? 'BRL' : null;
  }

  private toDateTimeAtStartOfDay(date: string): string {
    return `${date}T00:00:00.000Z`;
  }

  private mapPaymentReceivedEvent(
    payload: ClinicPaymentReceivedEvent,
    workspaceId: string,
    currency: 'BRL',
  ): PaymentReceivedEvent {
    return {
      eventType: 'payment_received',
      externalEventId: payload.externalEventId,
      sourceSystem: 'clinic-automation',
      workspaceId,
      occurredAt: payload.date,
      payload: {
        externalCustomerId: payload.externalPatientId,
        externalReceivableId: payload.externalEventId,
        amount: payload.amount,
        currency,
        category: payload.category,
        description: payload.description,
        notes: payload.notes,
      },
    };
  }

  private mapExpenseRecordedEvent(
    payload: ClinicExpenseRecordedEvent,
    workspaceId: string,
    currency: 'BRL',
  ): ExpenseRecordedEvent {
    return {
      eventType: 'expense_recorded',
      externalEventId: payload.externalEventId,
      sourceSystem: 'clinic-automation',
      workspaceId,
      occurredAt: payload.date,
      payload: {
        externalExpenseId: payload.externalEventId,
        amount: payload.amount,
        currency,
        category: payload.expenseCategory,
        description: payload.description,
        vendor: payload.vendor,
        notes: payload.notes,
      },
    };
  }

  private mapReminderCreatedEvent(
    payload: ClinicReceivableReminderCreatedEvent,
    workspaceId: string,
    currency: 'BRL',
  ): ReceivableReminderCreatedEvent {
    return {
      eventType: 'receivable_reminder_created',
      externalEventId: payload.externalEventId,
      sourceSystem: 'clinic-automation',
      workspaceId,
      occurredAt: new Date().toISOString(),
      payload: {
        externalCustomerId: payload.externalPatientId,
        externalReceivableId: payload.externalEventId,
        dueDate: this.toDateTimeAtStartOfDay(payload.dueDate),
        outstandingAmount: payload.dueAmount,
        currency,
        description: payload.description,
        serviceDescription: payload.serviceDescription,
        notes: payload.notes,
      },
    };
  }

  private mapReminderUpdatedEvent(
    payload: ClinicReceivableReminderUpdatedEvent,
    workspaceId: string,
    currency: 'BRL',
  ): ReceivableReminderUpdatedEvent {
    return {
      eventType: 'receivable_reminder_updated',
      externalEventId: payload.externalEventId,
      sourceSystem: 'clinic-automation',
      workspaceId,
      occurredAt: payload.updatedAt,
      payload: {
        externalCustomerId: payload.externalPatientId,
        externalReceivableId: payload.externalEventId,
        dueDate: this.toDateTimeAtStartOfDay(payload.dueDate),
        outstandingAmount: payload.dueAmount,
        currency,
        description: payload.description,
        reason: payload.reason,
      },
    };
  }

  private mapReminderClearedEvent(
    payload: ClinicReceivableReminderClearedEvent,
    workspaceId: string,
    currency: 'BRL',
  ): ReceivableReminderClearedEvent {
    return {
      eventType: 'receivable_reminder_cleared',
      externalEventId: payload.externalEventId,
      sourceSystem: 'clinic-automation',
      workspaceId,
      occurredAt: payload.clearedDate,
      payload: {
        externalCustomerId: payload.externalPatientId,
        externalReceivableId: payload.externalEventId,
        clearedAt: payload.clearedDate,
        settledAmount: payload.clearedAmount,
        currency,
        description: payload.notes || `Receivable reminder cleared (${payload.reason})`,
        notes: payload.notes,
        reason: payload.reason,
      },
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
