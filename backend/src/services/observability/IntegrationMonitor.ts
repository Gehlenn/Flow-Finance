import {
  IntegrationTelemetry,
  IntegrationContext,
  IntegrationName
} from './IntegrationTelemetry';
import { Logger } from 'pino';

/**
 * IntegrationMonitor: Conjunto de helpers para instrumentar llamadas a integrações específicas.
 * Cada integração tem seu wrapper que padroniza a telemetria.
 */
export class IntegrationMonitor {
  constructor(private readonly telemetry: IntegrationTelemetry, private readonly logger: Logger) {}

  /**
   * Wrapper para chamadas de IA (OpenAI, Gemini, Claude, etc).
   */
  async executeAICall<T>(
    provider: 'openai' | 'gemini' | 'claude',
    operation: 'ai_chat' | 'ai_analysis',
    fn: () => Promise<T>,
    context?: Partial<IntegrationContext>
  ): Promise<T> {
    const baseContext: IntegrationContext = {
      integrationName: 'openai', // será sobrescrito por provider map
      operation,
      provider,
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: context?.requestId || 'unknown',
      tenantId: context?.tenantId,
      userId: context?.userId,
      sourceSystem: context?.sourceSystem || 'flow',
      timeoutMs: 30000
    };

    // Mapear provider string para IntegrationName
    const integrationMap: Record<string, IntegrationName> = {
      openai: 'openai',
      gemini: 'gemini',
      claude: 'claude'
    };
    baseContext.integrationName = integrationMap[provider] || 'openai';

    try {
      const result = await this.telemetry.executeWithTelemetry(baseContext, fn);
      this.telemetry.recordSuccess(baseContext, { provider });
      return result;
    } catch (error) {
      this.logger.error(
        { provider, operation, requestId: baseContext.requestId, error: (error as Error).message },
        `AI call failed: ${provider} - ${operation}`
      );
      throw error;
    }
  }

  /**
   * Wrapper para chamadas de Stripe (pagamentos).
   */
  async executeStripeCall<T>(
    operation: 'payment_process' | 'create_transaction' | 'webhook_ingest',
    fn: () => Promise<T>,
    context?: Partial<IntegrationContext>
  ): Promise<T> {
    const baseContext: IntegrationContext = {
      integrationName: 'stripe',
      operation,
      provider: 'stripe',
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: context?.requestId || 'unknown',
      tenantId: context?.tenantId,
      userId: context?.userId,
      sourceSystem: 'flow',
      timeoutMs: 15000
    };

    return this.telemetry.executeWithTelemetry(baseContext, fn);
  }

  /**
   * Wrapper para chamadas de Firebase (leitura, escrita, auth).
   */
  async executeFirebaseCall<T>(
    operation: 'auth_check' | 'sync_user' | 'fetch_data' | 'create_transaction',
    fn: () => Promise<T>,
    context?: Partial<IntegrationContext>
  ): Promise<T> {
    const baseContext: IntegrationContext = {
      integrationName: 'firebase',
      operation,
      provider: 'firebase',
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: context?.requestId || 'unknown',
      tenantId: context?.tenantId,
      userId: context?.userId,
      sourceSystem: 'flow',
      timeoutMs: 10000
    };

    return this.telemetry.executeWithTelemetry(baseContext, fn);
  }

  /**
   * Wrapper para chamadas de Pluggy (Open Finance / agregador bancário).
   */
  async executePluggyCall<T>(
    operation: 'fetch_data' | 'auth_check',
    fn: () => Promise<T>,
    context?: Partial<IntegrationContext>
  ): Promise<T> {
    const baseContext: IntegrationContext = {
      integrationName: 'pluggy',
      operation,
      provider: 'pluggy',
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: context?.requestId || 'unknown',
      tenantId: context?.tenantId,
      userId: context?.userId,
      sourceSystem: 'flow',
      timeoutMs: 30000 // Pluggy pode ser lento
    };

    return this.telemetry.executeWithTelemetry(baseContext, fn);
  }

  /**
   * Wrapper para webhooks da clínica (ingestão de eventos de automação).
   */
  async executeClinicWebhookCall<T>(
    operation: 'webhook_ingest',
    fn: () => Promise<T>,
    context?: Partial<IntegrationContext>
  ): Promise<T> {
    const baseContext: IntegrationContext = {
      integrationName: 'clinic-automation',
      operation,
      provider: 'clinic-automation',
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: context?.requestId || 'unknown',
      tenantId: context?.tenantId,
      sourceSystem: 'clinic-automation',
      timeoutMs: 10000
    };

    return this.telemetry.executeWithTelemetry(baseContext, fn);
  }

  /**
   * Registrar degradação detectada em uma integração.
   */
  recordDegradation(
    integrationName: IntegrationName,
    reason: string,
    severity: 'low' | 'medium' | 'high',
    metadata?: Record<string, any>
  ): void {
    const context: IntegrationContext = {
      integrationName,
      operation: 'fetch_data', // Usar operação válida
      environment: (process.env.NODE_ENV || 'development') as any,
      requestId: 'health-check',
      sourceSystem: 'flow'
    };

    this.telemetry.recordDegradation(context, reason, severity);

    this.logger.warn(
      { integrationName, reason, severity, ...metadata },
      `Service degradation: ${integrationName}`
    );
  }

  /**
   * Health check centralizado para todas as dependências.
   */
  async checkAllHealths(): Promise<
    Array<{
      name: string;
      healthy: boolean;
      lastChecked: Date;
      message?: string;
    }>
  > {
    const checks: Array<{
      name: string;
      healthy: boolean;
      lastChecked: Date;
      message?: string;
    }> = [];

    const integrations: IntegrationName[] = [
      'firebase',
      'openai',
      'gemini',
      'stripe',
      'pluggy',
      'clinic-automation'
    ];

    for (const integration of integrations) {
      try {
        const health = await this.telemetry.checkHealthFor(integration);
        checks.push(health);
      } catch (error) {
        checks.push({
          name: integration,
          healthy: false,
          lastChecked: new Date(),
          message: (error as Error).message
        });
      }
    }

    return checks;
  }
}
