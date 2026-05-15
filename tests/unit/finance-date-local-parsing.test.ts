import { afterEach, describe, expect, it, vi } from 'vitest';

import { importCSV } from '../../src/importers/csvImporter';
import { importOFX } from '../../src/importers/ofxImporter';
import { calculateMoneyDistribution } from '../../src/finance/moneyMap';
import { generateMonthlyReport } from '../../src/finance/reportEngine';
import { Category, TransactionType } from '../../types';

function makeFile(content: string, name: string) {
  return {
    name,
    text: () => Promise.resolve(content),
  };
}

describe('finance date local parsing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mantem datas-only locais no CSV importado', async () => {
    const result = await importCSV(makeFile(
      'Date,Description,Amount\n2026-04-10,Aluguel,1500.50\n',
      'statement.csv',
    ));

    expect(result).toHaveLength(1);
    const parsed = new Date(result[0].date);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(3);
    expect(parsed.getUTCDate()).toBe(10);
  });

  it('mantem datas-only locais no OFX importado', async () => {
    const result = await importOFX(makeFile(
      `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260410
<TRNAMT>-150.00
<MEMO>Supermercado
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`,
      'statement.ofx',
    ));

    expect(result).toHaveLength(1);
    const parsed = new Date(result[0].date);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(3);
    expect(parsed.getUTCDate()).toBe(10);
  });

  it('faz o relatÃ³rio mensal respeitar datas-only locais', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));

    const report = generateMonthlyReport([
      {
        id: 'income-1',
        amount: 2000,
        type: TransactionType.RECEITA,
        category: Category.PESSOAL,
        description: 'Salario',
        date: '2026-04-10',
      },
      {
        id: 'expense-1',
        amount: 500,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: '2026-03-31',
      },
    ] as never);

    expect(report.month).toBe('2026-04');
    expect(report.total_income).toBe(2000);
    expect(report.total_expenses).toBe(0);
  });

  it('faz o MoneyMap respeitar datas-only locais no periodo e no trend', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));

    const distribution = calculateMoneyDistribution([
      {
        id: 'current-expense',
        amount: 100,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: '2026-05-05',
      },
      {
        id: 'previous-expense',
        amount: 50,
        type: TransactionType.DESPESA,
        category: Category.PESSOAL,
        description: 'Mercado',
        date: '2026-04-05',
      },
    ] as never);

    expect(distribution.total_expenses).toBe(100);
    expect(distribution.distribution[0]?.trend).toBe('up');
  });
});

