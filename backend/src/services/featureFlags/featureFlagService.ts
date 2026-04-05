import logger from '../../config/logger';
import { Feature, FeatureFlagConfig, FeatureFlagContext } from './types';

/**
 * Centralized Feature Flag Service
 * - Manages feature availability across the application
 * - Reads from environment variables (simple, ops-friendly)
 * - Supports per-context overrides (future: database, redis)
 * - Logs decisions for audit trail
 */
export class FeatureFlagService {
  /**
   * Default feature states (all experimental/expensive features OFF by default)
   * Can be overridden via environment variables
   * 
   * Naming convention: FEATURE_<FLAG_NAME>=true/false
   */
  private static readonly DEFAULTS: Record<Feature, boolean> = {
    [Feature.OPEN_FINANCE]: false,          // Expensive (~R$1000+/month), future-ready
    [Feature.AI_CHAT]: true,                // Core feature, cheap model
    [Feature.AI_ANALYSIS]: true,            // Should be available but quota-limited
    [Feature.AI_OCR]: true,                 // Receipt scanning enabled
    [Feature.STRIPE_PAYMENTS]: true,        // Payment processing core
    [Feature.SAAS_MULTI_TENANT]: true,      // SaaS architecture (foundational)
    [Feature.SAAS_BILLING]: true,           // Billing system on
    [Feature.SENTRY_INTEGRATION]: true,     // Observability critical
    [Feature.HEALTH_CHECKS]: true,          // Operations critical
    [Feature.EXTERNAL_INTEGRATIONS]: true,  // Future integrations (consultório, etc)
  };

  /**
   * Get feature flag state
   * Priority: env var > context override > default
   */
  static isEnabled(feature: Feature, context?: FeatureFlagContext): boolean {
    const envVar = this.getEnvVarName(feature);
    const envValue = process.env[envVar];

    // Explicit environment variable takes precedence
    if (envValue === 'true') return true;
    if (envValue === 'false') return false;

    // Check context-specific overrides if provided
    if (context?.userId || context?.workspaceId || context?.plan) {
      const contextOverride = this.evaluateContextRules(feature, context);
      if (contextOverride !== null) {
        return contextOverride;
      }
    }

    // Fall back to default
    return this.DEFAULTS[feature];
  }

  /**
   * Get all feature flags with their current state
   * Useful for debug endpoints, dashboard, etc
   */
  static getAllFlags(context?: FeatureFlagContext): FeatureFlagConfig[] {
    return Object.values(Feature).map((feature) => ({
      feature,
      enabled: this.isEnabled(feature, context),
      reason: this.getReasonForFeature(feature),
    }));
  }

  /**
   * Assert feature is enabled, throw if not
   * Useful for early validation in handlers
   */
  static requireFeature(feature: Feature, context?: FeatureFlagContext): void {
    if (!this.isEnabled(feature, context)) {
      throw new Error(`Feature ${feature} is not enabled`);
    }
  }

  /**
   * Log feature flag decision for audit trail
   */
  static logDecision(
    feature: Feature,
    action: string,
    context: FeatureFlagContext = {}
  ): void {
    const isEnabled = this.isEnabled(feature, context);
    logger.info(`Feature flag decision: ${feature}=${isEnabled} for ${action}`, {
      feature,
      isEnabled,
      userId: context.userId,
      workspaceId: context.workspaceId,
      plan: context.plan,
      action,
    });
  }

  /**
   * Evaluate context-specific rules
   * E.g., OPEN_FINANCE only for enterprise plan, etc
   * Returns null if no override applies (use default)
   */
  private static evaluateContextRules(
    feature: Feature,
    context: FeatureFlagContext
  ): boolean | null {
    // Example: OPEN_FINANCE available only for enterprise
    if (feature === Feature.OPEN_FINANCE && context.plan === 'enterprise') {
      return true;
    }

    // Example: AI features limited in free tier (but still available)
    if (feature === Feature.AI_ANALYSIS && context.plan === 'free') {
      return true; // enabled but quota-limited by middleware
    }

    return null; // no override, use default
  }

  /**
   * Get human-readable reason for feature state
   */
  private static getReasonForFeature(feature: Feature): string {
    const reasons: Record<Feature, string> = {
      [Feature.OPEN_FINANCE]: 'Cost-optimization: expensive Pluggy integration (future SaaS feature)',
      [Feature.AI_CHAT]: 'Core feature: lightweight conversational AI enabled',
      [Feature.AI_ANALYSIS]: 'Core feature: deep analysis enabled (quota-limited)',
      [Feature.AI_OCR]: 'Core feature: receipt scanning enabled',
      [Feature.STRIPE_PAYMENTS]: 'Core feature: payment processing enabled',
      [Feature.SAAS_MULTI_TENANT]: 'Foundational: SaaS architecture enabled',
      [Feature.SAAS_BILLING]: 'SaaS: billing system enabled',
      [Feature.SENTRY_INTEGRATION]: 'Critical: error tracking enabled',
      [Feature.HEALTH_CHECKS]: 'Critical: operational health checks enabled',
      [Feature.EXTERNAL_INTEGRATIONS]: 'Future: external integrations enabled',
    };
    return reasons[feature];
  }

  /**
   * Convert feature enum to environment variable name
   * E.g., OPEN_FINANCE -> FEATURE_OPEN_FINANCE
   */
  private static getEnvVarName(feature: Feature): string {
    return `FEATURE_${feature}`;
  }
}

export default FeatureFlagService;
