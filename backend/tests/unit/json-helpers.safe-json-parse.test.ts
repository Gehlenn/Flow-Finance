import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { safeJsonParse } from '../../src/utils/jsonHelpers';

describe('safeJsonParse', () => {
  it('parses plain JSON', () => {
    expect(safeJsonParse('{"a":1}', 'plain')).toEqual({ a: 1 });
  });

  it('parses JSON inside ```json code fences', () => {
    expect(safeJsonParse('```json\n{\"a\":1}\n```', 'fence')).toEqual({ a: 1 });
  });

  it('parses JSON with preamble/trailing text', () => {
    expect(safeJsonParse('Aqui está:\n{\"a\":1}\nObrigado!', 'noise')).toEqual({ a: 1 });
  });

  it('parses JSON arrays inside code fences', () => {
    expect(safeJsonParse('```json\n[{\"a\":1}]\n```', 'array')).toEqual([{ a: 1 }]);
  });

  it('throws when there is no JSON to extract', () => {
    expect(() => safeJsonParse('resposta sem json', 'none')).toThrow(
      'AI response returned invalid JSON format'
    );
  });
});

