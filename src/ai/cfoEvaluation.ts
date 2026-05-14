import type { AICFOExplainability, AICFOResponse, CFOIntent } from './aiCFO';

export interface CFOEvaluationCase {
  name: string;
  intent: CFOIntent;
  response: AICFOResponse;
  expectedTraits: Array<'mentions_confirmed_cash' | 'mentions_forecast' | 'mentions_risk' | 'avoids_absolute_promises' | 'has_explainability' | 'has_low_confidence_fallback'>;
}

export interface CFOEvaluationResult {
  name: string;
  passed: boolean;
  score: number;
  matchedTraits: string[];
  missingTraits: string[];
}

function normalizeText(text: string): string {
  return text.toLowerCase();
}

function hasExplainability(explainability?: AICFOExplainability): boolean {
  return Boolean(
    explainability
    && Array.isArray(explainability.reasons_used)
    && explainability.reasons_used.length > 0
    && explainability.evidence
    && typeof explainability.evidence.base_sufficiency === 'string'
    && typeof explainability.confidence_band === 'string'
  );
}

function evaluateTraits(response: AICFOResponse, traits: CFOEvaluationCase['expectedTraits']): { matched: string[]; missing: string[] } {
  const answer = normalizeText(response.answer || '');
  const contextSummary = normalizeText(response.context_summary || '');
  const diagnosticMessage = normalizeText(response.diagnostic?.message || '');
  const explainability = response.explainability;

  const matched: string[] = [];
  const missing: string[] = [];

  for (const trait of traits) {
    let ok = false;

    switch (trait) {
      case 'mentions_confirmed_cash':
        ok = answer.includes('confirmado')
          || answer.includes('caixa')
          || contextSummary.includes('confirmado')
          || Boolean(explainability?.evidence.confirmed_cash);
        break;
      case 'mentions_forecast':
        ok = answer.includes('30 dias')
          || answer.includes('previs')
          || answer.includes('proje')
          || Boolean(explainability?.evidence.forecast_30d);
        break;
      case 'mentions_risk':
        ok = answer.includes('risco')
          || answer.includes('aten')
          || answer.includes('cuidado')
          || answer.includes('perigo')
          || diagnosticMessage.includes('risco');
        break;
      case 'avoids_absolute_promises':
        ok = !answer.includes('garantido')
          && !answer.includes('garantia')
          && !answer.includes('sempre')
          && !answer.includes('nunca');
        break;
      case 'has_explainability':
        ok = hasExplainability(explainability);
        break;
      case 'has_low_confidence_fallback':
        ok = explainability?.confidence_band === 'low'
          || Boolean(response.diagnostic)
          || answer.includes('nao consegui')
          || answer.includes('não consegui');
        break;
    }

    if (ok) {
      matched.push(trait);
    } else {
      missing.push(trait);
    }
  }

  return { matched, missing };
}

export function evaluateCFOCase(testCase: CFOEvaluationCase): CFOEvaluationResult {
  const { matched, missing } = evaluateTraits(testCase.response, testCase.expectedTraits);
  const score = testCase.expectedTraits.length === 0 ? 1 : matched.length / testCase.expectedTraits.length;

  return {
    name: testCase.name,
    passed: missing.length === 0,
    score,
    matchedTraits: matched,
    missingTraits: missing,
  };
}

export function evaluateCFOCases(testCases: CFOEvaluationCase[]): CFOEvaluationResult[] {
  return testCases.map(evaluateCFOCase);
}
