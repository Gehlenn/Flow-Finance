import { describe, expect, it, vi, afterEach } from 'vitest';

import { logError, logInfo } from '../../src/utils/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redige campos sensiveis em data e meta', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logInfo(
      'user_login',
      {
        userId: 'u_1',
        password: '123456',
        token: 'abc-token',
        nested: {
          apiKey: 'key-123',
          safe: 'ok',
        },
      },
      {
        correlationId: 'corr-1',
        authorization: 'Bearer xxx',
      }
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = logSpy.mock.calls[0][1] as { data: Record<string, unknown>; meta: Record<string, unknown> };

    expect(payload.data.password).toBe('[REDACTED]');
    expect(payload.data.token).toBe('[REDACTED]');
    expect((payload.data.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
    expect(payload.meta.authorization).toBe('[REDACTED]');
  });

  it('usa console.error para logs de erro', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError('request_failed', { message: 'boom', secret: 'x' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = errorSpy.mock.calls[0][1] as { data: Record<string, unknown> };
    expect(payload.data.secret).toBe('[REDACTED]');
  });
});
