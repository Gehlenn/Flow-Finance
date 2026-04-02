import { describe, expect, it, vi } from 'vitest';
import { createCorsOptions, isOriginAllowed, resolveAllowedOrigins } from './cors';

describe('cors config', () => {
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
});
