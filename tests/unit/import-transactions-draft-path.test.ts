import { describe, expect, it } from 'vitest';

import { TransactionType, Category } from '../../types';
import { mapImportedItemsToDraftTransactions } from '../../pages/ImportTransactions';

describe('ImportTransactions draft path', () => {
  it('converte itens selecionados para transacoes via TransactionDraft', () => {
    const result = mapImportedItemsToDraftTransactions([
      {
        raw_date: '2026-04-09T10:00:00.000Z',
        raw_amount: 150,
        raw_description: 'Consulta odontologica',
        raw_type: TransactionType.RECEITA,
        category: Category.NEGOCIO,
        merchant: 'Clinica XYZ',
        confidence: 0.91,
        selected: true,
      },
      {
        raw_date: '2026-04-10T10:00:00.000Z',
        raw_amount: 80,
        raw_description: 'Duplicada',
        raw_type: TransactionType.DESPESA,
        selected: true,
        duplicate: true,
      },
      {
        raw_date: '2026-04-11T10:00:00.000Z',
        raw_amount: 90,
        raw_description: 'Nao selecionada',
        raw_type: TransactionType.DESPESA,
        selected: false,
      },
    ] as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      amount: 150,
      type: TransactionType.RECEITA,
      category: Category.NEGOCIO,
      source: 'import',
      confidence_score: 0.91,
    });
  });
});
