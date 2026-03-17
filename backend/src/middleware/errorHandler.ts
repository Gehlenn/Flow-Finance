import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ErrorResponse } from '../types';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|token|authorization|secret|api[-_]?key|access[-_]?key)/i;

function sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details) {
    return undefined;
  }

  const sanitizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
    }

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const [key, innerValue] of Object.entries(obj)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          sanitized[key] = REDACTED_VALUE;
        } else {
          sanitized[key] = sanitizeValue(innerValue);
        }
      }
      return sanitized;
    }

    return value;
  };

  return sanitizeValue(details) as Record<string, any>;
}

function getRequestContext(req: Request): { requestId?: string; routeScope?: string } {
  const contextReq = req as Request & { requestId?: string; routeScope?: string };
  return {
    requestId: contextReq.requestId,
    routeScope: contextReq.routeScope,
  };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error.message || 'Internal server error';
  const sanitizedDetails = error instanceof AppError ? sanitizeDetails(error.details) : undefined;
  const requestContext = getRequestContext(req);

  logger.error(
    {
      requestId: requestContext.requestId,
      routeScope: requestContext.routeScope,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(sanitizedDetails && { details: sanitizedDetails }),
      },
      url: req.url,
      method: req.method,
      statusCode,
    },
    'Request error'
  );

  const response: ErrorResponse = {
    error: error.name || 'Error',
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: requestContext.requestId,
    routeScope: requestContext.routeScope,
    ...(statusCode < 500 && sanitizedDetails && { details: sanitizedDetails }),
  };

  res.status(statusCode).json(response);
}

// Backward-compatible alias used by existing imports.
export const errorHandlerMiddleware = errorHandler;

export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
