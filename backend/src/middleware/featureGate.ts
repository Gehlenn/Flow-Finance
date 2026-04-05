import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import FeatureFlagService from '../services/featureFlags/featureFlagService';
import { Feature, FeatureFlagContext } from '../services/featureFlags/types';
import logger from '../config/logger';

/**
 * Generic feature gate middleware
 * Blocks access to routes behind disabled features
 * 
 * Usage:
 *   router.use(featureGate(Feature.OPEN_FINANCE))
 *   router.post('/connect-bank', ...)
 */
export function featureGate(
  feature: Feature,
  options?: {
    statusCode?: number;
    message?: string;
  }
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context: FeatureFlagContext = {
      userId: (req as any).userId,
      workspaceId: (req as any).workspaceId,
      plan: (req as any).userPlan,
      environment: (process.env.NODE_ENV as any) || 'development',
    };

    const isEnabled = FeatureFlagService.isEnabled(feature, context);

    FeatureFlagService.logDecision(feature, `route-access`, context);

    if (!isEnabled) {
      const statusCode = options?.statusCode || 503;
      const message =
        options?.message ||
        `Feature ${feature} is not available. ` +
        'We are working to bring this functionality back soon. Thank you for your patience!';

      const error = new AppError(statusCode, message);

      logger.warn(`Feature gate blocked: ${feature}`, {
        feature,
        userId: (req as any).userId,
        statusCode,
      });

      throw error;
    }

    next();
  };
}

/**
 * Specific middleware for Open Finance feature gate
 * Preserves backward compatibility with existing code
 * 
 * Upgrade: now uses centralized FeatureFlagService
 * Env vars: FEATURE_OPEN_FINANCE=true/false (replaces DISABLE_OPEN_FINANCE)
 * 
 * Razão: Open Finance via Pluggy custava >R$ 1.000/mês mantendo app inviável
 * Status: Será reativado quando receita justificar o custo
 */
export function featureGateOpenFinance(
  options?: { statusCode?: number; message?: string }
): (req: Request, res: Response, next: NextFunction) => void {
  return featureGate(Feature.OPEN_FINANCE, {
    statusCode: options?.statusCode || 503,
    message:
      options?.message ||
      'Open Finance integration is temporarily unavailable. ' +
      'We are working to make this feature cost-effective and will re-enable it soon. ' +
      'Your core financial tracking continues to work normally.',
  });
}

/**
 * Specific middleware for AI Chat feature gate
 */
export function featureGateAIChat(
  options?: { statusCode?: number; message?: string }
): (req: Request, res: Response, next: NextFunction) => void {
  return featureGate(Feature.AI_CHAT, {
    statusCode: options?.statusCode || 503,
    message: options?.message || 'AI Chat assistant is temporarily unavailable. Please try again later.',
  });
}

/**
 * Specific middleware for AI Analysis feature gate
 */
export function featureGateAIAnalysis(
  options?: { statusCode?: number; message?: string }
): (req: Request, res: Response, next: NextFunction) => void {
  return featureGate(Feature.AI_ANALYSIS, {
    statusCode: options?.statusCode || 503,
    message:
      options?.message || 'Deep financial analysis is temporarily unavailable. Please try again later.',
  });
}
