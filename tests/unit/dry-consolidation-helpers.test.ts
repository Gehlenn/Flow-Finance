import { describe, expect, it } from 'vitest';
import {
  avgDayOfMonth,
  median,
  normalize,
  parseLocalDate,
} from '../../src/ai/recurringPatternHelpers';
import { applyIdMapToCollection } from '../../src/utils/collectionIds';

describe('shared recurring pattern helpers', () => {
  it('preserves normalization and median behavior used by both detectors', () => {
    expect(normalize('  Salário—Empresa S.A.  ')).toBe('salario empresa s a');
    expect(median([])).toBe(0);
    expect(median([300, 100, 200])).toBe(200);
    expect(median([400, 100, 300, 200])).toBe(250);
  });

  it('parses date-only values on the local calendar and derives a stable day', () => {
    const parsed = parseLocalDate('2026-07-15');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(6);
    expect(parsed?.getDate()).toBe(15);
    expect(avgDayOfMonth(['2026-05-14', '2026-06-15', '2026-07-16'])).toBe(15);
  });
});

describe('shared collection id reconciliation', () => {
  it('keeps the original collection without mappings and reconciles mapped ids', () => {
    const items = [{ id: 'tmp-1', value: 10 }, { id: 'stable-2', value: 20 }];

    expect(applyIdMapToCollection(items)).toBe(items);
    expect(applyIdMapToCollection(items, { 'tmp-1': 'server-1' })).toEqual([
      { id: 'server-1', value: 10 },
      { id: 'stable-2', value: 20 },
    ]);
    expect(items[0].id).toBe('tmp-1');
  });
});
