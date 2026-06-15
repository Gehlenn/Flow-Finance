import { describe, expect, it } from 'vitest';

import {
  PRODUCT_ANALYTICS_ALLOWED_PROPERTIES,
  PRODUCT_ANALYTICS_EVENTS,
  isSensitiveAnalyticsProperty,
  sanitizeAnalyticsPropertiesForEvent,
} from '../../src/app/productAnalyticsContract';
import type { ProductAnalyticsEvent } from '../../src/app/productAnalytics';

describe('productAnalyticsContract', () => {
  const declaredEvents: ProductAnalyticsEvent[] = [
    'activation_first_transaction',
    'activation_first_dashboard_useful',
    'activation_financial_base_completed',
    'ai_question_submitted',
    'ai_consultation_completed',
    'ai_response_action_created',
    'ai_response_flow_opened',
    'ai_fallback_observed',
    'weekly_cash_review_completed',
    'billing_checkout_started',
    'billing_checkout_redirected',
    'billing_checkout_failed',
    'billing_portal_started',
    'billing_portal_redirected',
    'billing_portal_failed',
    'integration_error_observed',
  ];

  it('covers every declared product analytics event', () => {
    expect([...PRODUCT_ANALYTICS_EVENTS].sort()).toEqual([...declaredEvents].sort());
    for (const eventName of declaredEvents) {
      expect(PRODUCT_ANALYTICS_ALLOWED_PROPERTIES[eventName]).toBeDefined();
    }
  });

  it('blocks sensitive analytics property names', () => {
    for (const key of [
      'workspace_id',
      'user_id',
      'user_email',
      'customer_name',
      'cpf',
      'phone',
      'token',
      'cookie',
      'password',
      'secret',
    ]) {
      expect(isSensitiveAnalyticsProperty(key)).toBe(true);
    }
  });

  it('keeps only allowed primitive properties for each event', () => {
    const sanitized = sanitizeAnalyticsPropertiesForEvent('activation_financial_base_completed', {
      source: 'dashboard_activation',
      completed_steps: 4,
      has_initial_balance: true,
      has_inflow: true,
      workspace_id: 'ws-1',
      unexpected: 'drop-me',
      nested: { unsafe: true } as never,
    });

    expect(sanitized).toEqual({
      source: 'dashboard_activation',
      completed_steps: 4,
      has_initial_balance: true,
      has_inflow: true,
    });
  });
});
