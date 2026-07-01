#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'AI CFO quality evidence runner';
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/ai-quality-evidence');
const DEFAULT_MIN_AVERAGE_SCORE = 0.9;

const RAW_CONTEXT_MARKERS = [
  '=== dados',
  'contas:',
  'total de transacoes',
  'regra operacional',
  'classificacao de caixa:',
];

const CANONICAL_CASES = [
  {
    name: 'cash_position_direct',
    intent: 'cash_position',
    answer: 'Leitura demo: caixa confirmado de R$ 5.000,00 e previsao de R$ 1.200,00 em 30 dias. Risco: se a entrada atrasar, segure gastos nao essenciais. Proxima acao: confirme os recebiveis antes de liberar nova despesa. Base resumida: confirmado, previsto e qualidade do dado.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'merchant_coverage'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 5.000,00',
        forecast_30d: 'R$ 1.200,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'risk_question_fallback',
    intent: 'risk_question',
    answer: 'Com base nos seus dados, nao consegui processar a consulta agora. Verifique sua conexao e tente novamente.',
    responseDepth: 'reduced',
    diagnostic: {
      kind: 'ai_unavailable',
      message: 'Com base nos seus dados, nao consegui processar a consulta agora.',
    },
    explainability: {
      confidence_band: 'low',
      reasons_used: ['limited_base', 'fallback'],
      evidence: {
        base_sufficiency: 'limited',
        confirmed_cash: 'R$ 500,00',
        forecast_30d: 'R$ 200,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'has_explainability',
      'has_low_confidence_fallback',
      'avoids_raw_context_leak',
      'uses_reduced_depth_when_limited',
    ],
  },
  {
    name: 'monthly_summary_with_prudence',
    intent: 'monthly_summary',
    answer: 'Leitura demo: caixa confirmado de R$ 12.000,00 e previsao de R$ 8.400,00 em 30 dias. Risco: acompanhe a entrada para evitar aperto no curto prazo. Proxima acao: confirme pendencias e nao trate previsao como saldo. Base resumida: caixa, previsao e resultado do mes.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'monthly_result'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 12.000,00',
        forecast_30d: 'R$ 8.400,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'negative_cash_runway',
    intent: 'risk_question',
    answer: 'Leitura demo: o risco esta na distancia entre caixa confirmado de R$ -800,00 e previsao de R$ -2.200,00 em 30 dias. Risco: se a entrada atrasar, segure gastos nao essenciais. Proxima acao: confirme os recebiveis antes de liberar nova despesa. Base resumida: caixa confirmado R$ -800,00, previsao 30 dias R$ -2.200,00, resultado do mes R$ -1.400,00, qualidade do dado 87%.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'risk_review'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ -800,00',
        forecast_30d: 'R$ -2.200,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'overdue_receivables',
    intent: 'receivables_question',
    answer: 'Leitura demo: recebiveis atrasados de R$ 1.900,00 ainda nao contam como caixa confirmado de R$ 1.200,00. Risco: confundir promessa de entrada com dinheiro disponivel pode apertar o caixa. Proxima acao: cobre o vencido primeiro e valide a data do proximo recebimento. Base resumida: caixa confirmado R$ 1.200,00, previsao 30 dias R$ 6.000,00, resultado do mes R$ 4.800,00, recebiveis atrasados R$ 1.900,00, pendencias a confirmar R$ 2.400,00, qualidade do dado 82%.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'overdue_receivables'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 1.200,00',
        forecast_30d: 'R$ 6.000,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'goal_at_risk',
    intent: 'risk_question',
    answer: 'Leitura demo: Faturar R$ 18.000,00 ate 2026-07-31 esta em risco porque o caixa confirmado e a previsao de 30 dias nao fecham a conta. Risco: manter a meta sem ajuste pode forcar gasto ou prazo irreal. Proxima acao: corte saidas, revise prazo ou reduza a meta para um nivel executavel. Base resumida: caixa confirmado R$ 4.200,00, previsao 30 dias R$ 5.500,00, resultado do mes R$ 1.300,00, meta em risco Faturar R$ 18.000,00 ate 2026-07-31, qualidade do dado 90%.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'goal_risk'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 4.200,00',
        forecast_30d: 'R$ 5.500,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'high_recurring_cost',
    intent: 'spending_advice',
    answer: 'Leitura demo: R$ 3.450,00 por mes pesa no caixa e reduz o espaco para novas despesas. Risco: recorrencias altas comprimem a margem antes mesmo da entrada prevista. Proxima acao: revise assinaturas, cancele o que nao usa e renegocie o que sobra. Base resumida: caixa confirmado R$ 8.000,00, previsao 30 dias R$ 6.100,00, resultado do mes R$ -1.900,00, custo recorrente R$ 3.450,00 por mes, qualidade do dado 85%.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'recurring_cost'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 8.000,00',
        forecast_30d: 'R$ 6.100,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
  {
    name: 'optimistic_forecast',
    intent: 'cash_position',
    answer: 'Leitura demo: a previsao parece otimista demais; R$ 9.800,00 nao deve ser tratado como saldo. Risco: usar esse numero como caixa mascara aperto de curto prazo. Proxima acao: rode um cenario conservador e segure compromissos nao essenciais ate a entrada cair. Base resumida: caixa confirmado R$ 2.900,00, previsao 30 dias R$ 9.800,00, resultado do mes R$ 6.900,00, pendencias a confirmar R$ 5.000,00, recebiveis atrasados R$ 2.100,00, previsao otimista R$ 9.800,00, qualidade do dado 78%.',
    responseDepth: 'standard',
    explainability: {
      confidence_band: 'high',
      reasons_used: ['confirmed_cash', 'forecast_30d', 'optimistic_forecast'],
      evidence: {
        base_sufficiency: 'strong',
        confirmed_cash: 'R$ 2.900,00',
        forecast_30d: 'R$ 9.800,00',
      },
    },
    expectedTraits: [
      'mentions_confirmed_cash',
      'mentions_forecast',
      'mentions_risk',
      'has_required_action',
      'avoids_absolute_promises',
      'avoids_raw_context_leak',
      'has_explainability',
      'uses_standard_depth_when_strong',
    ],
  },
];

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasRawContextLeak(answer) {
  const normalized = normalizeText(answer);
  return RAW_CONTEXT_MARKERS.some((marker) => normalized.includes(marker));
}

function hasExplainability(explainability) {
  return Boolean(
    explainability
    && Array.isArray(explainability.reasons_used)
    && explainability.reasons_used.length > 0
    && explainability.evidence
    && typeof explainability.evidence.base_sufficiency === 'string'
    && typeof explainability.confidence_band === 'string'
  );
}

function evaluateCase(testCase) {
  const answer = normalizeText(testCase.answer);
  const diagnosticMessage = normalizeText(testCase.diagnostic?.message || '');
  const explainability = testCase.explainability;
  const matchedTraits = [];
  const missingTraits = [];

  for (const trait of testCase.expectedTraits) {
    let ok = false;

    switch (trait) {
      case 'mentions_confirmed_cash':
        ok = answer.includes('confirmado')
          || answer.includes('caixa')
          || Boolean(explainability?.evidence?.confirmed_cash);
        break;
      case 'mentions_forecast':
        ok = answer.includes('30 dias')
          || answer.includes('previs')
          || answer.includes('proje')
          || Boolean(explainability?.evidence?.forecast_30d);
        break;
      case 'mentions_risk':
        ok = answer.includes('risco')
          || answer.includes('aten')
          || answer.includes('cuidado')
          || diagnosticMessage.includes('risco');
        break;
      case 'has_required_action':
        ok = answer.includes('proxima acao') || answer.includes('proxima ação');
        break;
      case 'avoids_absolute_promises':
        ok = !answer.includes('garantido')
          && !answer.includes('garantia')
          && !answer.includes('sempre')
          && !answer.includes('nunca');
        break;
      case 'avoids_raw_context_leak':
        ok = !hasRawContextLeak(testCase.answer);
        break;
      case 'has_explainability':
        ok = hasExplainability(explainability);
        break;
      case 'has_low_confidence_fallback':
        ok = explainability?.confidence_band === 'low'
          || Boolean(testCase.diagnostic)
          || answer.includes('nao consegui')
          || answer.includes('não consegui');
        break;
      case 'uses_reduced_depth_when_limited':
        ok = testCase.responseDepth === 'reduced'
          || explainability?.evidence?.base_sufficiency === 'limited';
        break;
      case 'uses_standard_depth_when_strong':
        ok = testCase.responseDepth === 'standard'
          || explainability?.evidence?.base_sufficiency === 'strong';
        break;
    }

    if (ok) {
      matchedTraits.push(trait);
    } else {
      missingTraits.push(trait);
    }
  }

  return {
    name: testCase.name,
    intent: testCase.intent,
    passed: missingTraits.length === 0,
    score: testCase.expectedTraits.length === 0 ? 1 : matchedTraits.length / testCase.expectedTraits.length,
    matchedTraits,
    missingTraits,
  };
}

function evaluateCases(cases = CANONICAL_CASES, minAverageScore = DEFAULT_MIN_AVERAGE_SCORE) {
  const results = cases.map(evaluateCase);
  const averageScore = results.length === 0
    ? 0
    : results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const failures = results.filter((result) => !result.passed);
  const status = averageScore >= minAverageScore && failures.length === 0 ? 'PASS' : 'BLOCK';

  return {
    status,
    summary: status === 'PASS'
      ? 'PASS: canonical AI CFO quality cases satisfy the offline evaluation contract'
      : 'BLOCK: SEM EVIDENCIA SUFICIENTE para qualidade canonica da IA consultiva',
    averageScore,
    minAverageScore,
    failures,
    results,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--output-dir') {
      args.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--output-dir=')) {
      args.outputDir = token.slice('--output-dir='.length);
      continue;
    }
    if (token === '--min-average-score') {
      args.minAverageScore = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--min-average-score=')) {
      args.minAverageScore = token.slice('--min-average-score='.length);
      continue;
    }
  }
  return args;
}

function parseScore(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - AI CFO quality evidence',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- average score: ${payload.result.averageScore.toFixed(4)}`,
    `- minimum average score: ${payload.result.minAverageScore}`,
    `- cases: ${payload.result.results.length}`,
    '',
    '## Cases',
    '',
  ];

  for (const result of payload.result.results) {
    lines.push(`- ${result.name}: ${result.passed ? 'PASS' : 'BLOCK'} (${result.score.toFixed(4)})`);
    if (result.missingTraits.length > 0) {
      lines.push(`  - missing: ${result.missingTraits.join(', ')}`);
    }
  }

  lines.push(
    '',
    '## What this report does not prove',
    '',
    '- It does not prove perceived quality from real users.',
    '- It does not prove cost control at production traffic volume.',
    '- It does not prove that users return weekly because of the AI.',
  );

  return `${lines.join('\n')}\n`;
}

