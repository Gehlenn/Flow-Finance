#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Habit proof evidence runner';
const DEFAULT_EXPORT_ROOT = path.resolve(process.cwd(), 'test-results/activation-retention-export');
const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/habit-proof-evidence');
const DEFAULT_CANONICAL_SINCE = '2026-06-12T20:44:49.665Z';
const ACTIVATION_EVENTS = new Set([
  'activation_first_transaction',
  'activation_first_dashboard_useful',
  'activation_financial_base_completed',
]);
const QUALIFYING_ACTIVATION_EVENTS = new Set([
  'activation_first_dashboard_useful',
  'activation_financial_base_completed',
]);
const RETENTION_EVENT = 'weekly_cash_review_completed';

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--export-root') {
      args.exportRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--export-root=')) {
      args.exportRoot = token.slice('--export-root='.length);
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

    if (token === '--canonical-since') {
      args.canonicalSince = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--canonical-since=')) {
      args.canonicalSince = token.slice('--canonical-since='.length);
      continue;
    }

    if (token === '--min-distinct-review-weeks') {
      args.minDistinctReviewWeeks = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--min-distinct-review-weeks=')) {
      args.minDistinctReviewWeeks = token.slice('--min-distinct-review-weeks='.length);
      continue;
    }

    if (token === '--min-observation-days') {
      args.minObservationDays = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--min-observation-days=')) {
      args.minObservationDays = token.slice('--min-observation-days='.length);
      continue;
    }

    if (token === '--min-cohorts') {
      args.minCohorts = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--min-cohorts=')) {
      args.minCohorts = token.slice('--min-cohorts='.length);
      continue;
    }
  }

  return args;
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRunIdTimestamp(runId) {
  if (typeof runId !== 'string' || !runId.trim()) return null;
  const match = runId.trim().match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z$/,
  );
  if (!match) return null;
  const [, datePart, hh, mm, ss, ms = '000'] = match;
  return parseTimestamp(`${datePart}T${hh}:${mm}:${ss}.${ms}Z`);
}

function toIso(ms) {
  return ms === null ? '' : new Date(ms).toISOString();
}

function isoWeekKey(ms) {
  const date = new Date(ms);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeEventRow(row) {
  if (!row || typeof row !== 'object') return null;
  const eventName = String(row.event_name ?? row.eventName ?? row.type ?? '').trim();
  const workspaceId = String(row.workspace_id ?? row.workspaceId ?? row.tenant_id ?? '').trim();
  const userId = String(row.user_id ?? row.userId ?? row.actor_id ?? '').trim();
  const occurredAtMs = parseTimestamp(row.occurred_at ?? row.occurredAt ?? row.timestamp ?? '');

  if (!eventName || !workspaceId || !userId || occurredAtMs === null) return null;

  return {
    eventName,
    workspaceId,
    userId,
    occurredAtMs,
    occurredAt: toIso(occurredAtMs),
  };
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readJsonlFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map(normalizeEventRow)
    .filter(Boolean);
}

async function discoverExportBundles(exportRoot, canonicalSinceMs) {
  const directoryEntries = await fs.readdir(exportRoot, { withFileTypes: true });
  const bundles = [];
  const ignored = {
    nonDirectories: 0,
    missingArtifacts: 0,
    invalidReports: 0,
    nonPass: 0,
    preCanonical: 0,
  };

  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      ignored.nonDirectories += 1;
      continue;
    }

    const runId = entry.name;
    const reportPath = path.join(exportRoot, runId, 'report.json');
    const rowsPath = path.join(exportRoot, runId, 'events.jsonl');
    let report;

    try {
      report = await readJsonFile(reportPath);
    } catch {
      ignored.invalidReports += 1;
      continue;
    }

    const reportStatus = String(report?.result?.status ?? '').trim().toUpperCase();
    const usableEvidence = report?.result?.usableEvidence !== false;
    if (reportStatus !== 'PASS' || !usableEvidence) {
      ignored.nonPass += 1;
      continue;
    }

    const snapshotMs = parseRunIdTimestamp(runId) ?? parseTimestamp(report?.timestamp);
    if (snapshotMs === null) {
      ignored.invalidReports += 1;
      continue;
    }

    if (snapshotMs < canonicalSinceMs) {
      ignored.preCanonical += 1;
      continue;
    }

    let rows;
    try {
      rows = await readJsonlFile(rowsPath);
    } catch {
      ignored.missingArtifacts += 1;
      continue;
    }

    bundles.push({
      runId,
      snapshotMs,
      snapshotIso: toIso(snapshotMs),
      reportPath,
      rowsPath,
      rows,
    });
  }

  bundles.sort((left, right) => left.snapshotMs - right.snapshotMs);
  return {
    bundles,
    ignored,
  };
}

