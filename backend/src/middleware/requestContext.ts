import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      routeScope?: string;
    }
  }
}

function resolveRouteScope(path: string): string {
  if (!path.startsWith('/api/')) {
    return 'public';
  }

  const [, , scope] = path.split('/');
  return scope || 'api';
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingRequestId = req.header('x-request-id');
  const requestId = typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
    ? incomingRequestId.trim()
    : randomUUID();

  req.requestId = requestId;
  req.routeScope = resolveRouteScope(req.path);

  res.setHeader('x-request-id', requestId);

  next();
}
