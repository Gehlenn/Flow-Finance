import { describe, expect, it, vi } from 'vitest';

// The script calls process.exit(1) at top level when VERCEL_TARGET_URL is absent.
// vi.hoisted runs before static imports, so this sets the var before module evaluation.
vi.hoisted(() => {
  process.env.VERCEL_TARGET_URL = 'https://test.example.vercel.app';
});

import {
  isExpectedApiRoot404,
  isFailedCheck,
} from '../../scripts/verify-vercel-observability.mjs';

describe('verify-vercel-observability helpers', () => {
  it('aceita 404 de raiz para backend API-only quando contrato de erro inclui requestId/routeScope', () => {
    const result = {
      path: '/',
      status: 404,
      json: {
        error: 'Not Found',
        message: 'Route GET / does not exist',
        requestId: 'req-123',
        routeScope: 'public',
      },
    };

    expect(isExpectedApiRoot404(result)).toBe(true);
    expect(isFailedCheck(result)).toBe(false);
  });

  it('mantem erro para raiz 404 sem contrato esperado', () => {
    const result = {
      path: '/',
      status: 404,
      json: {
        error: 'Not Found',
      },
    };

    expect(isExpectedApiRoot404(result)).toBe(false);
    expect(isFailedCheck(result)).toBe(true);
  });

  it('mantem regra de 200 para endpoints de health', () => {
    const ok = { path: '/api/health', status: 200 };
    const fail = { path: '/api/health', status: 503 };

    expect(isFailedCheck(ok)).toBe(false);
    expect(isFailedCheck(fail)).toBe(true);
  });
});
