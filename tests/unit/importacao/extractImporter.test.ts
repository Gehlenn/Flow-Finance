import { describe, it, expect } from 'vitest';
import { importExtract } from '../../../src/services/importacao/extractImporter';

describe('importExtract', () => {
  it('retorna erro para formato não suportado', async () => {
    // @ts-expect-error formato inválido
    const result = await importExtract(new File([], 'dummy.txt'), 'TXT');
    expect(result.errors[0]).toMatch(/não suportado/i);
  });

  it('delegates OFX imports to the canonical pipeline', async () => {
    const result = await importExtract(new File([
      'OFXHEADER:100\n<OFX>\n<STMTTRN>\n<TRNAMT>-150.00\n<DTPOSTED>20260105\n<MEMO>Supermercado Extra\n</STMTTRN>\n</OFX>',
    ], 'dummy.ofx'), 'OFX');

    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toContain('Supermercado');
  });

  it('delegates CSV imports to the canonical pipeline', async () => {
    const result = await importExtract(new File([
      'Date,Description,Merchant,Amount\n2026-01-05,Netflix mensal,Netflix,39.90\n',
    ], 'dummy.csv'), 'CSV');

    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].merchant).toBe('Netflix');
  });

  it('returns canonical parser errors from the PDF path', async () => {
    const result = await importExtract(new File(['not-a-real-pdf'], 'dummy.pdf'), 'PDF');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
