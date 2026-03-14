import { describe, expect, it } from 'vitest';

import { importOFX } from '../../src/importers/ofxImporter';
import { importCSV } from '../../src/importers/csvImporter';
import { parsePdfStatementText } from '../../src/importers/pdfStatementImporter';
import { normalizeImportedTransaction } from '../../src/importers/importNormalizer';
import {
  categorizeTransaction,
  categorizeTransactionWithAI,
} from '../../src/engines/finance/categorization/transactionCategorizer';
import { categorizationRules } from '../../src/engines/finance/categorization/categorizationRules';
import { aiCategorizeTransaction } from '../../src/engines/finance/categorization/aiCategorizerFallback';
import { detectAmount, detectDate, detectMerchant, parseReceiptText } from '../../src/ocr/receiptParser';
import { detectSubscriptions } from '../../src/engines/finance/subscriptionDetector';
import { calculateFinancialHealth } from '../../src/engines/finance/financialHealth/financialHealthEngine';
import { calculateGoalPlan } from '../../src/engines/finance/smartGoals/smartGoalsEngine';
import { recommendGoalAdjustment } from '../../src/engines/finance/smartGoals/goalRecommendationEngine';
import { buildFinancialTimeline } from '../../src/engines/finance/timeline/financialTimelineEngine';

describe('Estratégia sem Open Finance pago', () => {
  it('importOFX converte transações e aplica categorização', async () => {
    const file = {
      async text() {
        return `
<OFX>
  <STMTTRN>
    <TRNAMT>-34.90</TRNAMT>
    <DTPOSTED>20260314</DTPOSTED>
    <MEMO>UBER TRIP</MEMO>
    <NAME>UBER</NAME>
  </STMTTRN>
</OFX>`;
      },
    };

    const result = await importOFX(file);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(34.9);
    expect(result[0].category).toBe('transporte');
    expect(result[0].format).toBe('ofx');
  });

  it('importCSV converte transações para pipeline interno', async () => {
    const file = {
      async text() {
        return 'data;descricao;valor\n14/03/2026;iFood pedido;45,90';
      },
    };

    const result = await importCSV(file);
    expect(result).toHaveLength(1);
    expect(result[0].description.toLowerCase()).toContain('ifood');
    expect(result[0].category).toBe('alimentacao');
    expect(result[0].format).toBe('csv');
  });

  it('parsePdfStatementText extrai data, descrição e valor', () => {
    const text = '14/03/2026 NETFLIX.COM R$ 39,90\n15/03/2026 FARMACIA R$ 59,99';
    const result = parsePdfStatementText(text);

    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('assinaturas');
    expect(result[1].category).toBe('saude');
    expect(result[0].format).toBe('pdf');
  });

  it('normalizeImportedTransaction normaliza campos obrigatórios', () => {
    const normalized = normalizeImportedTransaction({
      amount: '39.90',
      date: '2026-03-14',
      description: '  Netflix  ',
      merchant: '  Netflix.com  ',
    });

    expect(normalized.amount).toBe(39.9);
    expect(normalized.description).toBe('Netflix');
    expect(normalized.merchant).toBe('Netflix.com');
    expect(normalized.source).toBe('import');
  });

  it('categorizationRules contém mapeamentos essenciais', () => {
    expect(categorizationRules.uber).toBe('transporte');
    expect(categorizationRules.netflix).toBe('assinaturas');
  });

  it('categorizeTransaction aplica regras simples', () => {
    expect(categorizeTransaction('Uber viagem centro')).toBe('transporte');
    expect(categorizeTransaction('Netflix mensalidade')).toBe('assinaturas');
    expect(categorizeTransaction('texto desconhecido')).toBe('outros');
  });

  it('categorizeTransactionWithAI usa fallback IA quando regra falha', async () => {
    const category = await categorizeTransactionWithAI('Cafeteria XPTO', {
      aiFallback: async () => 'alimentacao',
    });

    expect(category).toBe('alimentacao');
  });

  it('aiCategorizeTransaction retorna outros quando IA falha', async () => {
    const category = await aiCategorizeTransaction({ description: 'teste' }, {
      suggestCategory: async () => null,
    });

    expect(category).toBe('outros');
  });

  it('receiptParser detecta valor, data e merchant', () => {
    const receiptText = 'SUPERMERCADO XYZ\nData 14/03/2026\nTOTAL R$ 123,45';

    expect(detectAmount(receiptText)).toBe(123.45);
    expect(detectDate(receiptText)).toBeTruthy();
    expect(detectMerchant(receiptText)).toBe('SUPERMERCADO XYZ');

    const parsed = parseReceiptText(receiptText);
    expect(parsed.amount).toBe(123.45);
    expect(parsed.merchant).toBe('SUPERMERCADO XYZ');
  });

  it('detectSubscriptions encontra recorrências por merchant+amount', () => {
    const recurring = detectSubscriptions([
      { date: '2026-01-01', amount: 39.9, description: 'NETFLIX.COM' },
      { date: '2026-02-01', amount: 39.9, description: 'NETFLIX.COM' },
      { date: '2026-03-01', amount: 39.9, description: 'NETFLIX.COM' },
      { date: '2026-03-05', amount: 20, description: 'Lanche' },
    ]);

    expect(recurring).toHaveLength(1);
    expect(recurring[0].occurrences).toBe(3);
    expect(recurring[0].amount).toBe(39.9);
  });

  it('calculateFinancialHealth aplica penalidades dos critérios', () => {
    const result = calculateFinancialHealth({
      expenseRatio: 0.95,
      savingsRate: 0.05,
      debtRatio: 0.4,
      balanceStability: 0.4,
      forecast: { in30Days: -100 },
      subscriptionCount: 6,
    });

    expect(result.score).toBeLessThan(70);
    expect(['critico', 'atencao']).toContain(result.status);
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it('calculateGoalPlan calcula economia mensal recomendada', () => {
    const plan = calculateGoalPlan({
      targetAmount: 10000,
      currentAmount: 1000,
      targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 9, 1).toISOString(),
    });

    expect(plan.remaining).toBe(9000);
    expect(plan.recommendedMonthlySavings).not.toBeNull();
  });

  it('recommendGoalAdjustment sugere estabilização quando saúde está baixa', () => {
    const recommendation = recommendGoalAdjustment(
      { recommendedMonthlySavings: 500 },
      { in30Days: 200 },
      { score: 50 },
    );

    expect(recommendation).toContain('estabilize sua saúde financeira');
  });

  it('buildFinancialTimeline agrupa transações por mês', () => {
    const timeline = buildFinancialTimeline([
      { date: '2026-01-10', amount: 5000 },
      { date: '2026-01-11', amount: -200 },
      { date: '2026-02-05', amount: -100 },
    ]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0].month).toBe('2026-01');
    expect(timeline[0].balance).toBe(4800);
  });
});
