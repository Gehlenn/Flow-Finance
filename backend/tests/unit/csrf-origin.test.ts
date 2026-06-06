import { describe, expect, it } from 'vitest';
import { isTrustedStateChangingOrigin } from '../../src/middleware/csrfOrigin';

describe('csrf origin guard', () => {
  it('allows configured production frontend origins', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      origin: 'https://app.flowfinance.test',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });

  it('rejects unknown production origins', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      origin: 'https://evil.example.com',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(false);
  });

  it('uses referer origin when origin header is absent', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      referer: 'https://app.flowfinance.test/settings?tab=billing',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });

  it('keeps non-browser calls without origin or referer compatible', () => {
    expect(isTrustedStateChangingOrigin({
      nodeEnv: 'production',
      allowedOrigins: 'https://app.flowfinance.test',
    })).toBe(true);
  });
});
