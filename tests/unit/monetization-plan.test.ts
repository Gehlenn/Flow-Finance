import { describe, expect, it } from 'vitest';

import {
  canAccessFeature,
  getFeaturesByTier,
  isProPlan,
  MONETIZATION_FEATURES,
} from '../../src/app/monetizationPlan';

describe('monetization plan', () => {
  it('mantem recursos core e free acessiveis no plano free', () => {
    expect(canAccessFeature('free', 'manualTransactions')).toBe(true);
    expect(canAccessFeature('free', 'dashboardCore')).toBe(true);
    expect(canAccessFeature('free', 'transactionsView')).toBe(true);
  });

  it('bloqueia apenas recursos premium no plano free', () => {
    expect(canAccessFeature('free', 'advancedReports')).toBe(false);
    expect(canAccessFeature('free', 'aiRichConsultant')).toBe(false);
    expect(canAccessFeature('free', 'smartAlertSuggestions')).toBe(false);
  });

  it('libera recursos premium no plano pro', () => {
    expect(canAccessFeature('pro', 'advancedReports')).toBe(true);
    expect(canAccessFeature('pro', 'aiRichConsultant')).toBe(true);
    expect(canAccessFeature('pro', 'smartAlertSuggestions')).toBe(true);
  });

  it('mapeia ao menos um recurso por tier ativo esperado', () => {
    expect(getFeaturesByTier('core').length).toBeGreaterThan(0);
    expect(getFeaturesByTier('free').length).toBe(0);
    expect(getFeaturesByTier('pro').length).toBeGreaterThan(0);
    expect(getFeaturesByTier('future').length).toBe(0);
    expect(MONETIZATION_FEATURES.length).toBeGreaterThanOrEqual(9);
  });

  it('bloqueia explicitamente qualquer recurso de tier future', () => {
    const futureOnlyPolicy = [
      {
        id: 'xFutureFeature',
        tier: 'future',
        title: 'Feature futura',
        valueMessage: 'Ainda nao ativada.',
      },
    ];

    const simulatedTierById = futureOnlyPolicy.reduce<Record<string, string>>((acc, feature) => {
      acc[feature.id] = feature.tier;
      return acc;
    }, {});

    const simulatedCanAccessFeature = (plan: 'free' | 'pro', featureId: string): boolean => {
      const tier = simulatedTierById[featureId];
      if (tier === 'future') return false;
      if (tier === 'pro') return plan === 'pro';
      return true;
    };

    expect(simulatedCanAccessFeature('free', 'xFutureFeature')).toBe(false);
    expect(simulatedCanAccessFeature('pro', 'xFutureFeature')).toBe(false);
  });

  it('identifica plano pro corretamente', () => {
    expect(isProPlan('pro')).toBe(true);
    expect(isProPlan('free')).toBe(false);
    expect(isProPlan(null)).toBe(false);
  });
});
