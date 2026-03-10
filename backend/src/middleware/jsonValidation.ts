import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { AppError } from './errorHandler';

/**
 * Middleware to validate that request body is valid JSON
 * This catches malformed JSON before it reaches controllers
 */
export function validateJsonMiddleware(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only handle JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    logger.error(
      {
        error: error.message,
        method: req.method,
        path: req.path,
        contentType: req.get('content-type'),
      },
      'Invalid JSON in request body'
    );

    res.status(400).json({
      error: 'Bad Request',
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
      details: {
        syntaxError: error.message,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  next(error);
}

/**
 * Validate required fields in request body
 */
export function requireFields(...fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const missing = fields.filter(field => !(field in req.body));

    if (missing.length > 0) {
      logger.warn(
        {
          method: req.method,
          path: req.path,
          missing,
          received: Object.keys(req.body),
        },
        'Missing required fields'
      );

      throw new AppError(400, 'Missing required fields', {
        code: 'MISSING_FIELDS',
        missing,
      });
    }

    next();
  };
}
