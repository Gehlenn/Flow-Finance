import { describe, expect, it } from 'vitest';

import { parseOFX } from '../../src/finance/ofxParser';
import { importOFX } from '../../src/importers/ofxImporter';
import { TransactionType } from '../../types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SGML_OFX = `
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260101
<TRNAMT>-150.00
<MEMO>Supermercado Extra
<NAME>Extra
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260105
<TRNAMT>5000.00
<MEMO>Salario Janeiro
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260110
<TRNAMT>-0.00
<MEMO>Zero valor ignorado
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const XML_OFX = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <DTPOSTED>20260201000000</DTPOSTED>
            <TRNAMT>-299.90</TRNAMT>
            <MEMO>Netflix Assinatura</MEMO>
            <NAME>Netflix</NAME>
          </STMTTRN>
          <STMTTRN>
            <DTPOSTED>20260215</DTPOSTED>
            <TRNAMT>3000.00</TRNAMT>
            <MEMO>Freelance Pagamento</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

const EMPTY_OFX = `OFXHEADER:100\n<OFX></OFX>`;

// ─── parseOFX (src/finance/ofxParser) ────────────────────────────────────────

describe('parseOFX (ofxParser)', () => {
  it('parseia SGML OFX e retorna 2 transações (ignora valor zero)', () => {
    const txs = parseOFX(SGML_OFX);
    expect(txs).toHaveLength(2);
  });

  it('SGML: debito vira DESPESA com amount positivo', () => {
    const txs = parseOFX(SGML_OFX);
    const debit = txs.find((t) => t.description.includes('Supermercado') || t.description.includes('Extra'));
    expect(debit).toBeDefined();
    expect(debit!.type).toBe(TransactionType.DESPESA);
    expect(debit!.amount).toBeGreaterThan(0);
  });

  it('SGML: credito vira RECEITA', () => {
    const txs = parseOFX(SGML_OFX);
    const credit = txs.find((t) => t.description.toLowerCase().includes('salario') || t.description.toLowerCase().includes('salário'));
    expect(credit).toBeDefined();
    expect(credit!.type).toBe(TransactionType.RECEITA);
    expect(credit!.amount).toBe(5000);
  });

  it('parseia XML OFX e retorna 2 transações', () => {
    const txs = parseOFX(XML_OFX);
    expect(txs).toHaveLength(2);
  });

  it('XML: data no formato YYYYMMDDHHMMSS é parseada corretamente', () => {
    const txs = parseOFX(XML_OFX);
    const netflix = txs.find((t) => t.description.includes('Netflix'));
    expect(netflix).toBeDefined();
    const d = new Date(netflix!.date);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(1); // fevereiro (0-based UTC)
  });

  it('XML: DESPESA tem amount positivo mesmo com TRNAMT negativo', () => {
    const txs = parseOFX(XML_OFX);
    const netflix = txs.find((t) => t.description.toLowerCase().includes('netflix'));
    expect(netflix).toBeDefined();
    expect(netflix!.amount).toBeCloseTo(299.9, 1);
  });

  it('OFX vazio retorna array vazio', () => {
    const txs = parseOFX(EMPTY_OFX);
    expect(txs).toHaveLength(0);
  });

  it('todas as transações têm id, date, amount, type e description', () => {
    const txs = parseOFX(SGML_OFX);
    for (const tx of txs) {
      expect(tx.id).toBeTruthy();
      expect(tx.date).toBeTruthy();
      expect(tx.amount).toBeGreaterThan(0);
      expect([TransactionType.RECEITA, TransactionType.DESPESA]).toContain(tx.type);
      expect(tx.description).toBeTruthy();
    }
  });
});

// ─── importOFX (src/importers/ofxImporter) ───────────────────────────────────

describe('importOFX (ofxImporter)', () => {
  function makeFile(content: string, name = 'extrato.ofx'): { name: string; text: () => Promise<string> } {
    return { name, text: () => Promise.resolve(content) };
  }

  it('retorna ImportedStatementTransaction[] com format="ofx"', async () => {
    const result = await importOFX(makeFile(SGML_OFX));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].format).toBe('ofx');
    expect(result[0].source).toBe('import');
  });

  it('categoriza "Netflix" como "assinaturas"', async () => {
    const result = await importOFX(makeFile(XML_OFX));
    const netflix = result.find((r) => r.description.toLowerCase().includes('netflix'));
    expect(netflix).toBeDefined();
    expect(netflix!.category).toBe('assinaturas');
  });

  it('arquivo OFX vazio retorna array vazio', async () => {
    const result = await importOFX(makeFile(EMPTY_OFX));
    expect(result).toHaveLength(0);
  });

  it('todos os itens têm amount > 0 e description não vazia', async () => {
    const result = await importOFX(makeFile(SGML_OFX));
    for (const tx of result) {
      expect(tx.amount).toBeGreaterThan(0);
      expect(tx.description.length).toBeGreaterThan(0);
    }
  });
});