function summarizeHabitEvidence(bundles) {
  const rows = [];
  for (const bundle of bundles) {
    for (const row of bundle.rows) {
      if (!ACTIVATION_EVENTS.has(row.eventName) && row.eventName !== RETENTION_EVENT) continue;
      rows.push({
        ...row,
        bundleRunId: bundle.runId,
        bundleSnapshotIso: bundle.snapshotIso,
      });
    }
  }

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.workspaceId}::${row.userId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const cohortSummaries = [];
  for (const [cohortKey, cohortRows] of grouped.entries()) {
    cohortRows.sort((left, right) => left.occurredAtMs - right.occurredAtMs);
    const activationRows = cohortRows.filter((row) => ACTIVATION_EVENTS.has(row.eventName));
    const firstActivation = activationRows[0] ?? null;
    const qualifyingActivationRows = activationRows.filter((row) => QUALIFYING_ACTIVATION_EVENTS.has(row.eventName));
    const firstQualifiedActivation = qualifyingActivationRows[0] ?? null;
    const reviewRows = cohortRows.filter((row) => row.eventName === RETENTION_EVENT);
    const reviewRowsAfterActivation = firstQualifiedActivation
      ? reviewRows.filter((row) => row.occurredAtMs > firstQualifiedActivation.occurredAtMs)
      : [];
    const distinctReviewWeeks = [...new Set(reviewRowsAfterActivation.map((row) => isoWeekKey(row.occurredAtMs)))];
    const bundleRunIds = [...new Set(cohortRows.map((row) => row.bundleRunId))];
    const activationComponentEvents = [...new Set(activationRows.map((row) => row.eventName))].sort();
    const observationDays = firstQualifiedActivation && reviewRowsAfterActivation.length > 0
      ? (reviewRowsAfterActivation.at(-1).occurredAtMs - firstQualifiedActivation.occurredAtMs) / 86400000
      : 0;

    cohortSummaries.push({
      cohortKey,
      workspaceId: firstActivation?.workspaceId ?? reviewRows[0]?.workspaceId ?? '',
      userId: firstActivation?.userId ?? reviewRows[0]?.userId ?? '',
      activationEventCount: activationRows.length,
      activationComponentEvents,
      activationComponentCount: activationComponentEvents.length,
      qualifyingActivationEventCount: qualifyingActivationRows.length,
      activationQualifiedAt: firstQualifiedActivation?.occurredAt ?? '',
      activationQualifiedBy: firstQualifiedActivation?.eventName ?? '',
      reviewEventCount: reviewRows.length,
      reviewEventCountAfterActivation: reviewRowsAfterActivation.length,
      firstActivationAt: firstActivation?.occurredAt ?? '',
      firstReviewAfterActivationAt: reviewRowsAfterActivation[0]?.occurredAt ?? '',
      lastReviewAfterActivationAt: reviewRowsAfterActivation.at(-1)?.occurredAt ?? '',
      distinctReviewWeeks,
      distinctReviewWeekCount: distinctReviewWeeks.length,
      observationDays,
      exportBundleCount: bundleRunIds.length,
      bundleRunIds,
    });
  }

  cohortSummaries.sort((left, right) => {
    if (right.distinctReviewWeekCount !== left.distinctReviewWeekCount) {
      return right.distinctReviewWeekCount - left.distinctReviewWeekCount;
    }
    return right.reviewEventCountAfterActivation - left.reviewEventCountAfterActivation;
  });

  return {
    canonicalBundleCount: bundles.length,
    totalRelevantRows: rows.length,
    cohortCount: cohortSummaries.length,
    cohortSummaries,
  };
}

