import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  loggerDebug: vi.fn(),
}));

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mocks.loggerWarn,
    debug: mocks.loggerDebug,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { StripeCheckoutSchema } from '../../src/validation/saas.schema';

describe('saas schema observability', () => {
  beforeEach(() => {
    mocks.loggerWarn.mockClear();
    mocks.loggerDebug.mockClear();
  });

  it('registra contexto quando FRONTEND_URL é malformada e a URL ainda é aceita por localhost', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'not-a-valid-url';
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';

    const result = StripeCheckoutSchema.safeParse({
      returnUrl: 'http://localhost:5173/billing/return',
    });

    expect(result.success).toBe(true);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        frontendUrl: 'not-a-valid-url',
        frontendUrlLength: 'not-a-valid-url'.length,
        fallback: 'saas-schema-malformed-frontend-url',
      }),
      'Malformed FRONTEND_URL in CORS validation',
    );
  });

  it('registra contexto quando returnUrl é inválida', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';

    const result = StripeCheckoutSchema.safeParse({
      returnUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        urlLength: 'not-a-url'.length,
        fallback: 'saas-schema-invalid-return-url',
      }),
      'CORS origin validation exception — URL may be invalid',
    );
  });
});
