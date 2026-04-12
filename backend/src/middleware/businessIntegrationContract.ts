import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import {
  authorizeExternalIntegrationRequest,
  sanitizeIntegrationHeaderValue,
} from './externalIntegrationAuth';

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

declare global {
  namespace Express {
    interface Request {
      businessIntegration?: {
        idempotencyKey?: string;
      };
    }
  }
}

function getFirstValidationMessage(error: ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'request payload is invalid';
  }

  const path = firstIssue.path.length ? `${firstIssue.path.join('.')}: ` : '';
  return `${path}${firstIssue.message}`;
}

function sanitizeIdempotencyKey(value: string | undefined): string | null {
  const normalized = sanitizeIntegrationHeaderValue(value);
  if (!normalized) {
    return value === undefined ? null : '';
  }

  if (normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return '';
  }

  return normalized;
}

export function businessIntegrationAuth(req: Request, res: Response, next: NextFunction): void {
  const authResult = authorizeExternalIntegrationRequest(req);
  if (!authResult.ok) {
    if (authResult.reason === 'not_configured') {
      res.status(503).json({
        ok: false,
        error: 'integration_unavailable',
        message: 'external integration is not configured',
      });
      return;
    }

    res.status(401).json({
      ok: false,
      error: 'unauthorized',
      message: 'integration credentials are invalid',
    });
    return;
  }

  const rawIdempotencyKey = req.header('Idempotency-Key');
  const idempotencyKey = sanitizeIdempotencyKey(rawIdempotencyKey);

  if (rawIdempotencyKey !== undefined && !idempotencyKey) {
    res.status(400).json({
      ok: false,
      error: 'validation_error',
      message: 'Idempotency-Key header is invalid',
    });
    return;
  }

  req.businessIntegration = {
    idempotencyKey: idempotencyKey || undefined,
  };

  next();
}

export const validateBusinessIntegration = (schema: ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        ok: false,
        error: 'validation_error',
        message: getFirstValidationMessage(result.error),
      });
      return;
    }

    req.validated = result.data;
    req.body = result.data;
    next();
  };
