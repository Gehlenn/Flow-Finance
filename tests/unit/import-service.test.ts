import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category, TransactionType } from '../../types';
import {
  detectFormat,
  parseCSV,
  parseOFX,
  runImportPipeline,
  toTransactions,
} from '../../src/finance/importService';

describe('importService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parseOFX suporta XML e SGML', () => {
    const xml = `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20260301</DTPOSTED><TRNAMT>-123.45</TRNAMT><MEMO>Mercado</MEMO></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const sgml = `<OFX>
<STMTTRN>
<DTPOSTED>20260305
<TRNAMT>2500.00
<NAME>Salario
</STMTTRN>`;

    const xmlResult = parseOFX(xml);
    const sgmlResult = parseOFX(sgml);

    expect(xmlResult).toHaveLength(1);
    expect(xmlResult[0].raw_amount).toBe(123.45);
    expect(xmlResult[0].raw_type).toBe(TransactionType.DESPESA);
    expect(sgmlResult).toHaveLength(1);
    expect(sgmlResult[0].raw_description).toBe('Salario');
    expect(sgmlResult[0].raw_type).toBe(TransactionType.RECEITA);
  });

  it('parseCSV detecta separadores e sinais corretamente', () => {
    const csv = [
      'Data;Descricao;Valor;Estabelecimento',
      '01/03/2026;Supermercado;-R$ 12,50;Mercado Bom',
      '02/03/2026;Pix recebido;R$ 1.234,56;Cliente XP',
    ].join('\n');

    const result = parseCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0].raw_amount).toBeCloseTo(12.5);
    expect(result[0].raw_type).toBe(TransactionType.DESPESA);
    expect(result[1].raw_amount).toBeCloseTo(1234.56);
    expect(result[1].raw_type).toBe(TransactionType.RECEITA);
    expect(result[1].merchant).toBe('Cliente XP');
  });

  it('detectFormat reconhece extensao e cabecalho', async () => {
    const ofxFile = new File(['OFXHEADER:100\n<OFX>'], 'extrato.bin', { type: 'application/octet-stream' });
    const csvFile = new File(['col1,col2'], 'arquivo.csv', { type: 'text/csv' });
    const pdfFile = new File(['%PDF-1.4'], 'arquivo.dat', { type: 'application/octet-stream' });

    await expect(detectFormat(ofxFile)).resolves.toBe('ofx');
    await expect(detectFormat(csvFile)).resolves.toBe('csv');
    await expect(detectFormat(pdfFile)).resolves.toBe('pdf');
  });

  it('toTransactions filtra itens nao selecionados e duplicados', () => {
    const result = toTransactions([
      {
        raw_date: '2026-03-01T00:00:00.000Z',
        raw_amount: 100,
        raw_description: 'Mercado',
        raw_type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        selected: true,
        confidence: 0.88,
      },
      {
        raw_date: '2026-03-02T00:00:00.000Z',
        raw_amount: 50,
        raw_description: 'Ignorar',
        raw_type: TransactionType.DESPESA,
        selected: false,
      },
      {
        raw_date: '2026-03-03T00:00:00.000Z',
        raw_amount: 80,
        raw_description: 'Duplicada',
        raw_type: TransactionType.DESPESA,
        selected: true,
        duplicate: true,
      },
    ], 'acc-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      amount: 100,
      account_id: 'acc-1',
      source: 'import',
      confidence_score: 0.88,
    });
  });

  it('runImportPipeline processa CSV local, marca duplicata e reporta progresso', async () => {
    const csvFile = new File([
      'Data,Descricao,Valor,Estabelecimento\n' +
      '01/03/2026,Supermercado,-50.00,Mercado Bom\n' +
      '02/03/2026,Uber,-20.00,Uber'
    ], 'extrato.csv', { type: 'text/csv' });

    const steps: string[] = [];
    const result = await runImportPipeline(
      csvFile,
      [
        {
          id: 'existing-1',
          amount: 50,
          type: TransactionType.DESPESA,
          category: Category.PESSOAL,
          description: 'Supermercado',
          date: '2026-03-01T00:00:00.000Z',
        },
      ],
      'user-import',
      (step) => { steps.push(step); },
    );

    expect(result.format).toBe('csv');
    expect(result.total_found).toBe(2);
    expect(result.transactions.some((item) => item.duplicate)).toBe(true);
    expect(result.errors).toEqual([]);
    expect(steps).toContain('Detectando formato…');
    expect(steps).toContain('Concluído!');
  });
});