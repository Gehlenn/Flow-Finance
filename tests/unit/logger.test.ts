import { describe, expect, it, vi, afterEach } from 'vitest';

const sentrySpies = vi.hoisted(() => ({
  reportMessage: vi.fn(),
  reportError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('../../src/config/sentry', () => sentrySpies);

import { logError, logInfo } from '../../src/utils/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
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

    expect(sentrySpies.reportMessage).toHaveBeenCalledTimes(1);
    expect(sentrySpies.reportMessage).toHaveBeenCalledWith(
      'user_login',
      'info',
      expect.objectContaining({
        level: 'INFO',
      })
    );
    expect(sentrySpies.addBreadcrumb).toHaveBeenCalledWith('user_login', 'logger', 'info');
  });

  it('usa console.error para logs de erro', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError('request_failed', { message: 'boom', secret: 'x' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = errorSpy.mock.calls[0][1] as { data: Record<string, unknown> };
    expect(payload.data.secret).toBe('[REDACTED]');

    expect(sentrySpies.reportMessage).toHaveBeenCalledWith(
      'request_failed',
      'error',
      expect.objectContaining({
        level: 'ERROR',
      })
    );
    expect(sentrySpies.addBreadcrumb).toHaveBeenCalledWith('request_failed', 'logger', 'error');
    expect(sentrySpies.reportError).not.toHaveBeenCalled();
  });

  it('encaminha Error real para reportError no sink estruturado', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('boom');

    logError('request_failed', err, { correlationId: 'corr-err' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(sentrySpies.reportError).toHaveBeenCalledTimes(1);
    expect(sentrySpies.reportError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        level: 'ERROR',
        correlationId: 'corr-err',
      })
    );
    expect(sentrySpies.reportMessage).not.toHaveBeenCalled();
    expect(sentrySpies.addBreadcrumb).toHaveBeenCalledWith('request_failed', 'logger', 'error');
  });
});
