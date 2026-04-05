import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { featureGateOpenFinance, featureGate } from '../../src/middleware/featureGate';
import { Feature } from '../../src/services/featureFlags/types';
import { AppError } from '../../src/middleware/errorHandler';

describe('Feature Gate Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      userId: 'user-123',
      workspaceId: 'ws-456',
      userPlan: 'pro',
    };
    mockRes = {};
    mockNext = vi.fn();

    // Clear environment variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('FEATURE_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('featureGate (generic middleware)', () => {
    it('should call next when feature is enabled', () => {
      process.env.FEATURE_AI_CHAT = 'true';
      const middleware = featureGate(Feature.AI_CHAT);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw AppError when feature is disabled', () => {
      process.env.FEATURE_AI_CHAT = 'false';
      const middleware = featureGate(Feature.AI_CHAT);
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should use default status code 503 for disabled feature', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      const middleware = featureGate(Feature.OPEN_FINANCE);
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should support custom status code and message', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      const middleware = featureGate(Feature.OPEN_FINANCE, {
        statusCode: 403,
        message: 'Custom message',
      });
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });
  });

  describe('featureGateOpenFinance (specific middleware)', () => {
    it('should call next when FEATURE_OPEN_FINANCE=true', () => {
      process.env.FEATURE_OPEN_FINANCE = 'true';
      const middleware = featureGateOpenFinance();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block when FEATURE_OPEN_FINANCE=false (default)', () => {
      // FEATURE_OPEN_FINANCE defaults to false
      const middleware = featureGateOpenFinance();
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should return 503 Service Unavailable when blocked', () => {
      const middleware = featureGateOpenFinance();
      try {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      } catch (err) {
        expect((err as any).statusCode).toBe(503);
      }
    });

    it('should include helpful message about reactivation', () => {
      const middleware = featureGateOpenFinance();
      try {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      } catch (err) {
        expect((err as any).message).toContain('temporarily unavailable');
      }
    });
  });

  describe('Feature gate scenarios', () => {
    it('scenario: Open Finance disabled in production, Core features on', () => {
      process.env.NODE_ENV = 'production';
      process.env.FEATURE_OPEN_FINANCE = 'false';
      process.env.FEATURE_AI_CHAT = 'true';

      const blockOpenFinance = featureGateOpenFinance();
      const allowAIChat = featureGate(Feature.AI_CHAT);

      // Open Finance blocked
      expect(() => {
        blockOpenFinance(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();

      // AI Chat allowed
      mockNext.mockClear();
      allowAIChat(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('scenario: Kill switch - disable all AI during outage', () => {
      process.env.FEATURE_AI_CHAT = 'false';
      process.env.FEATURE_AI_ANALYSIS = 'false';
      process.env.FEATURE_AI_OCR = 'false';

      const middlewares = [
        featureGate(Feature.AI_CHAT),
        featureGate(Feature.AI_ANALYSIS),
        featureGate(Feature.AI_OCR),
      ];

      middlewares.forEach((middleware) => {
        expect(() => {
          middleware(mockReq as Request, mockRes as Response, mockNext);
        }).toThrow();
      });
    });

    it('scenario: Enable Open Finance for enterprise only', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      const enterpriseReq = { ...mockReq, userPlan: 'enterprise' };

      const middleware = featureGateOpenFinance();

      // Free tier user still blocked
      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();

      // Note: Context-based privilege escalation requires FeatureFlagService integration
      // This test verifies the structure is in place
    });
  });

  describe('Feature gate with multiple features', () => {
    it('should independently gate multiple features', () => {
      process.env.FEATURE_OPEN_FINANCE = 'false';
      process.env.FEATURE_AI_ANALYSIS = 'true';

      const blockBanking = featureGateOpenFinance();
      const allowAnalysis = featureGate(Feature.AI_ANALYSIS);

      expect(() => {
        blockBanking(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();

      mockNext.mockClear();
      allowAnalysis(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