function determineResult(summary, thresholds) {
  const reasons = [];
  const explicitThresholdsProvided = [
    thresholds.minDistinctReviewWeeks,
    thresholds.minObservationDays,
    thresholds.minCohorts,
  ].some((value) => value !== null);

  if (summary.canonicalBundleCount === 0) {
    reasons.push('no canonical PASS export bundles were found after the durable event-store cutoff');
  }

  if (!explicitThresholdsProvided) {
    reasons.push('missing explicit habit thresholds; set --min-distinct-review-weeks, --min-observation-days, or --min-cohorts');
  }

  const passingCohorts = summary.cohortSummaries.filter((cohort) => {
    if (!cohort.activationQualifiedAt) {
      return false;
    }
    if (thresholds.minDistinctReviewWeeks !== null && cohort.distinctReviewWeekCount < thresholds.minDistinctReviewWeeks) {
      return false;
    }
    if (thresholds.minObservationDays !== null && cohort.observationDays < thresholds.minObservationDays) {
      return false;
    }
    return true;
  });

  if (explicitThresholdsProvided && thresholds.minCohorts !== null && passingCohorts.length < thresholds.minCohorts) {
    reasons.push(`only ${passingCohorts.length} cohort(s) satisfied the declared thresholds; ${thresholds.minCohorts} required`);
  }

  if (explicitThresholdsProvided && !summary.cohortSummaries.some((item) => item.activationQualifiedAt)) {
    reasons.push('no cohort reached qualified activation with dashboard usefulness or completed financial base');
  }

  if (explicitThresholdsProvided && thresholds.minDistinctReviewWeeks !== null && !summary.cohortSummaries.some((item) => item.distinctReviewWeekCount >= thresholds.minDistinctReviewWeeks)) {
    reasons.push(`no cohort reached ${thresholds.minDistinctReviewWeeks} distinct review week(s) after qualified activation`);
  }

  if (explicitThresholdsProvided && thresholds.minObservationDays !== null && !summary.cohortSummaries.some((item) => item.observationDays >= thresholds.minObservationDays)) {
    reasons.push(`no cohort reached ${thresholds.minObservationDays} observation day(s) after qualified activation`);
  }

  const pass = explicitThresholdsProvided
    && reasons.length === 0
    && (thresholds.minCohorts === null || passingCohorts.length >= thresholds.minCohorts);

  return {
    status: pass ? 'PASS' : 'BLOCK',
    summary: pass
      ? 'PASS: explicit habit-proof thresholds were satisfied by canonical published cohorts'
      : 'BLOCK: SEM EVIDENCIA SUFICIENTE para provar habito ao longo do tempo',
    reasons,
    passingCohorts: explicitThresholdsProvided ? passingCohorts : [],
  };
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function buildMarkdown(payload) {
  const lines = [
    '# Flow Finance - habit proof evidence',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- canonical since: ${payload.inputs.canonicalSince}`,
    `- canonical bundles considered: ${payload.summary.canonicalBundleCount}`,
    `- cohorts observed: ${payload.summary.cohortCount}`,
    '',
    '## Thresholds',
    '',
    `- min distinct review weeks: ${payload.inputs.minDistinctReviewWeeks ?? 'not set'}`,
    `- min observation days: ${payload.inputs.minObservationDays ?? 'not set'}`,
    `- min cohorts: ${payload.inputs.minCohorts ?? 'not set'}`,
  ];

  if (payload.result.reasons.length > 0) {
    lines.push('', '## Blockers', '');
    for (const reason of payload.result.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push('', '## Cohorts observed', '');
  if (payload.summary.cohortSummaries.length === 0) {
    lines.push('- none');
  } else {
    for (const cohort of payload.summary.cohortSummaries) {
      lines.push(`- cohort: ${cohort.cohortKey}`);
      lines.push(`  - first activation: ${cohort.firstActivationAt || 'missing'}`);
      lines.push(`  - qualified activation: ${cohort.activationQualifiedAt || 'missing'}${cohort.activationQualifiedBy ? ` via ${cohort.activationQualifiedBy}` : ''}`);
      lines.push(`  - activation components: ${cohort.activationComponentEvents.join(', ') || 'none'}`);
      lines.push(`  - first review after qualified activation: ${cohort.firstReviewAfterActivationAt || 'missing'}`);
      lines.push(`  - last review after qualified activation: ${cohort.lastReviewAfterActivationAt || 'missing'}`);
      lines.push(`  - distinct review weeks: ${cohort.distinctReviewWeekCount}`);
      lines.push(`  - observation days: ${cohort.observationDays.toFixed(2)}`);
      lines.push(`  - export bundles: ${cohort.exportBundleCount}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function writeArtifact(outputRoot, payload) {
  await ensureDir(outputRoot);
  const runDir = path.join(outputRoot, formatTimestamp(new Date()));
  await ensureDir(runDir);
  const jsonPath = path.join(runDir, 'report.json');
  const mdPath = path.join(runDir, 'report.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, buildMarkdown(payload), 'utf8');
  return { jsonPath, mdPath };
}

function printHelp() {
  process.stdout.write(
    [
      'Flow Finance habit proof evidence runner',
      '',
      'Usage:',
      '  node scripts/check-habit-proof-evidence.mjs [--export-root <dir>] [--output-dir <dir>]',
      '    [--canonical-since <iso-date>] [--min-distinct-review-weeks <n>]',
      '    [--min-observation-days <n>] [--min-cohorts <n>]',
      '',
      'This runner scans canonical PASS activation/retention export bundles and summarizes',
      'whether repeated weekly review evidence exists across real published cohorts over time.',
      'It does not invent thresholds; if no explicit thresholds are supplied, it stays BLOCK.',
      '',
    ].join('\n'),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const exportRoot = path.resolve(process.cwd(), args.exportRoot || readEnv('HABIT_PROOF_EXPORT_ROOT') || DEFAULT_EXPORT_ROOT);
  const outputRoot = path.resolve(process.cwd(), args.outputDir || readEnv('HABIT_PROOF_OUTPUT_DIR') || DEFAULT_OUTPUT_ROOT);
  const canonicalSince = args.canonicalSince || readEnv('HABIT_PROOF_CANONICAL_SINCE') || DEFAULT_CANONICAL_SINCE;
  const canonicalSinceMs = parseTimestamp(canonicalSince);

  if (canonicalSinceMs === null) {
    throw new Error(`invalid canonical cutoff: ${canonicalSince}`);
  }

  const thresholds = {
    minDistinctReviewWeeks: parsePositiveInteger(args.minDistinctReviewWeeks ?? readEnv('HABIT_PROOF_MIN_DISTINCT_REVIEW_WEEKS')),
    minObservationDays: parsePositiveInteger(args.minObservationDays ?? readEnv('HABIT_PROOF_MIN_OBSERVATION_DAYS')),
    minCohorts: parsePositiveInteger(args.minCohorts ?? readEnv('HABIT_PROOF_MIN_COHORTS')),
  };

  const discovery = await discoverExportBundles(exportRoot, canonicalSinceMs);
  const summary = summarizeHabitEvidence(discovery.bundles);
  const result = determineResult(summary, thresholds);
  const timestamp = new Date().toISOString();

  const payload = {
    runnerName: RUNNER_NAME,
    timestamp,
    inputs: {
      exportRoot: rel(exportRoot),
      outputRoot: rel(outputRoot),
      canonicalSince,
      ...thresholds,
    },
    discovery: {
      ignored: discovery.ignored,
      bundleRunIds: discovery.bundles.map((bundle) => bundle.runId),
      bundleReports: discovery.bundles.map((bundle) => ({
        runId: bundle.runId,
        snapshot: bundle.snapshotIso,
        reportPath: rel(bundle.reportPath),
        rowsPath: rel(bundle.rowsPath),
      })),
    },
    summary,
    result: {
      status: result.status,
      summary: result.summary,
      reasons: result.reasons,
      passingCohortKeys: result.passingCohorts.map((item) => item.cohortKey),
    },
  };

  const artifacts = await writeArtifact(outputRoot, payload);

  process.stdout.write('Flow Finance - habit proof evidence\n');
  process.stdout.write('==================================\n');
  process.stdout.write(`Result: ${payload.result.status}\n`);
  process.stdout.write(`Summary: ${payload.result.summary}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);
  process.stdout.write(`Canonical bundles: ${summary.canonicalBundleCount}\n`);
  process.stdout.write(`Cohorts observed: ${summary.cohortCount}\n`);
  if (payload.result.reasons.length > 0) {
    for (const reason of payload.result.reasons) {
      process.stdout.write(`- ${reason}\n`);
    }
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
  determineResult,
  discoverExportBundles,
  isoWeekKey,
  normalizeEventRow,
  parseArgs,
  parseRunIdTimestamp,
  summarizeHabitEvidence,
};
