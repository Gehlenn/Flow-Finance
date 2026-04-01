import { extrairDePDF } from './pdfExtrato';
import { describe, it, expect } from 'vitest';

const fakePDFBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>', 'utf-8');

describe('extrairDePDF', () => {
  it('retorna erro para PDF inválido', async () => {
    const resultado = await extrairDePDF({ arquivo: fakePDFBuffer });
    expect(resultado.transacoes).toEqual([]);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });
});
