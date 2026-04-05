import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import FeatureFlagService from '../../src/services/featureFlags/featureFlagService';
import { Feature, FeatureFlagContext } from '../../src/services/featureFlags/types';

describe('FeatureFlagService', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('FEATURE_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('should return true for enabled feature by default', () => {
      const result = FeatureFlagService.isEnabled(Feature.AI_CHAT);
      expect(result).toBe(true);
    });

    it('should return false for disabled feature by default (Open Finance)', () => {
      const result = FeatureFlagService.isEnabled(Feature.OPEN_FINANCE);
      expect(result).toBe(false);
    });

    it('should override default with environment variable true', () => {
      process.env.FEATURE_OPEN_FINANCE = 'true';
      const result = FeatureFlagService.isEnabled(Feature.OPEN_FINANCE);
      expect(result).toBe(true);
    });

    it('should override default with environment variable false', () => {
      process.env.FEATURE_AI_CHAT = 'false';
      const result = FeatureFlagService.isEnabled(Feature.AI_CHAT);
      expect(result).toBe(false);
    });

    it('should ignore non-boolean environment values and use default', () => {
      process.env.FEATURE_AI_CHAT = 'maybe';
      const result = FeatureFlagService.isEnabled(Feature.AI_CHAT);
      expect(result).toBe(true); // default
    });

    it('should respect context overrides (enterprise Open Finance)', () => {
      const context: FeatureFlagContext = {
        userId: 'user-1',
        plan: 'enterprise',
      };
      const result = FeatureFlagService.isEnabled(Feature.OPEN_FINANCE, context);
      expect(result).toBe(true); // enterprise can override
    });

    it('should not override env var with context', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      const context: FeatureFlagContext = {
        userId: 'user-1',
        plan: 'enterprise',
      };
      const result = FeatureFlagService.isEnabled(Feature.OPEN_FINANCE, context);
      expect(result).toBe(false); // env var takes priority
    });
  });

  describe('getAllFlags', () => {
    it('should return all feature flags with their current state', () => {
      const flags = FeatureFlagService.getAllFlags();
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.some((f) => f.feature === Feature.OPEN_FINANCE)).toBe(true);
      expect(flags.some((f) => f.feature === Feature.AI_CHAT)).toBe(true);
    });

    it('should include reason for each flag', () => {
      const flags = FeatureFlagService.getAllFlags();
      flags.forEach((flag) => {
        expect(flag.reason).toBeDefined();
        expect(typeof flag.reason).toBe('string');
      });
    });

    it('should reflect env var changes in getAllFlags', () => {
      process.env.FEATURE_OPEN_FINANCE = 'true';
      const flags = FeatureFlagService.getAllFlags();
      const openFinanceFlag = flags.find((f) => f.feature === Feature.OPEN_FINANCE);
      expect(openFinanceFlag?.enabled).toBe(true);
    });
  });

  describe('requireFeature', () => {
    it('should not throw for enabled feature', () => {
      expect(() => {
        FeatureFlagService.requireFeature(Feature.AI_CHAT);
      }).not.toThrow();
    });

    it('should throw for disabled feature', () => {
      expect(() => {
        FeatureFlagService.requireFeature(Feature.OPEN_FINANCE);
      }).toThrow('Feature OPEN_FINANCE is not enabled');
    });

    it('should throw with context for disabled feature', () => {
      process.env.FEATURE_AI_OCR = 'false';
      expect(() => {
        FeatureFlagService.requireFeature(Feature.AI_OCR, {
          userId: 'user-1',
          plan: 'free',
        });
      }).toThrow('Feature AI_OCR is not enabled');
    });
  });

  describe('logDecision', () => {
    it('should log feature flag decision', () => {
      // Just verify the method doesn't throw - logger.info is mocked in test setup
      expect(() => {
        FeatureFlagService.logDecision(Feature.AI_CHAT, 'test-action', {
          userId: 'user-1',
          workspaceId: 'ws-1',
        });
      }).not.toThrow();
    });
  });

  describe('Feature flag combinations', () => {
    it('should handle multiple flags with different states', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      process.env.FEATURE_AI_CHAT = 'true';
      process.env.FEATURE_AI_ANALYSIS = 'true';

      expect(FeatureFlagService.isEnabled(Feature.OPEN_FINANCE)).toBe(false);
      expect(FeatureFlagService.isEnabled(Feature.AI_CHAT)).toBe(true);
      expect(FeatureFlagService.isEnabled(Feature.AI_ANALYSIS)).toBe(true);
    });

    it('should support SaaS features for cost optimization', () => {
      const flags = FeatureFlagService.getAllFlags();
      const saasFlagS = flags.filter((f) =>
        [Feature.SAAS_MULTI_TENANT, Feature.SAAS_BILLING].includes(f.feature)
      );
      saasFlagS.forEach((flag) => {
        expect(flag.enabled).toBe(true); // SaaS features ON by default
      });
    });

    it('should support AI tiers (chat lightweight, analysis heavyweight)', () => {
      expect(FeatureFlagService.isEnabled(Feature.AI_CHAT)).toBe(true);
      expect(FeatureFlagService.isEnabled(Feature.AI_ANALYSIS)).toBe(true);
      // Both can be disabled independently if needed
      process.env.FEATURE_AI_ANALYSIS = 'false';
      expect(FeatureFlagService.isEnabled(Feature.AI_ANALYSIS)).toBe(false);
      expect(FeatureFlagService.isEnabled(Feature.AI_CHAT)).toBe(true); // unaffected
    });
  });

  describe('Real-world scenarios', () => {
    it('scenario: disable Open Finance in production while keeping Core features', () => {
      process.env.NODE_ENV = 'production';
      process.env.FEATURE_OPEN_FINANCE = 'false';

      expect(FeatureFlagService.isEnabled(Feature.OPEN_FINANCE)).toBe(false);
      expect(FeatureFlagService.isEnabled(Feature.AI_CHAT)).toBe(true);
      expect(FeatureFlagService.isEnabled(Feature.STRIPE_PAYMENTS)).toBe(true);
    });

    it('scenario: enable Open Finance for enterprise plan only', () => {
      // Note: Without env var, context rules can override (OPEN_FINANCE defaults to false)
      // If env var is set, it takes precedence over context
      const enterpriseCtx: FeatureFlagContext = { plan: 'enterprise' };
      const freeCtx: FeatureFlagContext = { plan: 'free' };

      // Without explicit env var, context rules apply
      expect(FeatureFlagService.isEnabled(Feature.OPEN_FINANCE, enterpriseCtx)).toBe(true); // enterprise overrides
      expect(FeatureFlagService.isEnabled(Feature.OPEN_FINANCE, freeCtx)).toBe(false); // no override

      // With explicit env var=false, context is ignored
      process.env.FEATURE_OPEN_FINANCE = 'false';
      expect(FeatureFlagService.isEnabled(Feature.OPEN_FINANCE, enterpriseCtx)).toBe(false); // env var takes precedence
    });

    it('scenario: kill switch - disable all AI features to handle outage', () => {
      process.env.FEATURE_AI_CHAT = 'false';
      process.env.FEATURE_AI_ANALYSIS = 'false';
      process.env.FEATURE_AI_OCR = 'false';

      expect(FeatureFlagService.isEnabled(Feature.AI_CHAT)).toBe(false);
      expect(FeatureFlagService.isEnabled(Feature.AI_ANALYSIS)).toBe(false);
      expect(FeatureFlagService.isEnabled(Feature.AI_OCR)).toBe(false);
      // Core features unaffected
      expect(FeatureFlagService.isEnabled(Feature.STRIPE_PAYMENTS)).toBe(true);
    });
  });
});
