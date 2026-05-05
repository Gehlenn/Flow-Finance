import { describe, expect, it } from 'vitest';

import {
  formatPanelDateTime,
  formatPanelTime,
} from '../../pages/AIControlPanel';

describe('AIControlPanel timestamp fallbacks', () => {
  it('falls back to a safe date string for malformed timestamps', () => {
    expect(formatPanelDateTime('bad-timestamp')).toBe('Data inválida');
  });

  it('falls back to a safe time string for malformed timestamps', () => {
    expect(formatPanelTime('bad-timestamp')).toBe('Horário inválido');
  });
});
