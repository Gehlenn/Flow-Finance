import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../backend/src/middleware/errorHandler';
import { featureGateOpenFinance } from '../../backend/src/middleware/featureGate';
import type { Request, Response } from 'express';

describe('featureGateOpenFinance', () => {
  beforeEach(() => {
    delete process.env.FEATURE_OPEN_FINANCE;
  });

  afterEach(() => {
    delete process.env.FEATURE_OPEN_FINANCE;
  });

  it('permite a request quando Open Finance está habilitado', () => {
    process.env.FEATURE_OPEN_FINANCE = 'true';
    const next = vi.fn();
    const middleware = featureGateOpenFinance();
    middleware({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('bloqueia a request com AppError 503 quando Open Finance está desativado', () => {
    // FEATURE_OPEN_FINANCE ausente → padrão false (desativado)
    const next = vi.fn();
    const middleware = featureGateOpenFinance();
    expect(() => middleware({} as Request, {} as Response, next)).toThrowError(AppError);
    expect(() => middleware({} as Request, {} as Response, next)).toThrowError(/temporarily unavailable/i);
    expect(next).not.toHaveBeenCalled();
  });
});
