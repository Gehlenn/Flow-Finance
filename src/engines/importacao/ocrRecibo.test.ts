import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recognizeMock, mockLogWarn } = vi.hoisted(() => ({
  recognizeMock: vi.fn(),
  mockLogWarn: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  default: {
    recognize: recognizeMock,
  },
}));

vi.mock('../../utils/logger', () => ({
  logWarn: mockLogWarn,
}));

import { ocrRecibo } from './ocrRecibo';

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('ocrRecibo', () => {
  beforeEach(() => {
    recognizeMock.mockReset();
    mockLogWarn.mockClear();
  });

  it('retorna erro para formato invalido', async () => {
    const resultado = await ocrRecibo({ arquivo: 'fake-pdf-content' });
    expect(resultado.transacoes).toEqual([]);
    expect(resultado.erros[0]).toMatch(/Formato de arquivo/);
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it('retorna erro quando a imagem base64 e invalida', async () => {
    const fakeBase64 = 'data:image/png;base64,abc';
    const resultado = await ocrRecibo({ arquivo: fakeBase64 });

    expect(resultado.transacoes).toEqual([]);
    expect(resultado.erros[0]).toMatch(/Imagem base64 invalida/);
    expect(recognizeMock).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[OCRRecibo] OCR processing failed',
      expect.objectContaining({
        error: expect.any(Error),
        format: 'string',
      }),
    );
  });

  it('extrai transacao quando o OCR retorna texto com valor', async () => {
    recognizeMock.mockResolvedValue({
      data: {
        text: 'Supermercado Flow\nR$ 42,90',
      },
    });

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const resultado = await ocrRecibo({ arquivo: pngHeader });

    expect(recognizeMock).toHaveBeenCalledOnce();
    expect(resultado.erros).toEqual([]);
    expect(resultado.transacoes).toHaveLength(1);
    expect(resultado.transacoes[0].amount).toBe(42.9);
    expect(resultado.transacoes[0].description).toBe('Supermercado Flow');
    expect(resultado.transacoes[0].date).toBe(localDateKey(new Date()));
  });

  it('registra aviso quando o OCR falha no processamento', async () => {
    recognizeMock.mockRejectedValueOnce(new Error('ocr failed'));

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const resultado = await ocrRecibo({ arquivo: pngHeader });

    expect(resultado.transacoes).toEqual([]);
    expect(resultado.erros[0]).toBe('Erro no OCR: ocr failed');
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[OCRRecibo] OCR processing failed',
      expect.objectContaining({
        error: expect.any(Error),
        format: 'buffer',
      }),
    );
  });
});


