#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Audit claims guard runner';
const DEFAULT_DOCS_DIR = path.resolve(process.cwd(), 'docs');
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/audit-claims');

const CLAIM_PATTERNS = [
  {
    id: 'retention_proven',
    severity: 'P1',
    description: 'Retention or habit proof claim without explicit evidence boundary',
    pattern: /(?:retenc(?:ao|ao)|reten(?:c|ç)(?:ao|ão)|retention|habito|h(?:a|á)bito|habit).{0,80}(?:comprovad[ao]|provad[ao]|proven|validated|validad[ao]|fechad[ao]|closed|success claim|rate)|(?:comprovad[ao]|provad[ao]|proven).{0,80}(?:retenc(?:ao|ao)|reten(?:c|ç)(?:ao|ão)|retention|habito|h(?:a|á)bito|habit)/i,
  },
  {
    id: 'commercial_scale_ready',
    severity: 'P1',
    description: 'Commercial scale or production readiness claim without caveat',
    pattern: /(?:saas\s+)?(?:pronto|ready).{0,80}(?:escala comercial|escala ampla|production scale|produc(?:ao|ão)|production)|(?:public launch is not blocked)|(?:ready for production scale)|(?:pronto para escala)/i,
  },
  {
    id: 'ai_user_validated',
    severity: 'P1',
    description: 'AI validation claim without real-user evidence boundary',
    pattern: /(?:ia|ai cfo|cfo).{0,120}(?:validad[ao] por usu(?:a|á)rios|validated by users|\baprende\b|aut[oô]nomo|move comportamento)|(?:validad[ao] por usu(?:a|á)rios).{0,120}(?:ia|ai|cfo)/i,
  },
  {
    id: 'paid_conversion_proven',
    severity: 'P1',
    description: 'Paid conversion or monetization proof claim without economic evidence boundary',
    pattern: /(?:convers(?:ao|ão)|conversion|paid conversion|monetiza(?:c|ç)(?:ao|ão)|monetization).{0,100}(?:comprovad[ao]|provad[ao]|proven|validad[ao]|validated)|(?:checkout|billing|stripe).{0,120}(?:prova|proves|validates).{0,120}(?:modelo|econom(?:ico|ic)|monetiza(?:c|ç)(?:ao|ão)|monetization)/i,
  },
  {
    id: 'investment_claim',
    severity: 'P1',
    description: 'Investment/payment endorsement without current evidence boundary',
    pattern: /(?:eu investiria|investiria nesse saas|i would invest|eu venderia como saas pronto|eu apostaria sem ressalva)/i,
  },
  {
    id: 'retention_rate_claim',
    severity: 'P1',
    description: 'Metric claim for retention, conversion, churn, CAC or LTV without evidence boundary',
    pattern: /(?:retention rate|taxa de retenc(?:ao|ão)|conversion rate|taxa de convers(?:ao|ão)|churn|cac|ltv).{0,100}(?:\d+(?:[,.]\d+)?%|comprovad[ao]|provad[ao]|proven|validad[ao]|validated|fechad[ao]|closed)/i,
  },
];

