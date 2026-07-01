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
    'onboarding_started',
    'workspace_created',
    'transaction_imported',
    'forecast_viewed',
    'ai_insight_opened',
    'decision_saved',
    'return_visit',
    'weekly_review_completed',
    'weekly_cash_review_completed',
    'ai_question_submitted',
    'ai_consultation_completed',
    'ai_response_action_created',
    'ai_response_flow_opened',
    'ai_fallback_observed',
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
    const sanitized = sanitizeAnalyticsPropertiesForEvent('transaction_imported', {
      source: 'import_transactions',
      format: 'csv',
      imported_count: 2,
      selected_count: 2,
      duplicate_count: 0,
      error_count: 0,
      filename: 'extrato-janeiro.csv',
      workspace_id: 'ws-1',
      unexpected: 'drop-me',
      nested: { unsafe: true } as never,
    });

    expect(sanitized).toEqual({
      source: 'import_transactions',
      format: 'csv',
      imported_count: 2,
      selected_count: 2,
      duplicate_count: 0,
      error_count: 0,
    });
  });

  it('keeps the offline activation funnel observable without exposing identifiers', () => {
    const funnel = [
      {
        event: 'workspace_created',
        expectedProperties: ['source', 'plan', 'provisioning', 'is_default'],
        props: {
          source: 'workspace_session',
          plan: 'free',
          provisioning: 'backend',
          workspace_id: 'ws-1',
        },
      },
      {
        event: 'transaction_imported',
        expectedProperties: ['source', 'format', 'imported_count', 'selected_count', 'duplicate_count', 'error_count'],
        props: {
          source: 'import_transactions',
          format: 'csv',
          imported_count: 3,
          selected_count: 3,
          duplicate_count: 0,
          user_email: 'owner@example.com',
        },
      },
      {
        event: 'forecast_viewed',
        expectedProperties: ['source', 'timeframe', 'transaction_count', 'receivable_count', 'projected_receivables', 'has_receivables'],
        props: {
          source: 'cashflow',
          timeframe: '30d',
          transaction_count: 8,
          receivable_count: 2,
          projected_receivables: 4000,
          tenant_id: 'tenant-1',
        },
      },
      {
        event: 'ai_insight_opened',
        expectedProperties: ['source', 'item_type', 'insight_type', 'severity', 'plan'],
        props: {
          source: 'insights_page',
          item_type: 'insight',
          insight_type: 'negative_forecast',
          severity: 'high',
          customer_name: 'Cliente A',
        },
      },
      {
        event: 'decision_saved',
        expectedProperties: ['source', 'origin', 'decision_type', 'item_type', 'plan'],
        props: {
          source: 'insights_page',
          origin: 'risk_card',
          decision_type: 'reminder',
          item_type: 'risk',
          token: 'secret',
        },
      },
    ];

    expect(funnel.map((item) => item.event)).toEqual([
      'workspace_created',
      'transaction_imported',
      'forecast_viewed',
      'ai_insight_opened',
      'decision_saved',
    ]);

    for (const step of funnel) {
      expect(PRODUCT_ANALYTICS_EVENTS).toContain(step.event as ProductAnalyticsEvent);
      expect(PRODUCT_ANALYTICS_ALLOWED_PROPERTIES[step.event as ProductAnalyticsEvent]).toEqual(
        expect.arrayContaining(step.expectedProperties),
      );

      const sanitized = sanitizeAnalyticsPropertiesForEvent(
        step.event as ProductAnalyticsEvent,
        step.props,
      );

      expect(sanitized).not.toHaveProperty('workspace_id');
      expect(sanitized).not.toHaveProperty('tenant_id');
      expect(sanitized).not.toHaveProperty('user_email');
      expect(sanitized).not.toHaveProperty('customer_name');
      expect(sanitized).not.toHaveProperty('token');
      expect(Object.keys(sanitized).length).toBeGreaterThan(0);
    }
  });
});
