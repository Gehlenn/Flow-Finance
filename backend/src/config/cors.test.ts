import { describe, expect, it, vi, beforeEach } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock('./logger', () => ({
  default: {
    warn: loggerMocks.warn,
    info: loggerMocks.info,
  },
}));

import { createCorsOptions, isOriginAllowed, resolveAllowedOrigins } from './cors';

describe('cors config', () => {
  beforeEach(() => {
    loggerMocks.warn.mockClear();
    loggerMocks.info.mockClear();
  });

  it('allows loopback origins automatically in development', () => {
    const allowedOrigins = resolveAllowedOrigins({
      nodeEnv: 'development',
      allowedOrigins: 'https://staging.flow-finance.app',
    });

    expect(allowedOrigins).toContain('https://staging.flow-finance.app');
    expect(isOriginAllowed('http://localhost:5173', allowedOrigins, 'development')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:4173', allowedOrigins, 'development')).toBe(true);
  });

  it('only allows explicitly configured official domains in production', () => {
    const allowedOrigins = resolveAllowedOrigins({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flow-finance.com,https://staging.flow-finance.com,http://localhost:5173',
    });

    expect(allowedOrigins).toEqual([
      'https://app.flow-finance.com',
      'https://staging.flow-finance.com',
    ]);
    expect(isOriginAllowed('https://app.flow-finance.com', allowedOrigins, 'production')).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', allowedOrigins, 'production')).toBe(false);
  });

  it('builds cors options that reject unknown origins without throwing', () => {
    const callback = vi.fn();
    const options = createCorsOptions({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flow-finance.com',
    });

    if (typeof options.origin !== 'function') {
      throw new Error('Expected function origin handler');
    }

    options.origin('https://evil.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('permite headers de tracing do Sentry no preflight', () => {
    const options = createCorsOptions({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flow-finance.com',
    });

    expect(options.allowedHeaders).toEqual(expect.arrayContaining([
      'sentry-trace',
      'baggage',
    ]));
  });

  it('registra aviso quando a origem informada e malformada', () => {
    const allowedOrigins = resolveAllowedOrigins({
      nodeEnv: 'development',
      allowedOrigins: 'https://app.flow-finance.com',
    });

    expect(isOriginAllowed('not-a-valid-origin', allowedOrigins, 'development')).toBe(false);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'not-a-valid-origin',
        error: expect.any(Error),
      }),
      'CORS origin parsing failed',
    );
  });
});
