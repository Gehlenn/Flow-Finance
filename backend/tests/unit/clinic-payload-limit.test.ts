import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

import { createClinicPayloadLimitMiddleware } from '../../src/middleware/clinicPayloadLimit';

describe('createClinicPayloadLimitMiddleware', () => {
  it('allows payload within limit', () => {
    const middleware = createClinicPayloadLimitMiddleware(64);
    const req = { rawBody: JSON.stringify({ ok: true }) } as Request & { rawBody?: string };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as any).status).not.toHaveBeenCalled();
  });

  it('blocks payload above limit with 413', () => {
    const middleware = createClinicPayloadLimitMiddleware(16);
    const req = { rawBody: 'x'.repeat(40) } as Request & { rawBody?: string };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    middleware(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(413);
    expect((res as any).json).toHaveBeenCalled();
  });
});
