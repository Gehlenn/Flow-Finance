import { describe, expect, it } from 'vitest';

import { importCSV } from '../../src/importers/csvImporter';
import { parsePdfStatementText } from '../../src/importers/pdfStatementImporter';

// ─── CSV fixtures ─────────────────────────────────────────────────────────────

const CSV_SEMICOLON = `Date;Description;Merchant;Amount
2026-01-05;Conta de luz;CPFL;320.50
2026-01-10;iFood pedido;iFood;85.90
2026-01-15;Salario;Empresa XYZ;8000.00
`;

const CSV_COMMA = `Date,Description,Merchant,Amount
2026-02-01,Netflix mensal,Netflix,39.90
2026-02-05,Uber viagem,,25.00
`;

const CSV_BR = `Data;Descricao;Estabelecimento;Valor
01/03/2026;Farmacia teste;Farmacia Popular;150,00
10/03/2026;Posto Shell;Shell;200,50
`;

const CSV_EMPTY_ROWS = `Date;Description;Amount
2026-01-01;Valida;100.00
;;
  ;  ; 
2026-01-02;Outra;50.00
`;

const CSV_MINIMAL = `Date,Description,Amount
2026-01-01,Aluguel,1500.50
`;

// ─── CSV importer ─────────────────────────────────────────────────────────────

describe('importCSV', () => {
  function makeFile(content: string, name = 'extrato.csv'): { name: string; text: () => Promise<string> } {
    return { name, text: () => Promise.resolve(content) };
  }

  it('importa CSV com separador ";" e retorna transações', async () => {
    const result = await importCSV(makeFile(CSV_SEMICOLON));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].format).toBe('csv');
    expect(result[0].source).toBe('import');
  });

  it('importa CSV com separador "," corretamente', async () => {
    const result = await importCSV(makeFile(CSV_COMMA));
    expect(result).toHaveLength(2);
  });

  it('todos os itens têm amount > 0', async () => {
    const result = await importCSV(makeFile(CSV_SEMICOLON));
    for (const tx of result) {
      expect(tx.amount).toBeGreaterThan(0);
    }
  });

  it('categoriza "iFood" como "alimentacao"', async () => {
    const result = await importCSV(makeFile(CSV_SEMICOLON));
    const ifood = result.find((r) => r.merchant?.toLowerCase().includes('ifood') || r.description.toLowerCase().includes('ifood'));
    expect(ifood).toBeDefined();
    expect(ifood!.category).toBe('alimentacao');
  });

  it('categoriza "Netflix" como "assinaturas"', async () => {
    const result = await importCSV(makeFile(CSV_COMMA));
    const netflix = result.find((r) => r.description.toLowerCase().includes('netflix'));
    expect(netflix).toBeDefined();
    expect(netflix!.category).toBe('assinaturas');
  });

  it('categoriza "Uber" como "transporte"', async () => {
    const result = await importCSV(makeFile(CSV_COMMA));
    const uber = result.find((r) => r.description.toLowerCase().includes('uber'));
    expect(uber).toBeDefined();
    expect(uber!.category).toBe('transporte');
  });

  it('aceita CSV com headers em português (Descricao, Valor)', async () => {
    const result = await importCSV(makeFile(CSV_BR));
    expect(result.length).toBeGreaterThan(0);
  });

  it('filtra linhas vazias sem lançar erro', async () => {
    const result = await importCSV(makeFile(CSV_EMPTY_ROWS));
    // apenas as 2 linhas com amount > 0 e description válida
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('CSV mínimo com 1 linha retorna 1 transação', async () => {
    const result = await importCSV(makeFile(CSV_MINIMAL));
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(1500.5, 1);
    expect(result[0].description).toBe('Aluguel');
  });
});

// ─── PDF statement importer ───────────────────────────────────────────────────

const PDF_TEXT_SIMPLE = `
Extrato Bancario - Janeiro 2026
Banco Exemplo

01/01/2026 Salario Empresa R$ 8.000,00
05/01/2026 Supermercado Extra R$ 320,50
10/01/2026 Netflix R$ 39,90
15/01/2026 Aluguel Imovel R$ 2.500,00
`;

const PDF_TEXT_ISO = `
2026-02-01 Farmacia Popular R$ 150,00
2026-02-10 Posto Shell R$ 200,50
`;

const PDF_TEXT_NO_DATES = `
Sem datas aqui
Linha sem valor monetario
`;

const PDF_TEXT_MIXED = `
Header sem dados relevantes

03/03/2026 iFood Entrega R$ 85,90
Linha invalida sem data R$ 999
2026-03-15 Spotify Premium 19.90
`;

describe('parsePdfStatementText', () => {
  it('extrai transações de texto com formato BR DD/MM/YYYY', () => {
    const result = parsePdfStatementText(PDF_TEXT_SIMPLE);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('extrai transações com data ISO YYYY-MM-DD', () => {
    const result = parsePdfStatementText(PDF_TEXT_ISO);
    expect(result).toHaveLength(2);
  });

  it('todas as transações têm amount > 0 e description não vazia', () => {
    const result = parsePdfStatementText(PDF_TEXT_SIMPLE);
    for (const tx of result) {
      expect(tx.amount).toBeGreaterThan(0);
      expect(tx.description.length).toBeGreaterThan(0);
    }
  });

  it('datas BR são convertidas corretamente para ISO', () => {
    const result = parsePdfStatementText(PDF_TEXT_SIMPLE);
    const first = result[0];
    expect(new Date(first.date).getUTCFullYear()).toBe(2026);
    expect(new Date(first.date).getUTCMonth()).toBe(0); // janeiro (UTC)
  });

  it('texto sem datas retorna array vazio', () => {
    const result = parsePdfStatementText(PDF_TEXT_NO_DATES);
    expect(result).toHaveLength(0);
  });

  it('ignora linhas sem data ou sem valor', () => {
    const result = parsePdfStatementText(PDF_TEXT_MIXED);
    expect(result.length).toBeGreaterThan(0);
    // todas devem ter amount > 0
    for (const tx of result) {
      expect(tx.amount).toBeGreaterThan(0);
    }
  });

  it('categoriza "iFood" como "alimentacao"', () => {
    const result = parsePdfStatementText(PDF_TEXT_MIXED);
    const ifood = result.find((r) => r.description.toLowerCase().includes('ifood'));
    expect(ifood).toBeDefined();
    expect(ifood!.category).toBe('alimentacao');
  });

  it('formato "pdf" está presente em todos os itens', () => {
    const result = parsePdfStatementText(PDF_TEXT_SIMPLE);
    for (const tx of result) {
      expect(tx.format).toBe('pdf');
    }
  });
});
