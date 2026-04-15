import { describe, expect, it } from 'vitest';
import { isBenchmarkMode } from '../../src/runtime/benchmarkMode';

describe('benchmark mode detection', () => {
  it('returns false when search is empty', () => {
    expect(isBenchmarkMode('')).toBe(false);
    expect(isBenchmarkMode(undefined)).toBe(false);
    expect(isBenchmarkMode(null)).toBe(false);
  });

  it('detects benchmark query params used by local benchmarks', () => {
    expect(isBenchmarkMode('?bench=123')).toBe(true);
    expect(isBenchmarkMode('?benchmark=true')).toBe(true);
    expect(isBenchmarkMode('?lh=mobile')).toBe(true);
  });

  it('ignores unrelated query params', () => {
    expect(isBenchmarkMode('?foo=bar&mode=prod')).toBe(false);
  });
});