async function writeArtifact(outputRoot, payload) {
  await fs.mkdir(outputRoot, { recursive: true });
  const runDir = path.join(outputRoot, formatTimestamp(new Date()));
  await fs.mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, 'report.json');
  const mdPath = path.join(runDir, 'report.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, buildMarkdown(payload), 'utf8');
  return { jsonPath, mdPath };
}

function printHelp() {
  process.stdout.write([
    'Flow Finance AI CFO quality evidence runner',
    '',
    'Usage:',
    '  node scripts/check-ai-quality-evidence.mjs [--output-dir <dir>] [--min-average-score <0..1>]',
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const outputRoot = path.resolve(process.cwd(), args.outputDir || process.env.AI_QUALITY_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT);
  const minAverageScore = parseScore(args.minAverageScore ?? process.env.AI_QUALITY_MIN_AVERAGE_SCORE, DEFAULT_MIN_AVERAGE_SCORE);
  const result = evaluateCases(CANONICAL_CASES, minAverageScore);
  const payload = {
    runnerName: RUNNER_NAME,
    timestamp: new Date().toISOString(),
    result,
  };
  const artifacts = await writeArtifact(outputRoot, payload);

  process.stdout.write('Flow Finance - AI CFO quality evidence\n');
  process.stdout.write('======================================\n');
  process.stdout.write(`Result: ${result.status}\n`);
  process.stdout.write(`Summary: ${result.summary}\n`);
  process.stdout.write(`Average score: ${result.averageScore.toFixed(4)}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);
  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      process.stdout.write(`- ${failure.name}: missing ${failure.missingTraits.join(', ')}\n`);
    }
  }

  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  CANONICAL_CASES,
  evaluateCase,
  evaluateCases,
  hasRawContextLeak,
  normalizeText,
  parseArgs,
};
