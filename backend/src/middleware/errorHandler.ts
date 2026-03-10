import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ErrorResponse } from '../types';

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

  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof AppError && { details: error.details }),
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
