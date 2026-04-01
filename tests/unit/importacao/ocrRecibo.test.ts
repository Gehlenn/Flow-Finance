import { describe, it, expect } from 'vitest';
import { processarReciboOCR } from '../../../src/services/importacao/ocrRecibo';

describe('processarReciboOCR', () => {
  it('retorna erro de não implementado', async () => {
    const result = await processarReciboOCR(new File([], 'dummy.png'));
    expect(result.erros[0]).toMatch(/não implementado/);
  });
});
