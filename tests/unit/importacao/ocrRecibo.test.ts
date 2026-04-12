import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processarReciboOCR } from '../../../src/services/importacao/ocrRecibo';

const mockScanReceipt = vi.hoisted(() => vi.fn());

vi.mock('../../../src/ai/receiptScanner', () => ({
  scanReceipt: mockScanReceipt,
}));

describe('processarReciboOCR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates receipt OCR to the canonical scanner', async () => {
    mockScanReceipt.mockResolvedValueOnce({
      success: true,
      data: {
        amount: 47.9,
        category: 'Pessoal',
        date: '2026-04-01',
        raw_text: 'TOTAL 47,90',
      },
    });

    const result = await processarReciboOCR(new File([], 'dummy.png'));
    expect(result.erros).toEqual([]);
    expect(result.valor).toBe(47.9);
    expect(result.categoria).toBe('Pessoal');
  });

  it('surfaces canonical scanner errors', async () => {
    mockScanReceipt.mockResolvedValueOnce({
      success: false,
      data: null,
      error: 'OCR falhou',
    });

    const result = await processarReciboOCR(new File([], 'dummy.png'));
    expect(result.erros[0]).toMatch(/OCR falhou/);
  });

  it('usa description como fallback quando raw_text nao vier no contrato', async () => {
    mockScanReceipt.mockResolvedValueOnce({
      success: true,
      data: {
        amount: 19.9,
        category: 'Pessoal',
        date: '2026-04-01',
        description: 'Cafe da tarde',
      },
    });

    const result = await processarReciboOCR(new File([], 'dummy.png'));
    expect(result.textoCompleto).toBe('Cafe da tarde');
    expect(result.erros).toEqual([]);
  });
});
