import { describe, expect, it } from 'vitest';

import { createParserLabState } from '../../pages/AIControlPanel';

describe('AIControlPanel parser lab defaults', () => {
  it('resets parser lab state when switching to OFX', () => {
    expect(createParserLabState('ofx')).toEqual({
      format: 'ofx',
      input: '',
      result: null,
      error: null,
    });
  });

  it('resets parser lab state when switching to CSV', () => {
    expect(createParserLabState('csv')).toEqual({
      format: 'csv',
      input: '',
      result: null,
      error: null,
    });
  });
});
