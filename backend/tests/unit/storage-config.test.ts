import { describe, expect, it } from 'vitest';

import { resolveCloudStorageProvider } from '../../src/config/storage';

describe('resolveCloudStorageProvider', () => {
  it('defaults to aws-s3 when the env value is missing or unsupported', () => {
    expect(resolveCloudStorageProvider(undefined)).toBe('aws-s3');
    expect(resolveCloudStorageProvider('invalid-provider')).toBe('aws-s3');
  });

  it('accepts cloudflare-r2 explicitly', () => {
    expect(resolveCloudStorageProvider('cloudflare-r2')).toBe('cloudflare-r2');
  });
});
