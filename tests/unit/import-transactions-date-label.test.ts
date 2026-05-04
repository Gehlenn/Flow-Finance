import { describe, expect, it } from 'vitest';

import { formatImportedDateLabel } from '../../pages/ImportTransactions';

describe('ImportTransactions date labels', () => {
  it('renders valid dates using UTC to avoid timezone drift', () => {
    expect(formatImportedDateLabel('2026-04-01T00:00:00.000Z')).toBe('01/04/2026');
  });

  it('falls back cleanly for invalid dates', () => {
    expect(formatImportedDateLabel('bad-date')).toBe('Data inválida');
  });
});
