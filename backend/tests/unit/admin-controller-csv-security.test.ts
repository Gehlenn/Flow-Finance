import { describe, expect, it } from 'vitest';

import { escapeCsvCell } from '../../src/admin/adminController';

describe('adminController CSV hardening', () => {
  it('prefixes spreadsheet formula payloads to prevent CSV injection', () => {
    expect(escapeCsvCell('=2+3')).toBe('"\'=2+3"');
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell('@cmd')).toBe('"\'@cmd"');
  });

  it('keeps regular values quoted and escaped', () => {
    expect(escapeCsvCell('plain text')).toBe('"plain text"');
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });
});
