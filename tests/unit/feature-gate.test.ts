import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../backend/src/middleware/errorHandler';
import { featureGateOpenFinance } from '../../backend/src/middleware/featureGate';

describe('featureGateOpenFinance', () => {
  const originalDisableOpenFinance = process.env.DISABLE_OPEN_FINANCE;

  beforeEach(() => {
    delete process.env.DISABLE_OPEN_FINANCE;
  });

  afterEach(() => {
    if (originalDisableOpenFinance === undefined) {
      delete process.env.DISABLE_OPEN_FINANCE;
    } else {
      process.env.DISABLE_OPEN_FINANCE = originalDisableOpenFinance;
    }
  });

  it('permite a request quando Open Finance está habilitado', () => {
    const next = vi.fn();

    featureGateOpenFinance({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('bloqueia a request com AppError 503 quando Open Finance está desativado', () => {
    process.env.DISABLE_OPEN_FINANCE = 'true';
    const next = vi.fn();

    expect(() => featureGateOpenFinance({} as any, {} as any, next)).toThrowError(AppError);
    expect(() => featureGateOpenFinance({} as any, {} as any, next)).toThrowError(
      'Open Finance integration temporarily unavailable. We are working to make this feature cost-effective and will re-enable it soon.',
    );
    expect(next).not.toHaveBeenCalled();
  });
});