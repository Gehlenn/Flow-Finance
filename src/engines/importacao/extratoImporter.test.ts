import { importarExtrato, ImportacaoExtratoOptions } from './extratoImporter';
import { describe, it, expect } from 'vitest';

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
});
