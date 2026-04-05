import logger from '../../config/logger';
import * as Sentry from '@sentry/node';

/**
 * Feature Flag Definition com suporte a kill switches, percentual rollout, e restrições por ambiente/role/tenant.
 * Compatível com a versão anterior mas com muito mais controle.
 */

export type FeatureFlagName =
  | 'open_finance_enabled'
  | 'ai_chat_enabled'
  | 'ai_analysis_enabled'
  | 'ai_deep_analysis_enabled'
  | 'ai_fallback_enabled'
  | 'ai_provider_fallback_enabled'
  | 'clinic_automation_ingest_enabled'
  | 'clinic_automation_auto_post_enabled'
  | 'external_integrations_monitoring_enabled'
  | 'external_integrations_observability_enabled'
  | 'ai_ocr_enabled'
  | 'stripe_payments_enabled'
  | 'saas_multi_tenant_enabled'
  | 'saas_billing_enabled'
  | 'sentry_integration_enabled'
  | 'health_checks_enabled'
  // Kill switches — prioridade máxima, desligam imediatamente o fluxo associado
  | 'kill_switch_ai'
  | 'kill_switch_clinic_automation'
  | 'kill_switch_stripe_webhooks';

export interface FeatureFlagDefinition {
  name: FeatureFlagName;
  enabled: boolean;
  forceDisabled?: boolean; // Kill switch: se true, sempre retorna disabled
  allowedEnvironments?: Array<'development' | 'staging' | 'production'>;
  allowedRoles?: string[];
  allowedTenants?: string[];
  percentageRollout?: number; // 0-100: percentual de usuários para ativar
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagContext {
  environment: 'development' | 'staging' | 'production';
  userId?: string;
  role?: string;
  tenantId?: string;
  plan?: string;
  sourceSystem?: 'flow' | 'clinic-automation' | 'internal';
}

export interface FeatureFlagResult {
  enabled: boolean;
  reason:
    | 'kill_switch_active'
    | 'disabled'
    | 'environment_blocked'
    | 'role_blocked'
    | 'tenant_blocked'
    | 'rollout_blocked'
    | 'enabled';
}

/**
 * EnhancedFeatureFlagService: Serviço avançado de feature flags com kill switches.
 * Kill switches têm prioridade máxima e podem desligar qualquer feature instantaneamente.
 */
export class EnhancedFeatureFlagService {
  private readonly flags: Map<FeatureFlagName, FeatureFlagDefinition>;
  private killSwitchAuditLog: Array<{
    flagName: FeatureFlagName;
    action: 'activated' | 'deactivated';
    changedBy: string;
    timestamp: Date;
    environment: string;
    reason?: string;
  }> = [];

  constructor(definitions: FeatureFlagDefinition[]) {
    this.flags = new Map(definitions.map((d) => [d.name, d]));
  }

  /**
   * Avaliar se uma feature está habilitada para um contexto.
   * Kill switch tem prioridade máxima.
   */
  isEnabled(name: FeatureFlagName, context: FeatureFlagContext): FeatureFlagResult {
    const flag = this.flags.get(name);

    if (!flag) {
      return { enabled: false, reason: 'disabled' };
    }

    // Kill switch: prioridade máxima
    if (flag.forceDisabled) {
      logger.warn(
        { flagName: name, environment: context.environment, userId: context.userId },
        `Kill switch active for flag ${name}`
      );
      return { enabled: false, reason: 'kill_switch_active' };
    }

    // Verificar se a flag está habilitada
    if (!flag.enabled) {
      return { enabled: false, reason: 'disabled' };
    }

    // Verificar ambiente permitido
    if (flag.allowedEnvironments && !flag.allowedEnvironments.includes(context.environment)) {
      return { enabled: false, reason: 'environment_blocked' };
    }

    // Verificar role/função
    if (flag.allowedRoles?.length && (!context.role || !flag.allowedRoles.includes(context.role))) {
      return { enabled: false, reason: 'role_blocked' };
    }

    // Verificar tenant
    if (flag.allowedTenants?.length && (!context.tenantId || !flag.allowedTenants.includes(context.tenantId))) {
      return { enabled: false, reason: 'tenant_blocked' };
    }

    // Verificar rollout percentual
    if (typeof flag.percentageRollout === 'number' && context.userId) {
      const bucket = this.hashToPercent(`${name}:${context.userId}`);
      if (bucket >= flag.percentageRollout) {
        return { enabled: false, reason: 'rollout_blocked' };
      }
    }

    return { enabled: true, reason: 'enabled' };
  }

