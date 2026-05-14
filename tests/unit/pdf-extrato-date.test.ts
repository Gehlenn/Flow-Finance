import { describe, expect, it, vi } from 'vitest';

const { pdfParseMock } = vi.hoisted(() => ({
  pdfParseMock: vi.fn(),
}));

const logWarnMock = vi.fn();

vi.mock('pdf-parse', () => ({
  default: pdfParseMock,
  __esModule: true,
}));

vi.mock('../../src/utils/logger', () => ({
  logWarn: (...args: unknown[]) => logWarnMock(...args),
}));

import { extrairDePDF } from '../../src/engines/importacao/pdfExtrato';

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('extrairDePDF', () => {
  beforeEach(() => {
    logWarnMock.mockReset();
  });

  it('emite data local ao extrair transacao de PDF', async () => {
    pdfParseMock.mockResolvedValueOnce({
      text: '01/04/2026 Mercado Central R$ 125,90',
    });

    const result = await extrairDePDF({ arquivo: Buffer.from('%PDF-1.4') });

    expect(result.transacoes).toHaveLength(1);
    expect(result.transacoes[0].date).toBe(localDateKey(new Date()));
  });

  it('retorna erro visivel quando o PDF nao tem texto', async () => {
    pdfParseMock.mockResolvedValueOnce({
      text: '   ',
    });

    const result = await extrairDePDF({ arquivo: Buffer.from('%PDF-1.4') });

    expect(result.transacoes).toHaveLength(0);
    expect(result.erros[0]).toMatch(/Nenhum texto detectado no PDF/i);
  });

  it('retorna erro visivel quando o parser rejeita', async () => {
    pdfParseMock.mockRejectedValueOnce(new Error('parse failed'));

    const result = await extrairDePDF({ arquivo: Buffer.from('%PDF-1.4') });

    expect(result.transacoes).toHaveLength(0);
    expect(result.erros[0]).toMatch(/Erro ao processar PDF/i);
    expect(logWarnMock).toHaveBeenCalledWith(
      '[PDFExtrato] Failed to process PDF',
      expect.objectContaining({
        error: expect.any(Error),
        fileSize: expect.any(Number),
      }),
    );
  });
});
