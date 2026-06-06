import { describe, expect, it } from 'vitest';

import {
  canAccessFeature,
  FREE_LIMITS,
  getFeaturesByTier,
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

  it('identifica plano pro corretamente', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(null)).toBe(false);
  });
});
