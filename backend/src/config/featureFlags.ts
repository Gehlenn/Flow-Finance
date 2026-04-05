/**
 * config/featureFlags.ts — Configuração central de feature flags do Flow Finance.
 *
 * Este arquivo define TODAS as feature flags disponíveis no sistema com seus valores padrão.
 * Kill switches começam sempre DESABILITADOS e são acionados em tempo de execução via
 * EnhancedFeatureFlagService.activateKillSwitch().
 *
 * ## Kill switches disponíveis
 * | Kill switch                  | Derruba flags afetadas                                           |
 * |------------------------------|------------------------------------------------------------------|
 * | kill_switch_ai               | ai_chat_enabled, ai_analysis_enabled, ai_deep_analysis_enabled  |
 * | kill_switch_clinic_automation| clinic_automation_ingest_enabled, clinic_automation_auto_post_enabled |
 * | kill_switch_stripe_webhooks  | stripe_payments_enabled                                          |
 *
 * ## Como acionar um kill switch em produção (sem deploy)
 * ```ts
 * featureFlagService.activateKillSwitch('kill_switch_ai', 'on-call-engineer', 'high error rate');
 * ```
 */

import { EnhancedFeatureFlagService, createDefaultEnhancedFeatureFlagService } from '../services/featureFlags/EnhancedFeatureFlagService';

export type {
  FeatureFlagName,
  FeatureFlagDefinition,
  FeatureFlagContext,
  FeatureFlagResult,
} from '../services/featureFlags/EnhancedFeatureFlagService';

/**
 * Singleton do feature flag service para uso em toda a aplicação.
 * Usar `getFeatureFlagService()` para obter a instância.
 */
let _instance: EnhancedFeatureFlagService | null = null;

export function getFeatureFlagService(): EnhancedFeatureFlagService {
  if (!_instance) {
    _instance = createDefaultEnhancedFeatureFlagService();
    applyEnvironmentOverrides(_instance);
  }
  return _instance;
}

/**
 * Resetar instância (útil em testes).
 */
export function resetFeatureFlagService(): void {
  _instance = null;
}

/**
 * Aplicar overrides por variável de ambiente.
 * Permite controle de flags em produção sem alterar código.
 *
 * Variáveis suportadas (valor: 'true' | 'false'):
 *   FF_OPEN_FINANCE, FF_AI_CHAT, FF_AI_ANALYSIS, FF_AI_FALLBACK,
 *   FF_CLINIC_INGEST, FF_CLINIC_AUTO_POST, FF_KILL_AI,
 *   FF_KILL_CLINIC, FF_KILL_STRIPE
 */
function applyEnvironmentOverrides(service: EnhancedFeatureFlagService): void {
  const env = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production';

  const overrideMap: Array<{ envVar: string; action: () => void }> = [
    {
      envVar: 'FF_KILL_AI',
      action: () => {
        if (process.env.FF_KILL_AI === 'true') {
          service.activateKillSwitch('kill_switch_ai', 'env-config', `FF_KILL_AI=true in ${env}`);
        }
      }
    },
    {
      envVar: 'FF_KILL_CLINIC',
      action: () => {
        if (process.env.FF_KILL_CLINIC === 'true') {
          service.activateKillSwitch('kill_switch_clinic_automation', 'env-config', `FF_KILL_CLINIC=true in ${env}`);
        }
      }
    },
    {
      envVar: 'FF_KILL_STRIPE',
      action: () => {
        if (process.env.FF_KILL_STRIPE === 'true') {
          service.activateKillSwitch('kill_switch_stripe_webhooks', 'env-config', `FF_KILL_STRIPE=true in ${env}`);
        }
      }
    },
  ];

  for (const { action } of overrideMap) {
    action();
  }
}

export { EnhancedFeatureFlagService, createDefaultEnhancedFeatureFlagService };
