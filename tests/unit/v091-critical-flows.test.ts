import { describe, expect, it, vi } from 'vitest';

import { formatCurrency } from '../../backend/src/utils/currencyUtils';
import { categorizeTransaction, categorizeTransactionWithAI } from '../../src/engines/finance/categorization/transactionCategorizer';
import {
  getWorkspaceStorageScope,
  getWorkspaceScopedStorageKey,
} from '../../src/utils/workspaceStorage';
import * as aiFallback from '../../src/engines/finance/categorization/aiCategorizerFallback';

vi.mock('../../src/engines/finance/categorization/aiCategorizerFallback', () => ({
  aiCategorizeTransaction: vi.fn(async () => 'assinaturas'),
  saveMerchantCategoryLearning: vi.fn(async () => undefined),
}));

describe('v0.9.1 critical flows', () => {
  it('normaliza exibição monetária BRL para valores positivos, zero e negativos', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    expect(formatCurrency(0)).toBe('R$ 0,00');
    expect(formatCurrency(-12.34)).toBe('-R$ 12,34');
  });

  it('categoriza por regra determinística com acento e merchant conhecido', () => {
    expect(categorizeTransaction('Assinatura de vídeo', 'NetFlix')).toBe('assinaturas');
  });

  it('não chama fallback IA quando regra já categoriza', async () => {
    const aiSpy = vi.spyOn(aiFallback, 'aiCategorizeTransaction');

    const category = await categorizeTransactionWithAI('Corrida Uber', {
      merchant: 'Uber',
      userId: 'u-01',
    });

    expect(category).toBe('transporte');
    expect(aiSpy).not.toHaveBeenCalled();
  });

  it('aplica fallback IA e persiste learning quando regra retorna outros', async () => {
    const aiSpy = vi.spyOn(aiFallback, 'aiCategorizeTransaction');
    const learningSpy = vi.spyOn(aiFallback, 'saveMerchantCategoryLearning');

    const category = await categorizeTransactionWithAI('Compra sem contexto', {
      merchant: 'Loja Desconhecida',
      userId: 'u-01',
    });

    expect(category).toBe('assinaturas');
    expect(aiSpy).toHaveBeenCalledTimes(1);
    expect(learningSpy).toHaveBeenCalledWith('u-01', 'Loja Desconhecida', 'assinaturas', 0.95);
  });

  it('isola persistência por workspace (string vazia, nulo e definido)', () => {
    expect(getWorkspaceStorageScope('   ')).toBe('global');
    expect(getWorkspaceStorageScope(null)).toBe('global');
    expect(getWorkspaceStorageScope(undefined)).toBe('global');
    expect(getWorkspaceScopedStorageKey('flow:transactions', 'ws-123')).toBe('flow:transactions:ws-123');
  });
});
