#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Audit evidence report runner';
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/audit-evidence');

const ARTIFACT_SOURCES = [
  {
    id: 'activation_export',
    title: 'Activation export',
    root: 'test-results/activation-retention-export',
    file: 'report.json',
    statusPath: ['result', 'status'],
    summaryPath: ['result', 'summary'],
  },
  {
    id: 'activation_checker',
    title: 'Activation checker',
    root: 'test-results/activation-retention-evidence',
    file: 'report.json',
    statusPath: ['status'],
    summaryPath: ['gateText'],
  },
  {
    id: 'habit_proof',
    title: 'Habit proof',
    root: 'test-results/habit-proof-evidence',
    file: 'report.json',
    statusPath: ['result', 'status'],
    summaryPath: ['result', 'summary'],
  },
  {
    id: 'cohort_state',
    title: 'Cohort state',
    root: 'test-results/cohort-state',
    file: 'report.json',
    statusPath: ['result', 'status'],
    summaryPath: ['result', 'summary'],
  },
  {
    id: 'ai_quality',
    title: 'AI quality',
    root: 'test-results/ai-quality-evidence',
    file: 'report.json',
    statusPath: ['result', 'status'],
    summaryPath: ['result', 'summary'],
  },
  {
    id: 'claims_guard',
    title: 'Claims guard',
    root: 'test-results/audit-claims',
    file: 'report.json',
    statusPath: ['result', 'status'],
    summaryPath: ['result', 'summary'],
  },
  {
    id: 'visual_regression',
    title: 'Visual regression',
    root: 'test-results/visual-regression',
    file: 'manifest.json',
    statusPath: ['status'],
    summaryPath: ['summary'],
    preferMostComplete: true,
  },
];

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function getPathValue(value, pathParts) {
  let cursor = value;
  for (const part of pathParts) {
    if (!cursor || typeof cursor !== 'object') return '';
    cursor = cursor[part];
  }
  if (typeof cursor === 'string') return cursor;
  if (typeof cursor === 'number' || typeof cursor === 'boolean') return String(cursor);
  return '';
}

function normalizeStatus(value) {
  const text = String(value || '').trim().toUpperCase();
  if (['PASS', 'BLOCK', 'WARN', 'FAIL'].includes(text)) return text;
  if (text === 'OK') return 'PASS';
  return text || 'MISSING';
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function scoreArtifactCompleteness(payload) {
  const summary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : {};
  return {
    screenshots: Number(summary.screenshots || 0),
    routeStateScreenshots: Number(summary.routeStateScreenshots || 0),
    routes: Number(summary.routes || 0),
    routeStates: Number(summary.routeStates || 0),
  };
}

function compareArtifactCandidates(left, right) {
  const fields = ['screenshots', 'routeStateScreenshots', 'routes', 'routeStates'];
  for (const field of fields) {
    if (left.score[field] !== right.score[field]) {
      return left.score[field] - right.score[field];
    }
  }

  return left.name.localeCompare(right.name);
}

async function latestDirectory(rootPath, source = {}) {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (!source.preferMostComplete) {
      return directories.at(-1) ?? '';
    }

    const candidates = [];
    for (const name of directories) {
      const artifactPath = path.join(rootPath, name, source.file);
      const payload = await readJsonIfExists(artifactPath);
      if (!payload) continue;
      candidates.push({
        name,
        score: scoreArtifactCompleteness(payload),
      });
    }

    return candidates.sort(compareArtifactCandidates).at(-1)?.name
      ?? directories.at(-1)
      ?? '';
  } catch {
    return '';
  }
}

