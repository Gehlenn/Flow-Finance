import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogWarn } = vi.hoisted(() => ({
  mockLogWarn: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logWarn: mockLogWarn,
}));

import { importarExtrato } from './extratoImporter';

const exemploOFX = `<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260301
<TRNAMT>-100.00
<MEMO>Supermercado</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260302
<TRNAMT>2500.00
<MEMO>Salário</MEMO>
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

const exemploCSV = 'Data,Descricao,Valor\n2026-03-01,Padaria,-20.00\n2026-03-02,Salário,5000.00';

describe('importarExtrato', () => {
  beforeEach(() => {
    mockLogWarn.mockClear();
  });

  it('importa transações de CSV válido', async () => {
    const resultado = await importarExtrato({ arquivo: exemploCSV, formato: 'CSV' });
    expect(resultado.transacoes.length).toBe(2);
    expect(resultado.transacoes[0].description).toBe('Padaria');
    expect(resultado.transacoes[1].type).toBe('Receita');
    expect(resultado.erros.length).toBe(0);
  });

  it('auto-detecta formato CSV', async () => {
    const resultado = await importarExtrato({ arquivo: exemploCSV });
    expect(['CSV', 'OFX', 'PDF']).toContain(resultado.formatoDetectado);
    expect(resultado.transacoes.length).toBe(2);
  });

  it('importa transações de OFX válido', async () => {
    const resultado = await importarExtrato({ arquivo: exemploOFX, formato: 'OFX' });
    expect(resultado.transacoes.length).toBe(2);
    expect(resultado.transacoes[0].description).toBe('Supermercado');
    expect(resultado.transacoes[1].type).toBe('Receita');
    expect(resultado.erros.length).toBe(0);
  });

  it('auto-detecta formato OFX', async () => {
    const resultado = await importarExtrato({ arquivo: exemploOFX });
    expect(['CSV', 'OFX', 'PDF']).toContain(resultado.formatoDetectado);
    expect(resultado.transacoes.length).toBe(2);
  });

  it('registra aviso quando CSV invalido falha no parse', async () => {
    const resultado = await importarExtrato({
      arquivo: {
        toString: () => {
          throw new Error('boom csv');
        },
      } as unknown as Buffer,
      formato: 'CSV',
    });

    expect(resultado.transacoes.length).toBe(0);
    expect(resultado.erros).toContain('Erro ao processar CSV: boom csv');
    expect(mockLogWarn).toHaveBeenCalledWith(
      '[ExtratoImporter] CSV processing failed',
      expect.objectContaining({
        format: 'CSV',
        error: expect.any(Error),
      }),
    );
  });
});