const CAVEAT_PATTERNS = [
  /\bnao\b/i,
  /\bn(?:a|ã)o\b/i,
  /\bnoo\b/i,
  /\bsem evidencia\b/i,
  /\bsem evid(?:e|ê)ncia\b/i,
  /\bsem prova\b/i,
  /\bblock\b/i,
  /\bblocked\b/i,
  /\bnao prova\b/i,
  /\bn(?:a|ã)o prova\b/i,
  /\bdoes not prove\b/i,
  /\bnot prove\b/i,
  /\bnot proven\b/i,
  /\bnot backed\b/i,
  /\bmust not\b/i,
  /\bwithout direct evidence\b/i,
  /\buncaveated\b/i,
  /\bnao pronto\b/i,
  /\bn(?:a|ã)o pronto\b/i,
  /\bnot ready\b/i,
  /\bainda\b/i,
  /\bfalta\b/i,
  /\bfaltam\b/i,
  /\bapenas\b/i,
  /\bpartial\b/i,
  /\bparcial\b/i,
  /\bpiloto privado controlado\b/i,
  /\bcontrolado\b/i,
  /\blimitad[ao]\b/i,
  /\bnao chamaria\b/i,
  /\bn(?:a|ã)o chamaria\b/i,
  /\bnao investiria\b/i,
  /\bn(?:a|ã)o investiria\b/i,
  /\bnao venderia\b/i,
  /\bn(?:a|ã)o venderia\b/i,
  /\binsufficient evidence\b/i,
  /\bno retention\b/i,
  /\bshould be claimed until\b/i,
  /\binvent\b/i,
  /\bausencia\b/i,
  /\baus(?:e|ê)ncia\b/i,
  /\bconfundir\b/i,
  /\bdesalinhad[ao]\b/i,
  /\bcortar linguagem\b/i,
  /\bpromessa central\b/i,
  /\bheadline principal\b/i,
  /\bnenhuma referencia\b/i,
  /\bnenhuma refer(?:e|ê)ncia\b/i,
  /\bpromessas excessivas\b/i,
  /\bmais consultivo\b/i,
  /\bmenos\b/i,
  /\bevidencia usada\b/i,
  /\bevid(?:e|ê)ncia usada\b/i,
  /\bblocks\b/i,
  /\bblocked claims\b/i,
  /\bbloqueia\b/i,
  /\bbloquear\b/i,
  /\bevidence boundary\b/i,
  /\bfronteira de evidencia\b/i,
  /\bfronteira de evid(?:e|ê)ncia\b/i,
  /\bgate tecnico\b/i,
  /\bgate t(?:e|é)cnico\b/i,
  /\bnao mede\b/i,
  /\bn(?:a|ã)o mede\b/i,
];

const DATE_PATTERN = /20\d{2}-\d{2}-\d{2}|20\d{2}\/\d{2}\/\d{2}/;
const ARTIFACT_PATTERN = /test-results\/|report\.json|report\.md|npm run|runner|artifact|artefato|rerun|revalid/i;

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasCaveatBoundary(line) {
  return CAVEAT_PATTERNS.some((pattern) => pattern.test(line) || pattern.test(normalizeText(line)));
}

function hasFullEvidenceBoundary(line) {
  return DATE_PATTERN.test(line) && ARTIFACT_PATTERN.test(line) && hasCaveatBoundary(line);
}

function evaluateClaimLine(line, context = {}) {
  const violations = [];
  const normalizedFile = normalizeSlashes(context.file || '');
  if (/CLAIMS_GUARD_\d{4}-\d{2}-\d{2}\.md$/.test(normalizedFile)) {
    return violations;
  }

  for (const claimPattern of CLAIM_PATTERNS) {
    if (!claimPattern.pattern.test(line)) continue;
    if (claimPattern.id === 'investment_claim' && line.includes('?')) continue;
    if (hasCaveatBoundary(line) || hasFullEvidenceBoundary(line)) continue;

    violations.push({
      id: claimPattern.id,
      severity: claimPattern.severity,
      description: claimPattern.description,
      file: context.file || '',
      line: context.line || 0,
      text: line.trim(),
    });
  }

  return violations;
}

function evaluateClaimText(text, file = '') {
  const violations = [];
  const lines = String(text || '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    violations.push(...evaluateClaimLine(lines[index], { file, line: index + 1 }));
  }

  return violations;
}

