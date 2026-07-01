import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  canAccessFeature,
  FREE_LIMITS,
  formatAnnualPriceBRL,
  formatMonthlyPriceBRL,
  getPackagingEvidenceBoundary,
  getFeaturesByTier,
  getPlanFeatureMessages,
  getPlanPackaging,
  getUpgradePromptBullets,
  isProPlan,
  MONETIZATION_FEATURES,
  MONETIZATION_PRICING,
  withinFreeLimit,
} from '../../src/app/monetizationPlan';

describe('monetization plan', () => {
  it('mantem o core liberado no plano free', () => {
    expect(canAccessFeature('free', 'manualTransactions')).toBe(true);
    expect(canAccessFeature('free', 'dashboardCore')).toBe(true);
    expect(canAccessFeature('free', 'transactionsView')).toBe(true);
    expect(canAccessFeature('free', 'remindersCore')).toBe(true);
  });

  it('bloqueia recursos pro no free e libera no pro', () => {
    expect(canAccessFeature('free', 'unlimitedConsultorIa')).toBe(false);
    expect(canAccessFeature('free', 'multipleWorkspaces')).toBe(false);
    expect(canAccessFeature('free', 'advancedCashflowAnalysis')).toBe(false);

    expect(canAccessFeature('pro', 'unlimitedConsultorIa')).toBe(true);
    expect(canAccessFeature('pro', 'multipleWorkspaces')).toBe(true);
    expect(canAccessFeature('pro', 'advancedCashflowAnalysis')).toBe(true);
  });

  it('mantem exportacao de relatorios fora do Pro ate existir backend real', () => {
    expect(canAccessFeature('free', 'reportExport')).toBe(false);
    expect(canAccessFeature('pro', 'reportExport')).toBe(false);
  });

  it('aplica o limite do plano free no consultor IA', () => {
    expect(withinFreeLimit('free', 'consultorIaQueriesPerMonth', FREE_LIMITS.consultorIaQueriesPerMonth - 1)).toBe(true);
    expect(withinFreeLimit('free', 'consultorIaQueriesPerMonth', FREE_LIMITS.consultorIaQueriesPerMonth)).toBe(false);
    expect(withinFreeLimit('pro', 'consultorIaQueriesPerMonth', 9999)).toBe(true);
  });

  it('mantem a tabela de features e precos do S8', () => {
    expect(getFeaturesByTier('core').length).toBeGreaterThan(0);
    expect(getFeaturesByTier('pro').length).toBeGreaterThanOrEqual(3);
    expect(MONETIZATION_FEATURES.some((feature) => feature.id === 'unlimitedConsultorIa')).toBe(true);
    expect(MONETIZATION_PRICING.proMonthlyBRL).toBe(49);
    expect(MONETIZATION_PRICING.proAnnualBRL).toBe(490);
  });

  it('expoe contrato de packaging sem prometer prova comercial', () => {
    const freePackaging = getPlanPackaging('free');
    const proPackaging = getPlanPackaging('pro');

    expect(freePackaging).toMatchObject({
      label: 'Free',
      priceLabel: 'R$ 0',
      shortPositioning: 'Caixa basico para lancamento manual e revisao inicial.',
      limits: {
        workspaces: 1,
        consultorIaQueriesPerMonth: FREE_LIMITS.consultorIaQueriesPerMonth,
      },
    });
    expect(proPackaging).toMatchObject({
      label: 'Pro',
      priceLabel: 'R$ 49,00/mes',
      shortPositioning: 'Historico, relatorios e revisao semanal para operacoes de servico.',
      limits: {
        workspaces: 'multiple',
        consultorIaQueriesPerMonth: 'unlimited',
      },
      status: 'validation',
    });
    expect(getPlanFeatureMessages('free')).toEqual(
      expect.arrayContaining([
        'Leitura rapida de caixa confirmado, previsto, realizado e pendente.',
      ]),
    );
    expect(getPlanFeatureMessages('pro')).toEqual(
      expect.arrayContaining([
        'Mais historico de caixa e operacao para comparar previsto vs realizado sem resposta rasa.',
      ]),
    );
    expect(getUpgradePromptBullets()).toEqual([
      'Sem bloqueio mensal para revisar caixa, recebiveis e proximas saidas.',
      'Historico para comparar previsto vs realizado sem depender de memoria.',
      'Workspaces separados para operacoes, unidades ou clientes de servico.',
    ]);
    expect(formatMonthlyPriceBRL(MONETIZATION_PRICING.proMonthlyBRL)).toBe('R$ 49,00/mes');
    expect(formatAnnualPriceBRL(MONETIZATION_PRICING.proAnnualBRL)).toBe('R$ 490,00/ano');
    expect(getPackagingEvidenceBoundary()).toContain('billing real');
  });

  it('identifica plano pro corretamente', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(null)).toBe(false);
  });

  it('mantem o env example do backend alinhado ao preco Pro visivel', () => {
    const backendEnvExample = fs.readFileSync(path.resolve(process.cwd(), 'backend/.env.example'), 'utf8');

    expect(backendEnvExample).toContain(`SAAS_PRO_MONTHLY_PRICE_CENTS=${MONETIZATION_PRICING.proMonthlyBRL * 100}`);
    expect(backendEnvExample).toContain('STRIPE_PRICE_PRO_MONTHLY=');
    expect(backendEnvExample).toContain('STRIPE_LIVE_SMOKE_BACKEND_URL=');
    expect(backendEnvExample).toContain('STRIPE_LIVE_SMOKE_RETURN_URL=');
    expect(backendEnvExample).toContain('STRIPE_LIVE_SMOKE_WORKSPACE_ID=');
  });
});
