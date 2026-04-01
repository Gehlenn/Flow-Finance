import { describe, expect, it } from 'vitest';

import {
  detectImportFormat,
  findDuplicates,
  runImportPipeline,
} from '../../src/importers/importPipeline';
import { TransactionType, Category } from '../../types';
import type { Transaction } from '../../types';

// ─── detectImportFormat ───────────────────────────────────────────────────────

describe('detectImportFormat', () => {
  it('detecta OFX por extensão .ofx', () => {
    expect(detectImportFormat('extrato.ofx', '')).toBe('ofx');
  });

  it('detecta OFX por extensão .qfx', () => {
    expect(detectImportFormat('extrato.qfx', '')).toBe('ofx');
  });

  it('detecta CSV por extensão .csv', () => {
    expect(detectImportFormat('extrato.csv', '')).toBe('csv');
  });

  it('detecta TSV como CSV', () => {
    expect(detectImportFormat('extrato.tsv', '')).toBe('csv');
  });

  it('detecta PDF por extensão .pdf', () => {
    expect(detectImportFormat('extrato.pdf', '')).toBe('pdf');
  });

  it('detecta OFX por conteúdo com tag <STMTTRN>', () => {
    expect(detectImportFormat('arquivo', '<STMTTRN>')).toBe('ofx');
  });

  it('detecta OFX por conteúdo com OFXHEADER:', () => {
    expect(detectImportFormat('arquivo', 'OFXHEADER:100\n')).toBe('ofx');
  });

  it('detecta CSV por cabeçalho com "date"', () => {
    expect(detectImportFormat('arquivo', 'date,description,amount\n')).toBe('csv');
  });

  it('retorna "unknown" para arquivo sem extensão reconhecida e conteúdo indefinido', () => {
    expect(detectImportFormat('arquivo', 'conteudo qualquer sem pistas')).toBe('unknown');
  });
});

// ─── findDuplicates ───────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 100,
    type: TransactionType.DESPESA,
    category: Category.PESSOAL,
    description: 'Mercado Pao de Acucar',
    date: '2026-01-10T10:00:00.000Z',
    source: 'import',
    ...overrides,
  } as Transaction;
}

describe('findDuplicates', () => {
  it('retorna todas as transações como únicas quando não há existentes', () => {
    const incoming = [makeTx(), makeTx({ id: 'tx-2', description: 'Farmacia' })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, []);
    expect(unique).toHaveLength(2);
    expect(duplicatesSkipped).toBe(0);
  });

  it('detecta duplicata com mesma data, valor e descrição', () => {
    const existing = [makeTx({ id: 'existing-1' })];
    const incoming = [makeTx({ id: 'new-1' })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, existing);
    expect(unique).toHaveLength(0);
    expect(duplicatesSkipped).toBe(1);
  });

  it('não marca como duplicata se valor diferente', () => {
    const existing = [makeTx({ amount: 100 })];
    const incoming = [makeTx({ amount: 200 })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, existing);
    expect(unique).toHaveLength(1);
    expect(duplicatesSkipped).toBe(0);
  });

  it('não marca como duplicata se descrição diferente', () => {
    const existing = [makeTx({ description: 'Mercado ABC' })];
    const incoming = [makeTx({ description: 'Farmacia XYZ' })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, existing);
    expect(unique).toHaveLength(1);
    expect(duplicatesSkipped).toBe(0);
  });

  it('aceita diferença de 1 dia na data', () => {
    const existing = [makeTx({ date: '2026-01-10T10:00:00.000Z' })];
    // 1 dia depois (dentro da tolerância de 2 dias)
    const incoming = [makeTx({ date: '2026-01-11T10:00:00.000Z' })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, existing);
    expect(duplicatesSkipped).toBe(1);
    expect(unique).toHaveLength(0);
  });

  it('não considera duplicata com 3+ dias de diferença', () => {
    const existing = [makeTx({ date: '2026-01-10T00:00:00.000Z' })];
    const incoming = [makeTx({ date: '2026-01-14T00:00:00.000Z' })];
    const { unique, duplicatesSkipped } = findDuplicates(incoming, existing);
    expect(unique).toHaveLength(1);
    expect(duplicatesSkipped).toBe(0);
  });
});

// ─── runImportPipeline ────────────────────────────────────────────────────────

function makeFile(content: string, name: string) {
  return { name, text: () => Promise.resolve(content) };
}

const CSV_CONTENT = `Date,Description,Merchant,Amount
2026-01-05,Netflix mensal,Netflix,39.90
2026-01-10,iFood pedido,iFood,85.90
`;

const OFX_CONTENT = `OFXHEADER:100
<OFX>
<STMTTRN>
<TRNAMT>-150.00
<DTPOSTED>20260105
<MEMO>Supermercado Extra
</STMTTRN>
</OFX>`;

describe('runImportPipeline', () => {
  it('processa CSV e retorna transações', async () => {
    const result = await runImportPipeline(makeFile(CSV_CONTENT, 'extrato.csv'));
    expect(result.format).toBe('csv');
    expect(result.transactions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('processa OFX e retorna transações', async () => {
    const result = await runImportPipeline(makeFile(OFX_CONTENT, 'extrato.ofx'));
    expect(result.format).toBe('ofx');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it('retorna unknown e mensagem de erro para formato não reconhecido', async () => {
    const result = await runImportPipeline(makeFile('conteudo qualquer', 'extrato.xyz'));
    expect(result.format).toBe('unknown');
    expect(result.transactions).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('forceFormat substitui detecção automática', async () => {
    // Força CSV mesmo sem extensão
    const result = await runImportPipeline(makeFile(CSV_CONTENT, 'sem-extensao'), [], 'csv');
    expect(result.format).toBe('csv');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it('deduplica transações com base em existentes', async () => {
    const existing: Transaction[] = [
      makeTx({ description: 'Netflix mensal', amount: 39.9, date: '2026-01-05T00:00:00.000Z' }),
    ];
    const result = await runImportPipeline(makeFile(CSV_CONTENT, 'extrato.csv'), existing);
    // Netflix é duplicata → apenas iFood entra
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.transactions).toHaveLength(1);
  });

  it('sem existentes: duplicatesSkipped = 0', async () => {
    const result = await runImportPipeline(makeFile(CSV_CONTENT, 'extrato.csv'));
    expect(result.duplicatesSkipped).toBe(0);
  });
});
