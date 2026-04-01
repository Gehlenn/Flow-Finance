import { describe, it, expect } from 'vitest';
import { sugerirCategoriaIA } from '../../../src/services/ai/categorizationService';

describe('sugerirCategoriaIA', () => {
  it('retorna erro de não implementado', async () => {
    const result = await sugerirCategoriaIA({ description: 'Uber', merchant: 'Uber' });
    expect(result.erro).toMatch(/não implementada/);
    expect(result.categoria).toBe('Indefinida');
    expect(result.confidence).toBe(0);
  });
});
