import { describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => {
  throw new Error('module unavailable');
});

const mockLogWarn = vi.fn();

vi.mock('../../src/utils/logger', () => ({
  logWarn: mockLogWarn,
}));

vi.mock('../../src/config/api.config', () => ({
  apiRequest: vi.fn().mockRejectedValue(new Error('backend offline')),
  API_ENDPOINTS: {
    AI: {
      SCAN_RECEIPT: '/scan-receipt',
    },
  },
}));

describe('scanReceiptText', () => {
  it('falls back to the text source when tesseract is unavailable', async () => {
    const { scanReceiptText } = await import('../../src/ocr/receiptScanner');
    const result = await scanReceiptText({
      text: async () => 'fallback text',
    });

    expect(result).toBe('fallback text');
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[OCR Scanner] tesseract.js unavailable, using text fallback',
      expect.objectContaining({
        error: expect.any(Error),
        fallback: 'ocr-tesseract-unavailable',
      }),
    );
  });

  it('parses date-only receipt dates as local dates', async () => {
    const { parseReceiptText } = await import('../../src/ai/receiptScanner');
    const result = parseReceiptText('Mercado\nTOTAL R$ 42,90\n10/03/2026');

    expect(result.date).toBe('2026-03-10');
  });

  it('registra aviso contextual quando o scan do recibo falha no backend', async () => {
    const { scanReceipt } = await import('../../src/ai/receiptScanner');
    const file = new File(['dummy'], 'receipt.png', { type: 'image/png' });

    const result = await scanReceipt(file);

    expect(result.success).toBe(false);
    expect(result.error).toBe('backend offline');
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[ReceiptScanner] Failed to scan receipt; returning structured error',
      expect.objectContaining({
        error: expect.any(Error),
        fileName: 'receipt.png',
      }),
    );
  });

  it('registra aviso quando a estrategia de data do recibo falha e tenta a seguinte', async () => {
    const normalizeSpy = vi.spyOn(String.prototype, 'normalize').mockImplementation(() => {
      throw new Error('normalize failed');
    });

    const { parseReceiptText } = await import('../../src/ai/receiptScanner');
    const result = parseReceiptText('Mercado\nTOTAL R$ 42,90\n10 de março de 2026');

    expect(result.date).toBeUndefined();
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[ReceiptScanner] Failed to parse receipt date strategy; trying next',
      expect.objectContaining({
        error: expect.any(Error),
        rawText: expect.stringContaining('10 de março de 2026'),
      }),
    );

    normalizeSpy.mockRestore();
  });
});
