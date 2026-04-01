import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAIOrchestrator } from '../../src/engines/ai/aiOrchestrator';
import { AppError } from '../../src/errors/AppError';
import { financialPatternDetector } from '../../src/engines/finance/patternDetector/financialPatternDetector';
import { clearAIMetrics, getAIMetrics } from '../../src/observability/aiMetrics';
import {
  assertCanPerform,
  assertFeatureEnabled,
  assertWithinPlanLimit,
  getPlanFeatures,
  hasFeature,
  SaaSContext,
} from '../../src/saas';
import { Category, TransactionType } from '../../types';

describe('saas policy engine hardening', () => {
  const memberContext: SaaSContext = {
    userId: 'user_1',
    role: 'member',
    plan: 'free',
  };

  it('assertCanPerform lança AppError com 403 para permissão negada', () => {
    expect(() => assertCanPerform(memberContext, 'admin:dangerous')).toThrow(AppError);

    try {
      assertCanPerform(memberContext, 'admin:dangerous');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.statusCode).toBe(403);
      expect(appError.details).toMatchObject({ permission: 'admin:dangerous', role: 'member' });
    }
  });

  it('assertWithinPlanLimit lança AppError com 429 quando estoura limite', () => {
    expect(() => assertWithinPlanLimit(memberContext, 'bankConnections', 1)).toThrow(AppError);

    try {
      assertWithinPlanLimit(memberContext, 'bankConnections', 1);
    } catch (error) {
      const appError = error as AppError;
      expect(appError.statusCode).toBe(429);
      expect(appError.details).toMatchObject({ resource: 'bankConnections', limit: 1, plan: 'free' });
    }
  });

  it('controla features por plano e role', () => {
    expect(getPlanFeatures('free')).toContain('advancedInsights');
    expect(getPlanFeatures('free')).not.toContain('multiBankSync');
    expect(hasFeature(memberContext, 'multiBankSync')).toBe(false);
    expect(() => assertFeatureEnabled(memberContext, 'multiBankSync')).toThrow(AppError);

    const adminContext: SaaSContext = {
      userId: 'admin_1',
      role: 'admin',
      plan: 'free',
    };

    expect(hasFeature(adminContext, 'adminConsole')).toBe(true);
    expect(() => assertFeatureEnabled(adminContext, 'adminConsole')).not.toThrow();
  });
});

describe('ai orchestrator observability', () => {
  beforeEach(() => {
    clearAIMetrics();
    vi.restoreAllMocks();
  });

  it('registra métricas de chamada e latência quando execução tem sucesso', async () => {
    await runAIOrchestrator({
      userContext: {
        userId: 'u_metrics',
        accounts: ['acc_1'],
        timezone: 'UTC',
        currency: 'BRL',
      },
      transactions: [
        {
          id: 't1',
          amount: 3000,
          type: TransactionType.RECEITA,
          category: Category.PESSOAL,
          description: 'Salario',
          date: '2026-03-10T12:00:00.000Z',
        },
        {
          id: 't2',
          amount: 1200,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Moradia',
          date: '2026-03-11T12:00:00.000Z',
          merchant: 'Condominio',
        },
      ],
    });

    expect(getAIMetrics('ai_call')).toHaveLength(1);
    const latencies = getAIMetrics('ai_latency');
    expect(latencies).toHaveLength(1);
    expect(latencies[0].value).toBeGreaterThanOrEqual(0);
    expect(getAIMetrics('ai_error')).toHaveLength(0);
  });

  it('registra métrica de erro quando o orquestrador falha', async () => {
    vi.spyOn(financialPatternDetector, 'detectPatterns').mockImplementation(() => {
      throw new Error('forced failure');
    });

    await expect(
      runAIOrchestrator({
        userContext: {
          userId: 'u_fail',
          accounts: ['acc_1'],
          timezone: 'UTC',
          currency: 'BRL',
        },
        transactions: [],
      })
    ).rejects.toThrow('forced failure');

    expect(getAIMetrics('ai_call')).toHaveLength(1);
    expect(getAIMetrics('ai_error')).toHaveLength(1);
    expect(getAIMetrics('ai_latency')).toHaveLength(1);
  });
});
