import logger from '../../config/logger';
import * as Sentry from '@sentry/node';

/**
 * PromptInjectionGuard: Defesa em camadas contra prompt injection.
 * Estratégia: pattern matching rápido → regras adicionais → score de risco.
 * Resultado: allow, review, ou block.
 * 
 * IMPORTANTE: Não substitui arquitetura segura (system prompt server-side, isolamento de contexto, etc).
 * Esta é uma camada adicional conservadora e facilmente evoluível.
 */

export type PromptRiskLevel = 'allow' | 'review' | 'block';

export interface PromptGuardResult {
  level: PromptRiskLevel;
  reasons: string[];
  sanitizedInput: string;
  riskScore: number; // 0-100
}

/**
 * Padrões suspeitos de injection varrem a entrada.
 * Mantidos como expressões regulares compiladas e rápidas.
 */
const INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
}> = [
  // Instruções para ignorar regras anteriores
  {
    pattern: /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above)\s+(instructions|rules|prompts?)/i,
    name: 'ignore_previous_instructions'
  },
  {
    pattern: /disregard\s+(all\s+|the\s+)?(previous|above)\s+(instructions|rules)/i,
    name: 'disregard_instructions'
  },
  {
    pattern: /forget\s+(everything\s+)?(you\s+)?were\s+told/i,
    name: 'forget_instructions'
  },

  // Pedir para revelar prompt/sistema
  {
    pattern: /reveal\s+(the\s+)?(system|hidden|internal|secret)\s+(prompt|instructions|rules)/i,
    name: 'reveal_system_prompt'
  },
  {
    pattern: /show\s+(me\s+)?(the\s+)?(system\s+)?prompt/i,
    name: 'show_prompt'
  },
  {
    pattern: /(what\s+is\s+|describe\s+|explain\s+)(your\s+)?system\s+prompt/i,
    name: 'query_system_prompt'
  },

  // Role-playing/Jailbreak clássicos
  {
    pattern: /(act\s+as|you\s+are\s+now|pretend\s+to\s+be)\s+(?!a.*user|an?)/i,
    name: 'role_play_attack'
  },
  {
    pattern: /(DAN|do\s+anything\s+now|developer?\s+mode|jailbreak|unrestricted)/i,
    name: 'jailbreak_attempt'
  },

  // Tentar extrair dados sensíveis
  {
    pattern: /(print|show|dump|expose|leak)\s+.*(token|secret|key|password|env|credentials|api_key|api.?key)/i,
    name: 'extract_secrets'
  },
  {
    pattern: /(reveal|give\s+me|send|provide)\s+.*(token|secret|key|password|credentials)/i,
    name: 'request_secrets'
  },

  // Bypass de segurança
  {
    pattern: /(bypass|disable|turn\s+off|deactivate|remove)\s+.*(safety|security|filters|guardrails|checks)/i,
    name: 'bypass_safety'
  },
  {
    pattern: /(override|circumvent)\s+.*(protection|defense|policy)/i,
    name: 'override_protection'
  }
];

/**
 * Termos suspeitos em contexto financeiro.
 * Lista curta e alta-confiança.
 */
const SUSPICIOUS_TERMS = [
  'system prompt',
  'hidden prompt',
  'ignore instructions',
  'developer mode',
  'jailbreak',
  'revealsecrets',
  'api key',
  '.env',
  'password',
  'token',
  'credentials',
  'secret',
  'backdoor',
  'exploit'
];

/**
 * Validar input de usuário antes de enviar ao LLM.
 * Retorna: allow (seguro) | review (suspeito mas talvez ok) | block (perigoso).
 */
