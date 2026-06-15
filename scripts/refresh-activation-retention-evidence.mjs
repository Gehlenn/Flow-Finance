#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Activation/retention refresh runner';
const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results/activation-retention-refresh');

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function rel(filePath) {
  return filePath.replaceAll('\\', '/').replace(`${process.cwd().replaceAll('\\', '/')}/`, '');
}

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--cohort-window-days') {
      args.cohortWindowDays = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--cohort-window-days=')) {
      args.cohortWindowDays = token.slice('--cohort-window-days='.length);
      continue;
    }
  }

  return args;
}

function parsePositiveInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveCohortWindowDays(args) {
  const explicit = parsePositiveInteger(
    args.cohortWindowDays ?? readStringEnv('ACTIVATION_RETENTION_COHORT_WINDOW_DAYS'),
    null,
  );
  return explicit ?? 7;
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function summarizeLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12);
}

function runNodeScript(scriptRelativePath, args = []) {
  const absoluteScript = path.resolve(process.cwd(), scriptRelativePath);
  const child = spawnSync(process.execPath, [absoluteScript, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  return {
    status: typeof child.status === 'number' ? child.status : 1,
    stdout: String(child.stdout || ''),
    stderr: String(child.stderr || ''),
    stdoutTail: summarizeLines(child.stdout),
    stderrTail: summarizeLines(child.stderr),
  };
}

function findArtifactPath(text, prefix) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    ?.slice(prefix.length)
    .trim() || '';
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - activation and retention refresh',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    '',
    '## Steps',
  ];

  for (const step of payload.steps) {
    lines.push('');
    lines.push(`### ${step.id} - ${step.label}`);
    lines.push(`- status: ${step.status}`);
    if (step.detail) {
      lines.push(`- detail: ${step.detail}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeArtifact(baseName, payload) {
  ensureOutputDir();
  const runDir = path.join(OUTPUT_DIR, baseName);
  fs.mkdirSync(runDir, { recursive: true });
  const jsonPath = path.join(runDir, 'report.json');
  const mdPath = path.join(runDir, 'report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, buildMarkdown(payload), 'utf8');
  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cohortWindowDays = resolveCohortWindowDays(args);
  const timestamp = new Date().toISOString();
  const runId = formatTimestamp(new Date());
  const steps = [];

  const ready = runNodeScript('scripts/check-activation-retention-prereqs.mjs');
  const readyOk = ready.status === 0;
  steps.push({
    id: 'A1',
    label: 'Prereq preflight',
    status: readyOk ? 'PASS' : 'BLOCK',
    detail: ready.stdoutTail.at(-1) || ready.stderrTail.at(-1) || 'prereq check finished',
  });

  let exportRun = null;
  let exportArtifact = '';
  let exportJsonl = '';

  if (readyOk) {
    exportRun = runNodeScript('scripts/export-activation-retention-events.mjs');
    exportArtifact = findArtifactPath(exportRun.stdout, 'artifact-json:');
    exportJsonl = findArtifactPath(exportRun.stdout, 'export-jsonl:');

    steps.push({
      id: 'A2',
      label: 'Published export',
      status: exportRun.status === 0 ? 'PASS' : 'BLOCK',
      detail: exportRun.stdoutTail.at(-1) || exportRun.stderrTail.at(-1) || 'export finished',
    });
  } else {
    steps.push({
      id: 'A2',
      label: 'Published export',
      status: 'BLOCK',
      detail: 'skipped because preflight is not ready',
    });
  }

  let checkerRun = null;
  let checkerArtifact = '';
  if (readyOk && exportJsonl && cohortWindowDays) {
    checkerRun = runNodeScript('scripts/check-activation-retention-evidence.mjs', [
      '--input',
      exportJsonl,
      '--cohort-window-days',
      String(cohortWindowDays),
    ]);
    checkerArtifact = findArtifactPath(checkerRun.stdout, 'Artifact:');

    steps.push({
      id: 'A3',
      label: 'Cohort evidence check',
      status: checkerRun.status === 0 ? 'PASS' : 'BLOCK',
      detail: checkerRun.stdoutTail.at(-1) || checkerRun.stderrTail.at(-1) || 'checker finished',
    });
  } else {
    const reason = !readyOk
      ? 'skipped because preflight is not ready'
      : !exportJsonl
        ? 'skipped because export artifact is missing'
        : 'skipped because cohort window is missing';
    steps.push({
      id: 'A3',
      label: 'Cohort evidence check',
      status: 'BLOCK',
      detail: reason,
    });
  }

  const blocked = steps.some((step) => step.status === 'BLOCK');
  const result = {
    status: blocked ? 'BLOCK' : 'PASS',
    summary: blocked
      ? 'BLOCK: activation/retention refresh is not fully evidenced'
      : 'PASS: activation/retention refresh is fully evidenced',
  };

  const payload = {
    runnerName: RUNNER_NAME,
    timestamp,
    inputs: {
      cohortWindowDays,
    },
    steps,
    exportArtifact,
    exportJsonl,
    checkerArtifact,
    ready,
    exportRun,
    checkerRun,
    result,
  };

  const artifacts = writeArtifact(runId, payload);

  process.stdout.write('Flow Finance - activation and retention refresh\n');
  process.stdout.write('===============================================\n');
  process.stdout.write(`Result: ${result.status}\n`);
  process.stdout.write(`Summary: ${result.summary}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);
  for (const step of steps) {
    process.stdout.write(`- ${step.id} ${step.status}: ${step.label} | ${step.detail}\n`);
  }

  process.exitCode = blocked ? 1 : 0;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`BLOCK: ${error?.message || 'unexpected failure'}\n`);
    process.exit(1);
  });
}
