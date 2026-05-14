import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWarn = vi.fn();

vi.mock('../../src/config/logger', () => ({
  default: {
    warn: mockWarn,
  },
}));

import { decodeToken } from '../../src/middleware/auth';

describe('decodeToken', () => {
  beforeEach(() => {
    mockWarn.mockClear();
  });

  it('registra aviso e retorna null quando o token e invalido', () => {
    const decoded = decodeToken('invalid-token');

    expect(decoded).toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        tokenLength: 'invalid-token'.length,
        tokenType: 'string',
        fallback: 'auth-decode-token-failed',
      }),
      '[AuthMiddleware] Failed to decode token; returning null'
    );
  });
});
