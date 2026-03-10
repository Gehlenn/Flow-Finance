import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';

// Attach normalized payload so controllers can consume validated input.
declare global {
  namespace Express {
    interface Request {
      validated?: unknown;
    }
  }
}

export const validate = (schema: ZodTypeAny) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: result.error.flatten(),
      });
      return;
    }

    req.validated = result.data;
    req.body = result.data;
    next();
  };
