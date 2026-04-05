import * as Sentry from '@sentry/node';
import logger from '../../config/logger';
import { performance } from 'perf_hooks';

export type MonitorIntegrationContext = {
  integrationName: string;
  provider: string;
  operation: string;
  sourceSystem?: 'flow' | 'clinic-automation' | 'internal';
  featureFlag?: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  retryCount?: number;
};

/**
 * monitorIntegration — wrapper funcional para instrumentar qualquer chamada externa.
 *
 * Abre span Sentry, registra atributos estruturados, mede latência e captura erros.
 * Usar em Stripe, Firebase, OpenAI, Gemini, Claude, Pluggy, integrações da clínica e webhooks.
 *
 * Exemplo:
 *   const result = await monitorIntegration(
 *     { integrationName: 'openai', provider: 'openai', operation: 'ai_chat', sourceSystem: 'flow' },
 *     () => openai.chat.completions.create(...)
 *   );
 */
export async function monitorIntegration<T>(
  context: MonitorIntegrationContext,
  fn: () => Promise<T>
): Promise<T> {
  const spanName = `integration:${context.integrationName}:${context.operation}`;
  const startMs = performance.now();

  return Sentry.startSpan(
    {
      name: spanName,
      op: 'http.client',
      attributes: {
        'integration.name': context.integrationName,
        'integration.provider': context.provider,
        'integration.operation': context.operation,
        'source.system': context.sourceSystem ?? 'flow',
        'feature.flag': context.featureFlag ?? 'none',
        'request.id': context.requestId ?? 'unknown',
        'tenant.id': context.tenantId ?? 'unknown',
      },
    },
    async (span) => {
      try {
        const result = await fn();
        const durationMs = Math.round(performance.now() - startMs);

        span.setAttribute('integration.status', 'success');
        span.setAttribute('integration.duration_ms', durationMs);

        if (context.retryCount !== undefined) {
          span.setAttribute('integration.retry_count', context.retryCount);
        }

        logger.info(
          {
            integrationName: context.integrationName,
            provider: context.provider,
            operation: context.operation,
            sourceSystem: context.sourceSystem ?? 'flow',
            status: 'success',
            durationMs,
            requestId: context.requestId,
            tenantId: context.tenantId,
            featureFlag: context.featureFlag,
          },
          `integration:${context.integrationName}:${context.operation}:success`
        );

        return result;
      } catch (error) {
        const durationMs = Math.round(performance.now() - startMs);
        const err = error instanceof Error ? error : new Error(String(error));

        span.setAttribute('integration.status', 'error');
        span.setAttribute('integration.duration_ms', durationMs);
        span.setAttribute('integration.error_message', err.message);

        if (context.retryCount !== undefined) {
          span.setAttribute('integration.retry_count', context.retryCount);
        }

        logger.error(
          {
            integrationName: context.integrationName,
            provider: context.provider,
            operation: context.operation,
            sourceSystem: context.sourceSystem ?? 'flow',
            status: 'error',
            durationMs,
            errorMessage: err.message,
            requestId: context.requestId,
            tenantId: context.tenantId,
            featureFlag: context.featureFlag,
          },
          `integration:${context.integrationName}:${context.operation}:error`
        );

        Sentry.captureException(err, {
          tags: {
            integration: context.integrationName,
            provider: context.provider,
            operation: context.operation,
            source_system: context.sourceSystem ?? 'flow',
          },
          extra: {
            durationMs,
            featureFlag: context.featureFlag ?? null,
            requestId: context.requestId ?? null,
            tenantId: context.tenantId ?? null,
            retryCount: context.retryCount ?? 0,
          },
        });

        throw error;
      }
    }
  );
}
