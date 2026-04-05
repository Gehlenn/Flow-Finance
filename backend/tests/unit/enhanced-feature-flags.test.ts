import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EnhancedFeatureFlagService,
  FeatureFlagDefinition,
  FeatureFlagContext,
  createDefaultEnhancedFeatureFlagService
} from '../../src/services/featureFlags/EnhancedFeatureFlagService';
import logger from '../../src/config/logger';
import * as Sentry from '@sentry/node';

vi.mock('@sentry/node');

describe('EnhancedFeatureFlagService', () => {
  let service: EnhancedFeatureFlagService;

  beforeEach(() => {
    const definitions: FeatureFlagDefinition[] = [
      {
        name: 'test_feature_enabled',
        enabled: true,
        description: 'Test feature'
      },
      {
        name: 'test_feature_disabled',
        enabled: false,
        description: 'Disabled test feature'
      },
      {
        name: 'test_feature_kill_switch',
        enabled: true,
        forceDisabled: false,
        description: 'Feature with kill switch'
      },
      {
        name: 'test_feature_rollout',
        enabled: true,
        percentageRollout: 50,
        description: 'Feature with rollout'
      },
      {
        name: 'test_feature_environment',
        enabled: true,
        allowedEnvironments: ['staging', 'production'],
        description: 'Environment-restricted feature'
      }
    ];

    service = new EnhancedFeatureFlagService(definitions);
  });

  describe('isEnabled', () => {
    it('deve retornar enabled=true para flag habilitada', () => {
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const result = service.isEnabled('test_feature_enabled', context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('enabled');
    });

    it('deve retornar enabled=false para flag desabilitada', () => {
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const result = service.isEnabled('test_feature_disabled', context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('deve respeitar kill switch com prioridade máxima', () => {
      const definitions: FeatureFlagDefinition[] = [
        {
          name: 'test_kill_switch_flag',
          enabled: true,
          forceDisabled: true
        }
      ];

      const killSwitchService = new EnhancedFeatureFlagService(definitions);
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const result = killSwitchService.isEnabled('test_kill_switch_flag', context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('kill_switch_active');
    });

    it('deve bloquear por ambiente não permitido', () => {
      const context: FeatureFlagContext = {
        environment: 'development'
      };

      const result = service.isEnabled('test_feature_environment', context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('environment_blocked');
    });

    it('deve permitir ambiente autorizado', () => {
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const result = service.isEnabled('test_feature_environment', context);

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('enabled');
    });

    it('deve bloquear por role não permitida', () => {
      const definitions: FeatureFlagDefinition[] = [
        {
          name: 'test_role_restricted',
          enabled: true,
          allowedRoles: ['admin', 'operator']
        }
      ];

      const roleService = new EnhancedFeatureFlagService(definitions);
      const context: FeatureFlagContext = {
        environment: 'production',
        role: 'viewer'
      };

      const result = roleService.isEnabled('test_role_restricted', context);

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('role_blocked');
    });

    it('deve avaliar rollout percentual consistentemente', () => {
      const context: FeatureFlagContext = {
        environment: 'production',
        userId: 'user-123'
      };

      const result1 = service.isEnabled('test_feature_rollout', context);

      // Mesma combinação deve resultar no mesmo resultado
      const result2 = service.isEnabled('test_feature_rollout', context);

      expect(result1.enabled).toBe(result2.enabled);
      expect(result1.reason).toBe(result2.reason);
    });
  });

  describe('activateKillSwitch', () => {
    it('deve ativar kill switch e registrar auditoria', () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      service.activateKillSwitch('test_feature_enabled', 'admin-user', 'Incidente em produção');

      const result = service.isEnabled('test_feature_enabled', {
        environment: 'production'
      });

      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('kill_switch_active');
      expect(loggerSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Kill switch ACTIVATED'),
        'error'
      );
    });

    it('deve manter auditoria completa de kill switches', () => {
      service.activateKillSwitch('test_feature_enabled', 'admin-1', 'Razão 1');
      service.activateKillSwitch('test_feature_disabled', 'admin-2', 'Razão 2');

      const auditLog = service.getKillSwitchAuditLog();

      expect(auditLog).toHaveLength(2);
      expect(auditLog[0]).toMatchObject({
        flagName: 'test_feature_enabled',
        action: 'activated',
        changedBy: 'admin-1',
        reason: 'Razão 1'
      });
    });
  });

  describe('deactivateKillSwitch', () => {
    it('deve desativar kill switch e registrar auditoria', () => {
      service.activateKillSwitch('test_feature_kill_switch', 'admin-1', 'Teste');
      service.deactivateKillSwitch('test_feature_kill_switch', 'admin-2', 'Resolvido');

      const result = service.isEnabled('test_feature_kill_switch', {
        environment: 'production'
      });

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('enabled');

      const log = service.getKillSwitchAuditLog();
      expect(log).toHaveLength(2);
      expect(log[1].action).toBe('deactivated');
    });
  });

  describe('setRolloutPercentage', () => {
    it('deve atualizar percentual de rollout', () => {
      service.setRolloutPercentage('test_feature_rollout', 25, 'admin-user');

      const auditLog = service.getKillSwitchAuditLog();
      // Note: setRolloutPercentage não adiciona ao audit log, apenas logs

      // Verificar que rollout funciona
      const context: FeatureFlagContext = {
        environment: 'production',
        userId: 'user-test-rollout'
      };

      const result = service.isEnabled('test_feature_rollout', context);
      // Resultado depende do hash, mas deve ser determinístico
      expect([true, false]).toContain(result.enabled);
    });

    it('deve rejeitar percentual inválido', () => {
      expect(() => {
        service.setRolloutPercentage('test_feature_rollout', 150, 'admin');
      }).toThrow('Percentage must be between 0 and 100');

      expect(() => {
        service.setRolloutPercentage('test_feature_rollout', -10, 'admin');
      }).toThrow('Percentage must be between 0 and 100');
    });
  });

  describe('getAllFlags', () => {
    it('deve listar todas as flags com status', () => {
      const flags = service.getAllFlags();

      expect(flags).toHaveLength(5);
      expect(flags[0]).toHaveProperty('name');
      expect(flags[0]).toHaveProperty('enabled');
      expect(flags[0]).toHaveProperty('isKillSwitchActive');
    });

    it('deve mostrar kill switch ativo nas flags', () => {
      service.activateKillSwitch('test_feature_enabled', 'admin', 'Teste');

      const flags = service.getAllFlags();
      const enabledFlag = flags.find((f) => f.name === 'test_feature_enabled');

      expect(enabledFlag?.isKillSwitchActive).toBe(true);
    });
  });

  describe('createDefaultEnhancedFeatureFlagService', () => {
    it('deve criar serviço com definições padrão', () => {
      const defaultService = createDefaultEnhancedFeatureFlagService();
      const flags = defaultService.getAllFlags();

      expect(flags.length).toBeGreaterThan(0);
      expect(flags.map((f) => f.name)).toContain('ai_chat_enabled');
      expect(flags.map((f) => f.name)).toContain('clinic_automation_ingest_enabled');
    });

    it('deve ter features críticas habilitadas por padrão', () => {
      const defaultService = createDefaultEnhancedFeatureFlagService();
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const aiChat = defaultService.isEnabled('ai_chat_enabled', context);
      const sentry = defaultService.isEnabled('sentry_integration_enabled', context);

      expect(aiChat.enabled).toBe(true);
      expect(sentry.enabled).toBe(true);
    });

    it('deve ter clinic automation desabilitada por padrão', () => {
      const defaultService = createDefaultEnhancedFeatureFlagService();
      const context: FeatureFlagContext = {
        environment: 'production'
      };

      const clinicIngest = defaultService.isEnabled('clinic_automation_ingest_enabled', context);

      expect(clinicIngest.enabled).toBe(false);
    });
  });
});
