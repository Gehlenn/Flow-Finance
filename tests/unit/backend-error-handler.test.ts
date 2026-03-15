import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AppError, errorHandler } from '../../backend/src/middleware/errorHandler';

vi.mock('../../backend/src/config/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('backend errorHandler sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inclui details sanitizados em erro 4xx', () => {
    const req = {
      url: '/api/auth/login',
      method: 'POST',
      path: '/api/auth/login',
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const error = new AppError(400, 'Invalid credentials', {
      field: 'password',
      password: '123',
      token: 'jwt',
      nested: {
        apiKey: 'k1',
        info: 'ok',
      },
    });

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0] as { details: Record<string, unknown> };
    expect(response.details.password).toBe('[REDACTED]');
    expect(response.details.token).toBe('[REDACTED]');
    expect((response.details.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect((response.details.nested as Record<string, unknown>).info).toBe('ok');
  });

  it('nao retorna details para erro 5xx', () => {
    const req = {
      url: '/api/auth/login',
      method: 'POST',
      path: '/api/auth/login',
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const error = new AppError(500, 'Internal Error', {
      token: 'jwt',
      secret: 'x',
    });

    errorHandler(error, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0] as { details?: Record<string, unknown> };
    expect(response.details).toBeUndefined();
  });
});
