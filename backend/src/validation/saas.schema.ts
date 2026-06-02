import { z } from 'zod';
import logger from '../config/logger';

const UsageSnapshotSchema = z.object({
  transactions: z.number().int().min(0),
  aiQueries: z.number().int().min(0),
  bankConnections: z.number().int().min(0),
});

export const UsageUpsertSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  usage: z.record(z.string(), UsageSnapshotSchema),
});

export const UsageIncrementSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  resource: z.enum(['transactions', 'aiQueries', 'bankConnections']),
  amount: z.number().int().min(1).default(1),
  at: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UsageResetSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const BillingHookSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro']),
  event: z.enum(['usage_recorded', 'limit_reached', 'upgrade_required', 'plan_changed']),
  resource: z.enum(['transactions', 'aiQueries', 'bankConnections']).optional(),
  amount: z.number().min(0),
  at: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PlanChangeSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro']),
});

/**
 * Validates that a returnUrl is a valid URL restricted to allowed frontend origins.
 * Prevents open redirect attacks where an attacker could redirect users to external domains
 * after completing Stripe billing flows.
 */
function safeReturnUrl() {
  return z.string().url().refine(
    (url) => {
      try {
        const parsed = new URL(url);
        const frontendUrl = process.env.FRONTEND_URL ?? '';
        const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        const isDev = process.env.NODE_ENV !== 'production';

        if (isLocalhost && isDev) return true;

        if (frontendUrl) {
          try {
            if (parsed.origin === new URL(frontendUrl).origin) return true;
          } catch (err) {
            logger.warn({
              err,
              frontendUrl,
              frontendUrlLength: frontendUrl.length,
              fallback: 'saas-schema-malformed-frontend-url',
            }, 'Malformed FRONTEND_URL in CORS validation');
          }
        }

        return allowedOrigins.some((origin) => {
          try {
            return parsed.origin === new URL(origin).origin;
          } catch (err) {
            logger.debug({
              err,
              origin,
              originLength: origin.length,
              fallback: 'saas-schema-malformed-allowlist-origin',
            }, 'Malformed origin in CORS allowlist');
            return false;
          }
        });
      } catch (err) {
        logger.warn({
          err,
          urlLength: url.length,
          fallback: 'saas-schema-invalid-return-url',
        }, 'CORS origin validation exception — URL may be invalid');
        return false;
      }
    },
    { message: 'returnUrl must be a URL within the allowed frontend origins' },
  );
}

export const StripeCheckoutSchema = z.object({
  returnUrl: safeReturnUrl(),
});

export const StripePortalSchema = z.object({
  returnUrl: safeReturnUrl(),
});
