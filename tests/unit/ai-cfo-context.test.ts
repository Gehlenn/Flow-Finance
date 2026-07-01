import { describe, expect, it } from 'vitest';

import { buildCFOExplainability, buildCFOResponseDepth } from '../../src/ai/aiCFO';
import type { CFOIntent } from '../../src/ai/aiCFOTypes';

describe('aiCFO explainability', () => {
  const context = [
    '=== DADOS FINANCEIROS DO USUARIO ===',
    '',
    'TOTAL DE TRANSACOES REGISTRADAS: 6',
    'Confirmado (disponivel hoje): R$ 5.000,00',
    'Em 30 dias: R$ 1.200,00',
    '- Resultado: R$ -800,00',
    'QUALIDADE DOS DADOS (merchant coverage): 84%',
  ].join('\n');

  it('gera evidencias objetivas e nivel de confianca alto quando a base e forte', () => {
    const explainability = buildCFOExplainability(context, 'cash_position');

    expect(explainability.confidence_band).toBe('high');
    expect(explainability.reasons_used).toEqual(
      expect.arrayContaining([
        'Classificacao de caixa confirmado vs previsto.',
        'Projecao de 30 dias para risco de curto prazo.',
        'Leitura operacional com base em contexto financeiro real do workspace.',
      ]),
    );
    expect(explainability.evidence).toEqual(
      expect.objectContaining({
        confirmed_cash: 'R$ 5.000,00',
        forecast_30d: 'R$ 1.200,00',
        month_result: 'R$ -800,00',
        data_quality_note: '84%',
        base_sufficiency: 'strong',
      }),
    );
  });

  it('forca nivel baixo quando a explicabilidade pede fallback', () => {
    const explainability = buildCFOExplainability(context, 'risk_question', {
      forceLowConfidence: true,
    });

    expect(explainability.confidence_band).toBe('low');
    expect(explainability.evidence.base_sufficiency).toBe('strong');
    expect(explainability.reasons_used.length).toBeGreaterThan(0);
  });

  it('reduz a profundidade quando a base e limitada', () => {
    const limitedContext = [
      'TOTAL DE TRANSACOES REGISTRADAS: 2',
      'Confirmado (disponivel hoje): R$ 1.000,00',
    ].join('\n');

    const explainability = buildCFOExplainability(limitedContext, 'cash_position');

    expect(explainability.evidence.base_sufficiency).toBe('limited');
    expect(buildCFOResponseDepth(explainability)).toBe('reduced');
  });

  it('mantem casos canonicos offline dentro de uma postura consultiva prudente', () => {
    const cases: Array<{
      label: string;
      intent: CFOIntent;
      context: string;
      expectedDepth: 'standard' | 'reduced';
    }> = [
      {
        label: 'caixa negativo',
        intent: 'risk_question',
        context: [
          'TOTAL DE TRANSACOES REGISTRADAS: 7',
          'Confirmado (disponivel hoje): R$ -500,00',
          'Em 30 dias: R$ -1.200,00',
          '- Resultado: R$ -2.400,00',
          'QUALIDADE DOS DADOS (merchant coverage): 86%',
          'REGRA OPERACIONAL:',
          '  - Nunca considerar pendente como dinheiro disponivel.',
        ].join('\n'),
        expectedDepth: 'standard',
      },
      {
        label: 'recebiveis atrasados',
        intent: 'receivables_question',
        context: [
          'TOTAL DE TRANSACOES REGISTRADAS: 6',
          'Confirmado (disponivel hoje): R$ 2.100,00',
          'Em 30 dias: R$ 5.800,00',
          '- Resultado: R$ 900,00',
          'Vencido (atrasado): R$ 3.400,00',
          'REGRA OPERACIONAL:',
          '  - Nunca considerar pendente como dinheiro disponivel.',
        ].join('\n'),
        expectedDepth: 'standard',
      },
      {
        label: 'meta em risco',
        intent: 'savings_question',
        context: [
          'TOTAL DE TRANSACOES REGISTRADAS: 4',
          'Confirmado (disponivel hoje): R$ 800,00',
          'Em 30 dias: R$ 700,00',
          '- Resultado: R$ -300,00',
          'REGRA OPERACIONAL:',
          '  - Nunca considerar pendente como dinheiro disponivel.',
        ].join('\n'),
        expectedDepth: 'reduced',
      },
      {
        label: 'custo recorrente alto',
        intent: 'spending_advice',
        context: [
          'TOTAL DE TRANSACOES REGISTRADAS: 9',
          'Confirmado (disponivel hoje): R$ 4.500,00',
          'Em 30 dias: R$ 2.200,00',
          '- Resultado: R$ -1.100,00',
          'MAIOR CATEGORIA DE GASTOS:',
          '  - Software: R$ 2.000,00',
          'QUALIDADE DOS DADOS (merchant coverage): 91%',
        ].join('\n'),
        expectedDepth: 'standard',
      },
      {
        label: 'forecast otimista demais',
        intent: 'risk_question',
        context: [
          'TOTAL DE TRANSACOES REGISTRADAS: 3',
          'Confirmado (disponivel hoje): R$ 1.000,00',
          'Em 30 dias: R$ 12.000,00',
          '- Resultado: R$ -150,00',
          'Pendente (a confirmar): R$ 11.000,00',
          'REGRA OPERACIONAL:',
          '  - Nunca considerar pendente como dinheiro disponivel.',
        ].join('\n'),
        expectedDepth: 'reduced',
      },
    ];

    for (const item of cases) {
      const explainability = buildCFOExplainability(item.context, item.intent);

      expect(explainability.reasons_used).toEqual(
        expect.arrayContaining([
          item.intent === 'risk_question' || item.intent === 'spending_advice'
            ? 'Leitura conservadora para evitar usar recebivel pendente como caixa disponivel.'
            : 'Leitura operacional com base em contexto financeiro real do workspace.',
        ]),
      );
      expect(buildCFOResponseDepth(explainability), item.label).toBe(item.expectedDepth);
      expect(explainability.evidence.confirmed_cash, item.label).toMatch(/^R\$/);
      expect(explainability.evidence.forecast_30d, item.label).toMatch(/^R\$/);
    }
  });
});