  /**
   * Ativar kill switch para uma feature (desligar imediatamente).
   * Registra auditoria em log estruturado e Sentry.
   */
  activateKillSwitch(
    flagName: FeatureFlagName,
    changedBy: string,
    reason?: string,
    environment?: string
  ): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    flag.forceDisabled = true;

    const auditEntry = {
      flagName,
      action: 'activated' as const,
      changedBy,
      timestamp: new Date(),
      environment: environment || process.env.NODE_ENV || 'unknown',
      reason
    };

    this.killSwitchAuditLog.push(auditEntry);

    // Log estruturado
    logger.error(
      {
        flagName,
        action: 'kill_switch_activated',
        changedBy,
        reason,
        environment: auditEntry.environment,
        timestamp: auditEntry.timestamp
      },
      `Kill switch activated for feature flag: ${flagName}`
    );

    // Sentry: alertar para incidente em tempo real
    Sentry.captureMessage(
      `Kill switch ACTIVATED for ${flagName}. Reason: ${reason || 'none provided'}. By: ${changedBy}`,
      'error'
    );

    Sentry.setTag('kill_switch', 'activated');
    Sentry.setTag('flag_name', flagName);
    Sentry.setContext('kill_switch', {
      flagName,
      changedBy,
      reason,
      timestamp: auditEntry.timestamp.toISOString()
    });
  }

  /**
   * Desativar kill switch para uma feature (reabilitar).
   */
  deactivateKillSwitch(
    flagName: FeatureFlagName,
    changedBy: string,
    reason?: string,
    environment?: string
  ): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    flag.forceDisabled = false;

    const auditEntry = {
      flagName,
      action: 'deactivated' as const,
      changedBy,
      timestamp: new Date(),
      environment: environment || process.env.NODE_ENV || 'unknown',
      reason
    };

    this.killSwitchAuditLog.push(auditEntry);

    logger.info(
      {
        flagName,
        action: 'kill_switch_deactivated',
        changedBy,
        reason,
        environment: auditEntry.environment,
        timestamp: auditEntry.timestamp
      },
      `Kill switch deactivated for feature flag: ${flagName}`
    );

