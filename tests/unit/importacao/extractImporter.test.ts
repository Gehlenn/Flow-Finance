import { describe, it, expect } from 'vitest';
import { importExtract, ExtractFormat } from '../../../src/services/importacao/extractImporter';

describe('importExtract', () => {
  it('retorna erro para formato não suportado', async () => {
    // @ts-expect-error formato inválido
    const result = await importExtract(new File([], 'dummy.txt'), 'TXT');
    expect(result.errors[0]).toMatch(/não suportado/);
  });

  it('retorna erro para OFX não implementado', async () => {
    const result = await importExtract(new File([], 'dummy.ofx'), 'OFX');
    expect(result.errors[0]).toMatch(/OFX não implementado/);
  });

  it('retorna erro para CSV não implementado', async () => {
    const result = await importExtract(new File([], 'dummy.csv'), 'CSV');
    expect(result.errors[0]).toMatch(/CSV não implementado/);
  });

  it('retorna erro para PDF não implementado', async () => {
    const result = await importExtract(new File([], 'dummy.pdf'), 'PDF');
    expect(result.errors[0]).toMatch(/PDF não implementado/);
  });
});