async function collectArtifact(source) {
  const rootPath = path.resolve(process.cwd(), source.root);
  const latest = await latestDirectory(rootPath, source);
  if (!latest) {
    return {
      id: source.id,
      title: source.title,
      status: 'MISSING',
      summary: 'No artifact directory found',
      artifactPath: '',
      runId: '',
    };
  }

  const artifactPath = path.join(rootPath, latest, source.file);
  const payload = await readJsonIfExists(artifactPath);
  if (!payload) {
    return {
      id: source.id,
      title: source.title,
      status: 'MISSING',
      summary: `Expected artifact file missing or invalid: ${rel(artifactPath)}`,
      artifactPath: rel(artifactPath),
      runId: latest,
    };
  }

  return {
    id: source.id,
    title: source.title,
    status: normalizeStatus(getPathValue(payload, source.statusPath)),
    summary: getPathValue(payload, source.summaryPath) || 'Artifact found',
    artifactPath: rel(artifactPath),
    runId: latest,
  };
}

function determineEvidenceStatus(items) {
  const blocking = items.filter((item) => ['BLOCK', 'FAIL', 'MISSING'].includes(item.status));
  if (blocking.length > 0) {
    const hasMissing = blocking.some((item) => item.status === 'MISSING');
    return {
      status: 'BLOCK',
      summary: hasMissing
        ? 'BLOCK: evidence package has missing or blocking artifacts'
        : 'BLOCK: evidence package has blocking artifacts',
      blockers: blocking.map((item) => `${item.title}: ${item.status}`),
    };
  }

  const warnings = items.filter((item) => item.status === 'WARN');
  if (warnings.length > 0) {
    return {
      status: 'WARN',
      summary: 'WARN: evidence package exists but has warning artifacts',
      blockers: warnings.map((item) => `${item.title}: WARN`),
    };
  }

  return {
    status: 'PASS',
    summary: 'PASS: evidence package found no blocking artifact status',
    blockers: [],
  };
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - audit evidence package',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    '',
    '## Artifact status',
    '',
    '| Area | Status | Latest artifact | Summary |',
    '| --- | --- | --- | --- |',
  ];

  for (const item of payload.artifacts) {
    lines.push(`| ${item.title} | ${item.status} | ${item.artifactPath || 'missing'} | ${item.summary.replaceAll('|', '/')} |`);
  }

  if (payload.result.blockers.length > 0) {
    lines.push('', '## Blockers', '');
    for (const blocker of payload.result.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push(
    '',
    '## What this report does not prove',
    '',
    '- It does not prove retention without multi-week real usage.',
    '- It does not prove AI perceived quality without real user feedback.',
    '- It does not prove paid conversion without billing or checkout evidence.',
    '',
    '## Recommended rerun commands',
    '',
    '```bash',
    'npm run health:cohort-state -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1',
    'npm run health:habit-proof -- --min-distinct-review-weeks 2 --min-observation-days 7 --min-cohorts 1',
    'npm run audit:evidence',
    '```',
  );

  return `${lines.join('\n')}\n`;
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
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

async function buildAuditEvidencePayload() {
  const artifacts = [];
  for (const source of ARTIFACT_SOURCES) {
    artifacts.push(await collectArtifact(source));
  }

  const result = determineEvidenceStatus(artifacts);
  return {
    runnerName: RUNNER_NAME,
    timestamp: new Date().toISOString(),
    artifacts,
    result,
  };
}

async function main() {
  const outputRoot = path.resolve(process.cwd(), process.env.AUDIT_EVIDENCE_OUTPUT_DIR || DEFAULT_OUTPUT_ROOT);
  const payload = await buildAuditEvidencePayload();
  const artifacts = await writeArtifact(outputRoot, payload);

  process.stdout.write('Flow Finance - audit evidence package\n');
  process.stdout.write('=====================================\n');
  process.stdout.write(`Result: ${payload.result.status}\n`);
  process.stdout.write(`Summary: ${payload.result.summary}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);
  for (const item of payload.artifacts) {
    process.stdout.write(`- ${item.title}: ${item.status} (${item.artifactPath || 'missing'})\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export {
  buildAuditEvidencePayload,
  buildMarkdown,
  collectArtifact,
  determineEvidenceStatus,
  getPathValue,
  normalizeStatus,
};
