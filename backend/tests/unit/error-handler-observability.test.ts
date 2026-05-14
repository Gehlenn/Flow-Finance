import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const loggerError = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    error: loggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { errorHandler, AppError } from '../../src/middleware/errorHandler';

describe('errorHandler observability', () => {
  it('registra contexto ao receber erro nao esperado', () => {
    const req = { requestId: 'req-1', routeScope: 'api' } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal Server Error',
      requestId: 'req-1',
      routeScope: 'api',
    });
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        errorType: 'Error',
        fallback: 'unhandled-error',
      }),
      'Unhandled error',
    );
  });

  it('mantem o contrato de AppError sem log adicional', () => {
    const req = { requestId: 'req-2', routeScope: 'api' } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    const appError = new AppError(400, 'Bad request');
    errorHandler(appError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Bad request',
      details: undefined,
      requestId: 'req-2',
      routeScope: 'api',
    });
  });
});
