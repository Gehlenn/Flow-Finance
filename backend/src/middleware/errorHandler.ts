import { NextFunction, Request, Response } from 'express';
import { AppError } from '../shared/AppError';
import logger from '../config/logger';

export { AppError } from '../shared/AppError';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) : (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const contextReq = req as Request & { requestId?: string; routeScope?: string };
    res.status(err.statusCode).json({
      message: err.message,
      details: err.statusCode >= 500 ? undefined : err.getSafeDetails(),
      requestId: contextReq.requestId,
      routeScope: contextReq.routeScope,
    });
    return;
  }

  logger.error({
    err,
    errorType: err instanceof Error ? err.name : typeof err,
    fallback: 'unhandled-error',
  }, 'Unhandled error');
  const contextReq = req as Request & { requestId?: string; routeScope?: string };
  res.status(500).json({
    message: 'Internal Server Error',
    requestId: contextReq.requestId,
    routeScope: contextReq.routeScope,
  });
}

export const errorHandlerMiddleware = errorHandler;