export function validatePromptInput(rawInput: string): PromptGuardResult {
  const reasons: string[] = [];
  let riskScore = 0;

  // 1. Normalização segura de string
  const normalized = rawInput
    .normalize('NFKC') // Decomposição Unicode segura
    .replace(/\u0000/g, '') // Remover null bytes
    .replace(/[\r\n\t]+/g, ' ') // Normalizar whitespace
    .trim()
    .slice(0, 4000); // Truncar para limite seguro

  if (!normalized) {
    return {
      level: 'block',
      reasons: ['empty_input'],
      sanitizedInput: '',
      riskScore: 100
    };
  }

  // 2. Verificar tamanho excessivo
  if (rawInput.length > 4000) {
    reasons.push('input_truncated_at_4000_chars');
    riskScore += 5;
  }

  // 3. Verificação de padrões de injection (camada rápida)
  // Qualquer padrão de injection detectado vale 30 pontos — alcança o threshold de block diretamente.
  for (const { pattern, name } of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push(`pattern_detected:${name}`);
      riskScore += 30;
    }
  }

  // 4. Verificação de termos suspeitos
  const lower = normalized.toLowerCase();
  for (const term of SUSPICIOUS_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      reasons.push(`suspicious_term:${term}`);
      riskScore += 10;
    }
  }

  // 5. Estrutura suspeita: quebras de linha excessivas
  const repeatedNewlines = (rawInput.match(/\n{4,}/g) || []).length;
  if (repeatedNewlines > 0) {
    reasons.push(`excessive_newlines:${repeatedNewlines}`);
    riskScore += 8;
  }

  // 6. Verificar padrões de encoding/obfuscamento
  if (hasEncodingPatterns(rawInput)) {
    reasons.push('encoding_obfuscation_detected');
    riskScore += 12;
  }

  // 7. Verificar estrutura de JSON/eval malicionoso
  if (hasMaliciousJSONPatterns(rawInput)) {
    reasons.push('malicious_json_structure_detected');
    riskScore += 20;
  }

  // 8. Contexto financeiro: verificar misuse de operações
  if (isFinancialMisuse(lower)) {
    reasons.push('financial_misuse_detected');
    riskScore += 15;
  }

  // Tomada de decisão final
  // block ≥ 30: qualquer padrão de injection direto → bloquear
  // review ≥ 20: combinação de sinais suspeitos → revisar
  let level: PromptRiskLevel;

  if (riskScore >= 30) {
    level = 'block';
    logger.warn(
      { riskScore, reasonCount: reasons.length, reasons },
      `Prompt injection blocked: high risk score`
    );

    Sentry.captureMessage(
      `Prompt injection BLOCKED: risk score ${riskScore}, reasons: ${reasons.join(', ')}`,
      'warning'
    );
  } else if (riskScore >= 20) {
    level = 'review';
    logger.info(
      { riskScore, reasonCount: reasons.length, reasons },
      `Prompt injection detected: medium risk, requires review`
    );

    Sentry.captureMessage(
      `Prompt injection review flag: risk score ${riskScore}, reasons: ${reasons.join(', ')}`,
      'info'
    );
  } else {
    level = 'allow';
  }

  return {
    level,
    reasons,
    sanitizedInput: normalized,
    riskScore
  };
}

/**
 * Resposta segura padrão quando bloquear prompt injection.
 */
export function getSafeBlockedResponse(): string {
  return (
    'Posso ajudar apenas com temas financeiros e uso do Flow Finance. ' +
    'Reformule sua pergunta dentro desse contexto.'
  );
}

/**
 * Detectar padrões de encoding/obfuscamento (base64, hex, rot13, etc).
 */
function hasEncodingPatterns(input: string): boolean {
  // Base64 com alta densidade (sequências longas de caracteres base64)
  const base64Pattern = /[A-Za-z0-9+/=]{80,}/;
  if (base64Pattern.test(input)) {
    return true;
  }

  // Hex encoding
  const hexPattern = /\\x[0-9a-fA-F]{2}/g;
  if ((input.match(hexPattern) || []).length > 5) {
    return true;
  }

  // Unicode escapes
  const unicodePattern = /\\u[0-9a-fA-F]{4}/g;
  if ((input.match(unicodePattern) || []).length > 5) {
    return true;
  }

  return false;
}

/**
 * Detectar padrões maliciosos em JSON/estruturas de dados.
 */
function hasMaliciousJSONPatterns(input: string): boolean {
  // JSON com eval/exec
  if (/["']?\s*(?:eval|exec|Function|constructor)\s*["']?\s*:/i.test(input)) {
    return true;
  }

  // Prototype pollution
  if (/__proto__|constructor|prototype/.test(input)) {
    return true;
  }

  // Command injection patterns
  if (/[;&|`$(){}[\]]+/.test(input) && input.includes(';')) {
    return true;
  }

  return false;
}

/**
 * Verificar misuse em contexto financeiro.
 * Procura por padrões que tentam fazer operações não-financeiras.
 */
function isFinancialMisuse(lowerInput: string): boolean {
  const nonFinancialCommands = [
    'delete database',
    'drop table',
    'truncate',
    'rm -rf',
    'format',
    'wiped',
    'hack',
    'inject',
    'exploit',
    'modify user',
    'change password',
    'steal',
    'transfer to'
  ];

  for (const cmd of nonFinancialCommands) {
    if (lowerInput.includes(cmd)) {
      return true;
    }
  }

  return false;
}

/**
 * Helper: Processar input antes de enviar ao LLM.
 * Integra validação de injection e retorna resposta segura se bloqueado.
 */
export async function processUserInputSafely(
  rawInput: string
): Promise<{ approved: boolean; input: string; blockReason?: string }> {
  const result = validatePromptInput(rawInput);

  if (result.level === 'block') {
    return {
      approved: false,
      input: result.sanitizedInput,
      blockReason: `Prompt injection detected. Risk score: ${result.riskScore}. Reasons: ${result.reasons.join(', ')}`
    };
  }

  if (result.level === 'review') {
    // Em produção, pode logar para revisão manual ou aplicar restrições extras
    logger.info(
      { riskScore: result.riskScore, reasons: result.reasons },
      'Input flagged for review'
    );
  }

  return {
    approved: true,
    input: result.sanitizedInput
  };
}

export default {
  validatePromptInput,
  getSafeBlockedResponse,
  processUserInputSafely
};
