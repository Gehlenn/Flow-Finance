import * as Sentry from '@sentry/node';
import { Logger } from 'pino';
import { performance } from 'perf_hooks';

export type IntegrationName =
  | 'stripe'
  | 'firebase'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'pluggy'
  | 'clinic-automation'
  | 'webhook';

export type IntegrationOperation =
  | 'create_transaction'
  | 'sync_user'
  | 'ai_chat'
  | 'ai_analysis'
  | 'webhook_ingest'
  | 'auth_check'
  | 'payment_process'
  | 'fetch_data';

export type IntegrationStatus = 'success' | 'error' | 'timeout' | 'degraded' | 'fallback';

export interface IntegrationContext {
  integrationName: IntegrationName;
  operation: IntegrationOperation;
  provider?: string;
  status?: IntegrationStatus;
  durationMs?: number;
  environment: 'development' | 'staging' | 'production';
  requestId: string;
  userId?: string;
  tenantId?: string;
  sourceSystem?: 'flow' | 'clinic-automation' | 'internal';
  retryCount?: number;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  fallbackApplied?: boolean;
  timeoutMs?: number;
}

/**
 * IntegrationTelemetry: Camada central de instrumentação para integrações externas.
 * Todos os wrappers de integração devem usar esta classe para:
 * - Registrar telemetria estruturada em Pino
 * - Capturar exceções em Sentry com contexto rico
 * - Medir latência e status de chamadas
 * - Rastrear retries e fallbacks
 * - Preparar alertas por integração
 */
export class IntegrationTelemetry {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Decorator para instrumentação automática de métodos que chamam integrações externas.
   * Aplicar assim:
   * @IntegrationTelemetry.instrument(telemetry, {
   *   integrationName: 'stripe',
   *   operation: 'payment_process',
   *   timeoutMs: 5000
   * })
   */
  static instrument(telemetry: IntegrationTelemetry, config: Partial<IntegrationContext>) {
    return function (
      _target: any,
      _propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      descriptor.value = async function (...args: any[]) {
        const context: IntegrationContext = {
          integrationName: config.integrationName || 'webhook',
          operation: config.operation || 'fetch_data',
          environment: process.env.NODE_ENV as any,
          requestId: telemetry.getRequestId(),
          userId: telemetry.getUserId(),
          tenantId: telemetry.getTenantId(),
          sourceSystem: process.env.SOURCE_SYSTEM as any,
          ...config
        };

        try {
          const result = await telemetry.executeWithTelemetry(
            context,
            () => originalMethod.apply(this, args)
          );
          return result;
        } catch (error) {
          telemetry.captureException(error as Error, context);
          throw error;
        }
      };
      return descriptor;
    };
  }

  /**
   * Executar uma função com monitoramento automático de latência e erro.
   */
  async executeWithTelemetry<T>(
    context: IntegrationContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    let status: IntegrationStatus = 'success';
    let result: T;
    let error: Error | null = null;

    try {
      // Usar Sentry para tracking
      Sentry.setTag('integration', context.integrationName);
      Sentry.setTag('operation', context.operation);

      result = (await Promise.race([
        fn(),
        this.createTimeoutPromise(context.timeoutMs || 30000)
      ])) as T;
    } catch (err) {
      const durationMs = performance.now() - startTime;

      if (err instanceof Error && err.message === 'Integration timeout') {
        status = 'timeout';
        error = err;
      } else {
        status = 'error';
        error = err instanceof Error ? err : new Error(String(err));
      }

      context.status = status;
      context.durationMs = durationMs;
      context.errorMessage = error.message;

      this.logIntegrationEvent(context);
      this.captureException(error, context);
      throw error;
    }

    const durationMs = performance.now() - startTime;
    context.status = status;
    context.durationMs = durationMs;

    this.logIntegrationEvent(context);
    return result;
  }

  /**
   * Registrar sucesso de chamada externa.
   */
  recordSuccess(context: IntegrationContext, metadata?: Record<string, any>): void {
    context.status = 'success';
    this.logIntegrationEvent(context, metadata);

    // Criar breadcrumb no Sentry para tracking de jornada
    Sentry.addBreadcrumb({
      category: `integration.${context.integrationName}`,
      message: `${context.integrationName} - ${context.operation} succeeded`,
      level: 'info',
      data: {
        integrationName: context.integrationName,
        operation: context.operation,
        durationMs: context.durationMs
      }
    });
  }

  /**
   * Registrar fallback ativado (ex: provider secundário usado após falha).
   */
  recordFallback(
    context: IntegrationContext,
    reason: string,
    fallbackProvider?: string
  ): void {
    context.status = 'fallback';
    context.fallbackApplied = true;

    this.logger.warn(
      {
        integrationName: context.integrationName,
        operation: context.operation,
        reason,
        fallbackProvider,
        requestId: context.requestId,
        tenantId: context.tenantId,
        durationMs: context.durationMs
      },
      `Fallback activated for ${context.integrationName}`
    );

    // Enviar para Sentry para awareness
    Sentry.captureMessage(
      `Fallback activated: ${context.integrationName} - ${reason}`,
      'warning'
    );

    Sentry.setTag('fallback_applied', true);
    Sentry.setTag('fallback_provider', fallbackProvider || 'unknown');
  }

