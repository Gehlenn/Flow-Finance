import { describe, it, expect } from 'vitest';
import { detectarAssinatura } from '../../../src/services/ai/subscriptionDetector';

describe('detectarAssinatura', () => {
  it('retorna erro de não implementado', async () => {
    const result = await detectarAssinatura({ description: 'Netflix', merchant: 'Netflix' });
    expect(result.erro).toMatch(/não implementado/);
    expect(result.assinatura).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
