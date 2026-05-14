import { describe, expect, it } from 'vitest';

import {
  formatPredictionTooltipDate,
  formatPredictionXAxisTick,
} from '../../src/components/PredictionChart';

describe('PredictionChart date helpers', () => {
  it('formata date-only como data local no tooltip', () => {
    expect(formatPredictionTooltipDate('2026-03-10')).toContain('10');
    expect(formatPredictionTooltipDate('2026-03-10')).toContain('2026');
  });

  it('formata date-only como dia/local no eixo X', () => {
    expect(formatPredictionXAxisTick('2026-03-10')).toBe('10/03');
  });

  it('retorna fallback claro para data invalida', () => {
    expect(formatPredictionTooltipDate('invalid-date')).toBe('Data inválida');
    expect(formatPredictionXAxisTick('invalid-date')).toBe('Data inválida');
  });
});
