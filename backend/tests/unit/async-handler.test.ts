import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { asyncHandler } from '../../src/middleware/errorHandler';

describe('asyncHandler', () => {
  it('returns an awaitable promise that resolves after the handler completes', async () => {
    const callOrder: string[] = [];
    const req = {} as Request;
    const res = {
      status: vi.fn(() => {
        callOrder.push('status');
        return res;
      }),
      json: vi.fn(() => {
        callOrder.push('json');
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    const wrapped = asyncHandler(async (_req, response) => {
      await Promise.resolve();
      response.status(202).json({ ok: true });
    });

    await wrapped(req, res, next);

    expect(callOrder).toEqual(['status', 'json']);
    expect(next).not.toHaveBeenCalled();
  });
});
