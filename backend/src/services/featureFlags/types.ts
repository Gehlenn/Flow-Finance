/**
 * Feature flag definitions and types for Flow Finance
 * All flags defined here with sensible defaults (false for expensive/experimental features)
 */

export enum Feature {
  // Open Finance / Pluggy integration (expensive, ~R$1000+/month, future-ready)
  OPEN_FINANCE = 'OPEN_FINANCE',

  // AI capabilities by tier (cost-optimization strategy)
  AI_CHAT = 'AI_CHAT',               // lightweight model for interactive chat
  AI_ANALYSIS = 'AI_ANALYSIS',       // heavier model for deep financial analysis
  AI_OCR = 'AI_OCR',                 // receipt scanning and OCR

  // Stripe integration (payment processing)
  STRIPE_PAYMENTS = 'STRIPE_PAYMENTS',

  // SaaS specific (multi-tenant, quotas, billing)
  SAAS_MULTI_TENANT = 'SAAS_MULTI_TENANT',
  SAAS_BILLING = 'SAAS_BILLING',

  // Observability & monitoring
  SENTRY_INTEGRATION = 'SENTRY_INTEGRATION',
  HEALTH_CHECKS = 'HEALTH_CHECKS',

  // External integrations (consultório, etc)
  EXTERNAL_INTEGRATIONS = 'EXTERNAL_INTEGRATIONS',
}

export interface FeatureFlagConfig {
  feature: Feature;
  enabled: boolean;
  reason?: string; // e.g., "cost-optimization", "beta", "deprecated"
}

export interface FeatureFlagContext {
  userId?: string;
  workspaceId?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  environment?: 'development' | 'staging' | 'production';
}