    Sentry.captureMessage(
      `Kill switch DEACTIVATED for ${flagName}. Reason: ${reason || 'none provided'}. By: ${changedBy}`,
      'info'
    );
  }

  /**
   * Habilitar uma feature progressivamente (percentual rollout).
   */
  setRolloutPercentage(
    flagName: FeatureFlagName,
    percentage: number,
    changedBy: string
  ): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    flag.percentageRollout = percentage;

    logger.info(
      {
        flagName,
        percentageRollout: percentage,
        changedBy
      },
      `Rollout percentage updated for feature flag: ${flagName}`
    );
  }

  /**
   * Definir ambientes permitidos.
   */
  setAllowedEnvironments(
    flagName: FeatureFlagName,
    environments: Array<'development' | 'staging' | 'production'>,
    changedBy: string
  ): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag ${flagName} not found`);
    }

    flag.allowedEnvironments = environments;

    logger.info(
      {
        flagName,
        allowedEnvironments: environments,
        changedBy
      },
      `Allowed environments updated for feature flag: ${flagName}`
    );
  }

  /**
   * Obter status de auditoria de kill switches.
   */
  getKillSwitchAuditLog(): typeof this.killSwitchAuditLog {
    return [...this.killSwitchAuditLog];
  }

  /**
   * Listar todas as flags com seu status atual.
   */
  getAllFlags(): Array<FeatureFlagDefinition & { isKillSwitchActive: boolean }> {
    return Array.from(this.flags.values()).map((flag) => ({
      ...flag,
      isKillSwitchActive: flag.forceDisabled || false
    }));
  }

  /**
   * Hash userId para rollout percentual consistente.
   * Garante que mesmo usuário sempre caia no mesmo bucket.
   */
  private hashToPercent(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }
}

/**
 * Factory para criar instância com definições padrão.
 */
export function createDefaultEnhancedFeatureFlagService(): EnhancedFeatureFlagService {
  const definitions: FeatureFlagDefinition[] = [
    {
      name: 'open_finance_enabled',
      enabled: false, // Cara: ~R$1000+/mês
      description: 'Open Finance / Pluggy integration'
    },
    {
      name: 'ai_chat_enabled',
      enabled: true,
      allowedEnvironments: ['development', 'staging', 'production'],
      description: 'IA chat feature'
    },
    {
      name: 'ai_deep_analysis_enabled',
      enabled: true,
      allowedEnvironments: ['development', 'staging', 'production'],
      percentageRollout: 100,
      description: 'Deep financial analysis with IA'
    },
    {
      name: 'ai_provider_fallback_enabled',
      enabled: true,
      description: 'Fallback from primary to secondary IA provider'
    },
    {
      name: 'clinic_automation_ingest_enabled',
      enabled: false, // Será habilitado após testes
      allowedEnvironments: ['staging', 'production'],
      description: 'Receber eventos de ingestão da automação da clínica'
    },
    {
      name: 'clinic_automation_auto_post_enabled',
      enabled: false,
      allowedEnvironments: ['staging', 'production'],
      description: 'Postar automaticamente dados da clínica no Flow'
    },
    {
      name: 'ai_analysis_enabled',
      enabled: true,
      allowedEnvironments: ['development', 'staging', 'production'],
      description: 'AI financial analysis (alias for ai_deep_analysis_enabled)'
    },
    {
      name: 'ai_fallback_enabled',
      enabled: true,
      description: 'AI provider fallback (alias for ai_provider_fallback_enabled)'
    },
    {
      name: 'external_integrations_monitoring_enabled',
      enabled: true,
      description: 'Sentry monitoring spans for all external integrations'
    },
    {
      name: 'external_integrations_observability_enabled',
      enabled: true,
      description: 'Observabilidade com Sentry para integrações externas'
    },
    {
      name: 'ai_ocr_enabled',
      enabled: true,
      description: 'OCR receipt scanning'
    },
    {
      name: 'stripe_payments_enabled',
      enabled: true,
      description: 'Stripe payment processing'
    },
    {
      name: 'saas_multi_tenant_enabled',
      enabled: true,
      description: 'Multi-tenant SaaS architecture'
    },
    {
      name: 'saas_billing_enabled',
      enabled: true,
      description: 'SaaS billing system'
    },
    {
      name: 'sentry_integration_enabled',
      enabled: true,
      description: 'Sentry error tracking'
    },
    {
      name: 'health_checks_enabled',
      enabled: true,
      description: 'Health check endpoints'
    },
    // Kill switches — começam DESLIGADOS; acionar via activateKillSwitch() em incidentes
    {
      name: 'kill_switch_ai',
      enabled: false,
      forceDisabled: false,
      description: 'Kill switch para desligar TODOS os fluxos de IA imediatamente'
    },
    {
      name: 'kill_switch_clinic_automation',
      enabled: false,
      forceDisabled: false,
      description: 'Kill switch para bloquear toda ingestão da clínica imediatamente'
    },
    {
      name: 'kill_switch_stripe_webhooks',
      enabled: false,
      forceDisabled: false,
      description: 'Kill switch para parar processamento de webhooks Stripe imediatamente'
    }
  ];

  return new EnhancedFeatureFlagService(definitions);
}

export default EnhancedFeatureFlagService;
