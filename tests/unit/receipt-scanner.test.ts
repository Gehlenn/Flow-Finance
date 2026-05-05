import { describe, expect, it, vi } from 'vitest';

vi.mock('tesseract.js', () => {
  throw new Error('module unavailable');
});

describe('scanReceiptText', () => {
  it('falls back to the text source when tesseract is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { scanReceiptText } = await import('../../src/ocr/receiptScanner');
    const result = await scanReceiptText({
      text: async () => 'fallback text',
    });

    expect(result).toBe('fallback text');
    expect(warnSpy).toHaveBeenCalledWith(
      '[OCR Scanner] tesseract.js unavailable, using text fallback:',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
