import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recognizeMock } = vi.hoisted(() => ({
  recognizeMock: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  default: {
    recognize: recognizeMock,
  },
}));

import { ocrRecibo } from './ocrRecibo';

describe('ocrRecibo', () => {
  beforeEach(() => {
    recognizeMock.mockReset();
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
  });
});
