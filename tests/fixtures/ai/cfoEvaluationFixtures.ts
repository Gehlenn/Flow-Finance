import type { CFOEvaluationCase } from '../../../src/ai/cfoEvaluation';
import type { CFOIntent } from '../../../src/ai/aiCFO';

export interface CFOEvaluationFixtureInput {
  name: string;
  question: string;
  context: string;
  intent: CFOIntent;
  expectedTraits: CFOEvaluationCase['expectedTraits'];
  mockMode: 'success' | 'failure';
  mockAnswer?: string;
}

export const CFO_EVALUATION_FIXTURES: CFOEvaluationFixtureInput[] = [
  {
    name: 'cash_position_direct',
    question: 'Posso gastar agora?',
    intent: 'cash_position',
    context: [
      '=== DADOS FINANCEIROS DO USUARIO ===',
      'TOTAL DE TRANSACOES REGISTRADAS: 8',
      'Confirmado (disponivel hoje): R$ 5.000,00',
      'Em 30 dias: R$ 1.200,00',
      '- Resultado: R$ -800,00',
      'QUALIDADE DOS DADOS (merchant coverage): 84%',
    ].join('\n'),
    mockMode: 'success',
    mockAnswer: 'Seu caixa confirmado hoje e de R$ 5.000,00. Em 30 dias a projeção aponta R$ 1.200,00 e ha risco se mantiver o ritmo atual.',
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'avoids_absolute_promises',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'risk_question_with_fallback',
    question: 'Qual o risco de apertar o caixa?',
    intent: 'risk_question',
    context: [
      '=== DADOS FINANCEIROS DO USUARIO ===',
      'TOTAL DE TRANSACOES REGISTRADAS: 4',
      'Confirmado (disponivel hoje): R$ 500,00',
      'Em 30 dias: R$ 200,00',
      '- Resultado: R$ -120,00',
      'QUALIDADE DOS DADOS (merchant coverage): 55%',
    ].join('\n'),
    mockMode: 'failure',
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'has_explainability',
      'has_low_confidence_fallback',
      'uses_reduced_depth_when_limited',
    ],
  },
  {
    name: 'monthly_summary_with_prudence',
    question: 'Como foi meu fechamento do mes?',
    intent: 'monthly_summary',
    context: [
      '=== DADOS FINANCEIROS DO USUARIO ===',
      'TOTAL DE TRANSACOES REGISTRADAS: 12',
      'Confirmado (disponivel hoje): R$ 12.000,00',
      'Em 30 dias: R$ 8.400,00',
      '- Resultado: R$ 3.600,00',
      'QUALIDADE DOS DADOS (merchant coverage): 91%',
    ].join('\n'),
    mockMode: 'success',
    mockAnswer: 'Fechamento positivo: caixa confirmado de R$ 12.000,00, projeção de R$ 8.400,00 em 30 dias e sem promessa absoluta para o proximo ciclo.',
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'avoids_absolute_promises',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
];
