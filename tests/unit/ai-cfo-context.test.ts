import { describe, expect, it } from 'vitest';

import { buildCFOExplainability } from '../../src/ai/aiCFO';

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
});