async function collectMarkdownFiles(rootDir) {
  const files = [];

  async function walk(currentDir) {
    let entries = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const normalized = normalizeSlashes(path.relative(rootDir, fullPath));

      if (entry.isDirectory()) {
        if (normalized === 'archive' || normalized.startsWith('archive/')) continue;
        if (entry.name === 'node_modules') continue;
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => rel(a).localeCompare(rel(b)));
}

async function buildClaimsPayload(options = {}) {
  const docsDir = path.resolve(process.cwd(), options.docsDir || DEFAULT_DOCS_DIR);
  const files = await collectMarkdownFiles(docsDir);
  const violations = [];

  for (const filePath of files) {
    const text = await fs.readFile(filePath, 'utf8');
    violations.push(...evaluateClaimText(text, rel(filePath)));
  }

  const status = violations.length === 0 ? 'PASS' : 'BLOCK';
  return {
    runnerName: RUNNER_NAME,
    timestamp: new Date().toISOString(),
    scannedRoot: rel(docsDir),
    result: {
      status,
      summary: status === 'PASS'
        ? 'PASS: active audit docs contain no uncaveated commercial proof claims'
        : 'BLOCK: active audit docs contain uncaveated commercial proof claims',
      scannedFiles: files.length,
      violationCount: violations.length,
      violations,
    },
    policy: {
      blockedClaimIds: CLAIM_PATTERNS.map((pattern) => pattern.id),
      allowedBoundaries: [
        'SEM EVIDENCIA SUFICIENTE',
        'nao prova',
        'BLOCK',
        'piloto privado controlado',
        'validacao parcial',
        'gate tecnico fechado, nao prova comercial',
      ],
    },
  };
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - audit claims guard',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- scanned root: ${payload.scannedRoot}`,
    `- scanned files: ${payload.result.scannedFiles}`,
    `- violations: ${payload.result.violationCount}`,
    '',
    '## Policy',
    '',
    'Blocked unless caveated or evidence-bounded:',
    '',
  ];

  for (const id of payload.policy.blockedClaimIds) {
    lines.push(`- ${id}`);
  }

  lines.push('', 'Allowed boundaries:', '');
  for (const boundary of payload.policy.allowedBoundaries) {
    lines.push(`- ${boundary}`);
  }

  if (payload.result.violations.length > 0) {
    lines.push('', '## Violations', '');
    for (const violation of payload.result.violations) {
      lines.push(`- ${violation.severity} ${violation.id} ${violation.file}:${violation.line} - ${violation.text.replaceAll('|', '/')}`);
    }
  }

  lines.push(
    '',
    '## What this report does not prove',
    '',
    '- It does not prove retention, conversion, AI quality, or investment readiness.',
    '- It only prevents active audit documentation from overstating the current evidence.',
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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--docs-dir') {
      args.docsDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--docs-dir=')) {
      args.docsDir = token.slice('--docs-dir='.length);
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
  }
  return args;
}

function printHelp() {
  process.stdout.write([
    'Flow Finance audit claims guard',
    '',
    'Usage:',
    '  node scripts/check-audit-claims.mjs [--docs-dir <dir>] [--output-dir <dir>]',
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const payload = await buildClaimsPayload({ docsDir: args.docsDir });
  const outputRoot = path.resolve(process.cwd(), args.outputDir || process.env.AUDIT_CLAIMS_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT);
  const artifacts = await writeArtifact(outputRoot, payload);

  process.stdout.write('Flow Finance - audit claims guard\n');
  process.stdout.write('=================================\n');
  process.stdout.write(`Result: ${payload.result.status}\n`);
  process.stdout.write(`Summary: ${payload.result.summary}\n`);
  process.stdout.write(`Scanned files: ${payload.result.scannedFiles}\n`);
  process.stdout.write(`Violations: ${payload.result.violationCount}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);

  for (const violation of payload.result.violations.slice(0, 20)) {
    process.stdout.write(`- ${violation.severity} ${violation.id} ${violation.file}:${violation.line} ${violation.text}\n`);
  }

  process.exitCode = payload.result.status === 'PASS' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  CLAIM_PATTERNS,
  buildClaimsPayload,
  buildMarkdown,
  collectMarkdownFiles,
  evaluateClaimLine,
  evaluateClaimText,
  hasCaveatBoundary,
  normalizeText,
  parseArgs,
};
