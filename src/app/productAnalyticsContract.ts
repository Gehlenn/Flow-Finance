import type { ProductAnalyticsEvent, ProductAnalyticsProperties } from './productAnalytics';

const SENSITIVE_PROPERTY_PATTERN = /(^id$|_id$|workspace|tenant|user|email|name|cpf|phone|telefone|address|endereco|document|token|cookie|password|secret)/i;

export const PRODUCT_ANALYTICS_ALLOWED_PROPERTIES = {
  activation_first_transaction: [
    'source',
    'created_count',
    'transaction_count',
  ],
  activation_first_dashboard_useful: [
    'transactions_count',
    'inflow_month',
    'outflow_month',
    'pending_revenue_month',
    'overdue_revenue_amount',
  ],
  activation_financial_base_completed: [
    'source',
    'completed_steps',
    'has_initial_balance',
    'has_inflow',
    'has_outflow',
    'has_receivable',
  ],
  ai_question_submitted: [
    'source',
    'intent',
    'question_type',
    'plan',
    'action_required',
    'base_sufficiency',
    'confidence_band',
    'response_depth',
    'grounded',
    'has_financial_context',
    'has_recent_transactions',
  ],
  ai_consultation_completed: [
    'source',
    'mode',
    'intent',
    'plan',
    'confidence',
    'confidence_band',
    'response_depth',
    'base_sufficiency',
    'action_required',
    'has_base',
    'has_required_action',
    'grounded',
  ],
  ai_response_action_created: [
    'source',
    'intent',
    'action_type',
    'target',
    'action_required',
    'base_sufficiency',
    'confidence_band',
    'response_depth',
    'grounded',
    'priority',
    'plan',
  ],
  ai_response_flow_opened: [
    'source',
    'intent',
    'flow',
    'target',
    'action_required',
    'base_sufficiency',
    'confidence_band',
    'response_depth',
    'grounded',
    'plan',
  ],
  ai_fallback_observed: [
    'source',
    'intent',
    'reason',
    'fallback_kind',
    'response_depth',
    'grounded',
    'plan',
  ],
  weekly_cash_review_completed: [
    'source',
    'week_start',
    'outcome',
    'has_overdue_receivables',
    'transaction_count',
    'receivable_count',
  ],
  billing_checkout_started: [
    'source',
    'plan',
  ],
  billing_checkout_redirected: [
    'source',
    'plan',
  ],
  billing_checkout_failed: [
    'source',
    'plan',
    'reason',
    'error_type',
  ],
  billing_portal_started: [
    'source',
    'plan',
  ],
  billing_portal_redirected: [
    'source',
    'plan',
  ],
  billing_portal_failed: [
    'source',
    'plan',
    'reason',
    'error_type',
  ],
  integration_error_observed: [
    'source',
    'integration',
    'stage',
    'resource',
    'active_tab',
    'plan',
    'reason',
  ],
} as const satisfies Record<ProductAnalyticsEvent, readonly string[]>;

export const PRODUCT_ANALYTICS_EVENTS = Object.keys(PRODUCT_ANALYTICS_ALLOWED_PROPERTIES) as ProductAnalyticsEvent[];

export function isSensitiveAnalyticsProperty(key: string): boolean {
  return SENSITIVE_PROPERTY_PATTERN.test(key);
}

export function sanitizeAnalyticsPropertiesForEvent(
  eventName: ProductAnalyticsEvent,
  properties: ProductAnalyticsProperties = {},
): ProductAnalyticsProperties {
  const allowed = new Set<string>(PRODUCT_ANALYTICS_ALLOWED_PROPERTIES[eventName]);

  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (!allowed.has(key)) return false;
      if (isSensitiveAnalyticsProperty(key)) return false;

      return (
        value === null
        || value === undefined
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean'
      );
    }),
  );
}
