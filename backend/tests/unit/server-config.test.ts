import { describe, expect, it } from 'vitest';
import { resolveTrustProxySetting } from '../../src/config/server';

describe('resolveTrustProxySetting', () => {
  it('returns compatibility default when TRUST_PROXY is not set', () => {
    expect(resolveTrustProxySetting({ trustProxy: undefined })).toBe(1);
    expect(resolveTrustProxySetting({ trustProxy: '' })).toBe(1);
  });

  it('parses boolean-like values', () => {
    expect(resolveTrustProxySetting({ trustProxy: 'true' })).toBe(true);
    expect(resolveTrustProxySetting({ trustProxy: 'false' })).toBe(false);
    expect(resolveTrustProxySetting({ trustProxy: ' TRUE ' })).toBe(true);
  });

  it('parses non-negative integer values', () => {
    expect(resolveTrustProxySetting({ trustProxy: '0' })).toBe(0);
    expect(resolveTrustProxySetting({ trustProxy: '1' })).toBe(1);
    expect(resolveTrustProxySetting({ trustProxy: '2' })).toBe(2);
  });

  it('keeps subnet/list strings for express trust proxy', () => {
    expect(resolveTrustProxySetting({ trustProxy: 'loopback' })).toBe('loopback');
    expect(resolveTrustProxySetting({ trustProxy: 'uniquelocal' })).toBe('uniquelocal');
    expect(resolveTrustProxySetting({ trustProxy: '10.0.0.1/8' })).toBe('10.0.0.1/8');
  });
});