  /**
   * Registrar degradação de serviço (ex: latência anormal, taxa de erro alta).
   */
  recordDegradation(
    context: IntegrationContext,
    reason: string,
    severity: 'low' | 'medium' | 'high'
  ): void {
    context.status = 'degraded';

    this.logger.warn(
      {
        integrationName: context.integrationName,
        operation: context.operation,
        reason,
        severity,
        durationMs: context.durationMs,
        requestId: context.requestId,
        tenantId: context.tenantId
      },
      `Service degradation detected: ${context.integrationName}`
    );

    // Alertar Sentry com contexto para acionamento
    Sentry.captureMessage(
      `Service degradation: ${context.integrationName} - ${reason}`,
      severity === 'high' ? 'error' : 'warning'
    );
  }

  /**
   * Registrar erro com contexto estruturado.
   */
  captureException(error: Error, context: IntegrationContext): void {
    context.status = 'error';
    context.errorMessage = error.message;

    this.logger.error(
      {
        integrationName: context.integrationName,
        operation: context.operation,
        errorCode: context.errorCode,
        errorMessage: error.message,
        stack: error.stack,
        httpStatus: context.httpStatus,
        retryCount: context.retryCount,
        durationMs: context.durationMs,
        requestId: context.requestId,
        userId: context.userId ? this.anonymizeUserId(context.userId) : undefined,
        tenantId: context.tenantId,
        sourceSystem: context.sourceSystem
      },
      `Integration error: ${context.integrationName}`
    );

    // Capturar em Sentry com contexto rico
    Sentry.withScope((scope) => {
      scope.setTag('integration', context.integrationName);
      scope.setTag('operation', context.operation);
      scope.setTag('provider', context.provider || 'unknown');
      scope.setTag('source_system', context.sourceSystem || 'flow');
      scope.setTag('integration_status', 'error');

      scope.setContext('integration', {
        name: context.integrationName,
        operation: context.operation,
        provider: context.provider,
        durationMs: context.durationMs,
        retryCount: context.retryCount || 0,
        httpStatus: context.httpStatus,
        errorCode: context.errorCode
      });

      scope.setUser({
        id: context.userId ? this.anonymizeUserId(context.userId) : undefined
      });

      scope.setContext('tenant', {
        id: context.tenantId,
        sourceSystem: context.sourceSystem
      });

      Sentry.captureException(error);
    });
  }

  /**
   * Log estruturado de eventos de integração (sucesso, erro, fallback, timeout).
   */
  private logIntegrationEvent(
    context: IntegrationContext,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(
      {
        integrationName: context.integrationName,
        operation: context.operation,
        provider: context.provider,
        status: context.status,
        durationMs: context.durationMs,
        environment: context.environment,
        requestId: context.requestId,
        userId: context.userId ? this.anonymizeUserId(context.userId) : undefined,
        tenantId: context.tenantId,
        sourceSystem: context.sourceSystem,
        retryCount: context.retryCount,
        httpStatus: context.httpStatus,
        errorCode: context.errorCode,
        errorMessage: context.errorMessage,
        fallbackApplied: context.fallbackApplied,
        ...metadata
      },
      `Integration event: ${context.integrationName} - ${context.operation} - ${context.status}`
    );
  }

  /**
   * Criar timeout promise para abreviar operações longas.
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Integration timeout')), timeoutMs)
    );
  }

  /**
   * Anonimizar userId para logging seguro.
   */
  private anonymizeUserId(userId: string): string {
    if (!userId) return 'unknown';
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  }

  /**
   * Obter requestId do contexto (deve ser injetado por middleware).
   */
  private getRequestId(): string {
    // TODO: extrair de AsyncLocalStorage ou contexto de requisição
    return process.env.REQUEST_ID || 'unknown';
  }

  /**
   * Obter userId autenticado do contexto.
   */
  private getUserId(): string | undefined {
    // TODO: extrair de AsyncLocalStorage ou contexto de requisição
    return process.env.USER_ID;
  }

  /**
   * Obter tenantId do contexto.
   */
  private getTenantId(): string | undefined {
    // TODO: extrair de AsyncLocalStorage ou contexto de requisição
    return process.env.TENANT_ID;
  }

  /**
   * Criar health check para dependência crítica.
   */
  async checkHealthFor(integrationName: IntegrationName): Promise<{
    name: IntegrationName;
    healthy: boolean;
    lastChecked: Date;
    message?: string;
  }> {
    // Implementação específica por provider
    // Exemplo: chamar endpoint de status, testar conexão, etc.
    return {
      name: integrationName,
      healthy: true,
      lastChecked: new Date()
    };
  }
}
