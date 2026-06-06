#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const defaultOutputRoot = 'test-results/activation-retention-evidence';
const requiredActivationEvents = [
  'activation_first_transaction',
  'activation_first_dashboard_useful',
];
const requiredRetentionEvents = [
  'weekly_cash_review_completed',
];
const billingEvents = [
  'billing_checkout_started',
  'billing_checkout_redirected',
  'billing_checkout_failed',
  'billing_portal_started',
  'billing_portal_redirected',
  'billing_portal_failed',
];
const eventAliases = [
  'event_name',
  'event',
  'name',
  'eventName',
];
const timestampAliases = [
  'occurred_at',
  'timestamp',
  'time',
  'created_at',
  'event_time',
  'occurredAt',
];
const workspaceAliases = [
  'workspace_id',
  'workspace',
  'workspaceId',
  'tenant_id',
  'tenant',
  'tenantId',
];
const userAliases = [
  'user_id',
  'user',
  'userId',
  'member_id',
  'memberId',
  'actor_id',
  'actorId',
  'subject_id',
  'subjectId',
];

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(value) {
  return normalizeSlashes(path.relative(repoRoot, value));
}

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--input' || token === '-i') {
      args.input = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--input=')) {
      args.input = token.slice('--input='.length);
      continue;
    }

    if (token === '--format') {
      args.format = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--format=')) {
      args.format = token.slice('--format='.length);
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

function inferFormat(inputPath, explicitFormat) {
  if (explicitFormat) {
    return explicitFormat.toLowerCase();
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
  if (ext === '.csv') return 'csv';
  return 'json';
}

function pickValue(row, aliases) {
  if (!row || typeof row !== 'object') return '';
  for (const alias of aliases) {
    const value = row[alias];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
  }
  return '';
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return value * 1000;
  }

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (!Number.isFinite(numeric)) return null;
    if (numeric > 1e12) return numeric;
    if (numeric > 1e9) return numeric * 1000;
    return numeric * 1000;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(iso) {
  return iso ? iso.replace('.000Z', 'Z') : '';
}

function toIso(ms) {
  return ms === null ? '' : new Date(ms).toISOString();
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KiB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MiB`;
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row = {};
    for (let cellIndex = 0; cellIndex < headers.length; cellIndex += 1) {
      row[headers[cellIndex]] = values[cellIndex] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function parseJsonRecords(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['records', 'events', 'rows', 'data']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    return [parsed];
  }
  return [];
}

function parseJsonlRecords(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed));
  }
  return rows;
}

function normalizeRecord(raw, rowNumber) {
  const eventName = pickValue(raw, eventAliases);
  const occurredAtRaw = pickValue(raw, timestampAliases);
  const workspaceId = pickValue(raw, workspaceAliases);
  const userId = pickValue(raw, userAliases);
  const occurredAtMs = parseTimestamp(occurredAtRaw);

  const missingFields = [];
  if (!eventName) missingFields.push('event_name');
  if (!occurredAtRaw || occurredAtMs === null) missingFields.push('occurred_at');
  if (!workspaceId) missingFields.push('workspace_id');
  if (!userId) missingFields.push('user_id');

  return {
    rowNumber,
    eventName,
    occurredAtRaw,
    occurredAtMs,
    occurredAtIso: occurredAtMs !== null ? new Date(occurredAtMs).toISOString() : '',
    workspaceId,
    userId,
    missingFields,
    raw,
  };
}

function groupByKey(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function keyForRow(row) {
  return `${row.workspaceId}::${row.userId}`;
}

function eventBucket(row) {
  if (requiredActivationEvents.includes(row.eventName)) return 'activation';
  if (requiredRetentionEvents.includes(row.eventName)) return 'retention';
  if (row.eventName.startsWith('billing_')) return 'billing';
  return 'other';
}

function safeSample(items, limit) {
  return items.slice(0, limit);
}

function buildReportMarkdown(summary) {
  const lines = [];
  lines.push('# Flow Finance - evidence check for activation and retention');
  lines.push('');
  lines.push(`Status: ${summary.status}`);
  lines.push(`Gate text: ${summary.gateText}`);
  lines.push(`Generated at: ${summary.generatedAt}`);
  lines.push(`Input: ${summary.inputPath ? summary.inputPath : 'not provided'}`);
  lines.push(`Format: ${summary.inputFormat}`);
  lines.push(`Cohort window: ${summary.cohortWindowDays !== null ? `${summary.cohortWindowDays} day(s)` : 'missing'}`);
  lines.push('');
  lines.push('## Minimum requirements');
  for (const item of summary.requiredInputs) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## What was found');
  lines.push(`- Parsed records: ${summary.parsedRecordCount}`);
  lines.push(`- Records with all required fields: ${summary.validRecordCount}`);
  lines.push(`- Distinct workspace/user cohorts: ${summary.cohortCount}`);
  lines.push(`- Activation cohorts found: ${summary.activationCohortCount}`);
  lines.push(`- Retention cohorts found within window: ${summary.retainedCohortCount}`);
  lines.push(`- Billing event rows observed: ${summary.billingRowCount}`);
  lines.push('');
  lines.push('## What was missing');
  if (summary.missingInputs.length === 0) {
    lines.push('- Nothing missing from the minimum input contract.');
  } else {
    for (const item of summary.missingInputs) {
      lines.push(`- ${item}`);
    }
  }
  lines.push('');
  lines.push('## Why the gate remains open');
  for (const item of summary.gateReasons) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Event counts');
  for (const [eventName, count] of Object.entries(summary.eventCounts).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`- ${eventName}: ${count}`);
  }
  lines.push('');
  lines.push('## References');
  for (const item of summary.referenceDocs) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Artifact');
  lines.push(`- ${summary.reportJsonPath}`);
  lines.push(`- ${summary.reportMarkdownPath}`);
  return `${lines.join('\n')}\n`;
}

async function readInputFile(inputPath, format) {
  const rawText = await fs.readFile(inputPath, 'utf8');
  const inputFormat = format || inferFormat(inputPath);

  switch (inputFormat) {
    case 'json':
      return parseJsonRecords(rawText);
    case 'jsonl':
      return parseJsonlRecords(rawText);
    case 'csv':
      return parseCsv(rawText);
    default:
      throw new Error(`Unsupported input format: ${inputFormat}`);
  }
}

function pickInputPath(args) {
  return args.input || readEnv('ACTIVATION_RETENTION_EVIDENCE_INPUT');
}

function pickOutputRoot(args) {
  return args.outputDir || readEnv('ACTIVATION_RETENTION_EVIDENCE_OUTPUT_DIR') || defaultOutputRoot;
}

function pickCohortWindowDays(args) {
  return parseInteger(args.cohortWindowDays ?? readEnv('ACTIVATION_RETENTION_COHORT_WINDOW_DAYS'));
}

function bucketRows(normalizedRows) {
  const buckets = {
    activation: [],
    retention: [],
    billing: [],
    otherRelevant: [],
  };

  for (const row of normalizedRows) {
    if (row.missingFields.length > 0) continue;
    const bucket = eventBucket(row);
    if (bucket === 'activation') {
      buckets.activation.push(row);
    } else if (bucket === 'retention') {
      buckets.retention.push(row);
    } else if (bucket === 'billing') {
      buckets.billing.push(row);
    } else {
      buckets.otherRelevant.push(row);
    }
  }

  return buckets;
}

function summarizeRows(normalizedRows, cohortWindowDays) {
  const validRows = normalizedRows.filter((row) => row.missingFields.length === 0);
  const eventCounts = {};
  for (const row of validRows) {
    eventCounts[row.eventName] = (eventCounts[row.eventName] || 0) + 1;
  }

  const counts = bucketRows(normalizedRows);
  const grouped = groupByKey(validRows, keyForRow);
  const cohortSummaries = [];

  for (const [cohortKey, rows] of grouped.entries()) {
    const activationRows = rows
      .filter((row) => requiredActivationEvents.includes(row.eventName))
      .sort((a, b) => a.occurredAtMs - b.occurredAtMs);
    const retentionRows = rows
      .filter((row) => requiredRetentionEvents.includes(row.eventName))
      .sort((a, b) => a.occurredAtMs - b.occurredAtMs);

    const firstActivation = activationRows[0] || null;
    const firstRetention = retentionRows.find((row) => firstActivation && row.occurredAtMs > firstActivation.occurredAtMs) || null;

    const withinWindow = firstActivation && firstRetention && cohortWindowDays !== null
      ? (firstRetention.occurredAtMs - firstActivation.occurredAtMs) <= (cohortWindowDays * 24 * 60 * 60 * 1000)
      : false;

    cohortSummaries.push({
      cohortKey,
      firstActivation,
      firstRetention,
      withinWindow,
    });
  }

  const activationCohorts = cohortSummaries.filter((item) => item.firstActivation);
  const retainedCohorts = cohortSummaries.filter((item) => item.withinWindow);
  const earliest = validRows.reduce((acc, row) => (acc === null || row.occurredAtMs < acc ? row.occurredAtMs : acc), null);
  const latest = validRows.reduce((acc, row) => (acc === null || row.occurredAtMs > acc ? row.occurredAtMs : acc), null);

  return {
    validRows,
    eventCounts,
    counts,
    cohortSummaries,
    activationCohorts,
    retainedCohorts,
    earliest,
    latest,
  };
}

async function writeArtifact(outputRoot, reportBaseName, summary, report) {
  const runDir = path.join(outputRoot, reportBaseName);
  await fs.mkdir(runDir, { recursive: true });
  const reportJsonPath = path.join(runDir, 'report.json');
  const reportMarkdownPath = path.join(runDir, 'report.md');

  const payload = {
    summary,
    report,
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportMarkdownPath, report, 'utf8');

  return {
    runDir,
    reportJsonPath,
    reportMarkdownPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write([
      'Flow Finance activation/retention evidence checker',
      '',
      'Usage:',
      '  node scripts/check-activation-retention-evidence.mjs --input <file> --cohort-window-days <days>',
      '',
      'Env:',
      '  ACTIVATION_RETENTION_EVIDENCE_INPUT',
      '  ACTIVATION_RETENTION_EVIDENCE_OUTPUT_DIR',
      '  ACTIVATION_RETENTION_COHORT_WINDOW_DAYS',
      '',
      'Formats:',
      '  json | jsonl | csv',
      '',
    ].join('\n'));
    return;
  }

  const inputPath = pickInputPath(args);
  const cohortWindowDays = pickCohortWindowDays(args);
  const outputRoot = path.resolve(repoRoot, pickOutputRoot(args));
  const inputFormat = inputPath ? inferFormat(inputPath, args.format) : (args.format ? args.format.toLowerCase() : 'json');
  const referenceDocs = [
    'docs/GO_LIVE_CHECKLIST_EXTERNAL_GATES_2026-06-04.md',
    'docs/OPERATIONS_README.md',
    'docs/OPERATIONS_SLO_RUNBOOK_2026-06-04.md',
    'src/app/productAnalytics.ts',
  ];
  const requiredInputs = [
    'event_name column with activation_first_transaction, activation_first_dashboard_useful, or weekly_cash_review_completed rows',
    'occurred_at column that can be parsed into a timestamp',
    'workspace_id column for the real workspace cohort',
    'user_id column for the real user cohort',
    'explicit cohort window via --cohort-window-days or ACTIVATION_RETENTION_COHORT_WINDOW_DAYS',
  ];

  const missingInputs = [];
  if (!inputPath) missingInputs.push('missing input path: pass --input or set ACTIVATION_RETENTION_EVIDENCE_INPUT');
  if (!cohortWindowDays || cohortWindowDays <= 0) missingInputs.push('missing or invalid cohort window: set --cohort-window-days or ACTIVATION_RETENTION_COHORT_WINDOW_DAYS to a positive integer');

  let parsedRows = [];
  let inputStats = null;
  let inputHash = '';
  let inputError = '';

  if (inputPath) {
    const absoluteInputPath = path.resolve(repoRoot, inputPath);
    try {
      const rawText = await fs.readFile(absoluteInputPath, 'utf8');
      const stats = await fs.stat(absoluteInputPath);
      inputStats = {
        absolutePath: absoluteInputPath,
        relativePath: rel(absoluteInputPath),
        bytes: stats.size,
      };
      inputHash = hashText(rawText);
      parsedRows = await readInputFile(absoluteInputPath, inputFormat);
    } catch (error) {
      inputError = error?.message || 'failed to read input';
      missingInputs.push(`failed to load input: ${inputError}`);
    }
  }

  const normalizedRows = parsedRows.map((row, index) => normalizeRecord(row, index + 1));
  const invalidRows = normalizedRows.filter((row) => row.missingFields.length > 0);
  const validRows = normalizedRows.filter((row) => row.missingFields.length === 0);
  const summary = summarizeRows(normalizedRows, cohortWindowDays);
  const relevantRows = validRows.filter((row) => requiredActivationEvents.includes(row.eventName) || requiredRetentionEvents.includes(row.eventName) || row.eventName.startsWith('billing_'));
  const relevantRowsSample = safeSample(relevantRows, 100);

  const activationRows = validRows.filter((row) => requiredActivationEvents.includes(row.eventName));
  const retentionRows = validRows.filter((row) => requiredRetentionEvents.includes(row.eventName));
  const cohortSummaries = summary.cohortSummaries;

  const gateReasons = [];
  if (missingInputs.length > 0) {
    gateReasons.push('minimum input contract not satisfied');
  }
  if (inputError) {
    gateReasons.push(`input could not be loaded: ${inputError}`);
  }
  if (parsedRows.length === 0) {
    gateReasons.push('no records were parsed from the supplied export');
  }
  if (invalidRows.length > 0) {
    gateReasons.push(`some rows are missing required fields: ${invalidRows.length} row(s)`);
  }
  if (activationRows.length === 0) {
    gateReasons.push('no activation event rows were found');
  }
  if (retentionRows.length === 0) {
    gateReasons.push('no weekly_cash_review_completed rows were found');
  }
  if (cohortWindowDays !== null && cohortWindowDays > 0 && cohortSummaries.filter((item) => item.withinWindow).length === 0) {
    gateReasons.push('no cohort proved retention inside the supplied window');
  }
  if (cohortSummaries.filter((item) => item.firstActivation).length === 0) {
    gateReasons.push('no real workspace/user cohort could be anchored on activation');
  }

  const hasEnoughEvidence = missingInputs.length === 0
    && parsedRows.length > 0
    && invalidRows.length === 0
    && activationRows.length > 0
    && retentionRows.length > 0
    && cohortSummaries.some((item) => item.withinWindow);

  const generatedAt = new Date().toISOString();
  const status = hasEnoughEvidence ? 'PASS' : 'BLOCK';
  const gateText = hasEnoughEvidence ? 'EVIDENCIA SUFICIENTE' : 'SEM EVIDENCIA SUFICIENTE';

  const reportBaseName = `${generatedAt.replace(/[:.]/g, '-')}-${path.basename(inputPath || 'no-input', path.extname(inputPath || ''))}`;
  const artifactPaths = await writeArtifact(
    outputRoot,
    reportBaseName,
    {
      generatedAt,
      status,
      gateText,
      inputPath: inputPath ? rel(path.resolve(repoRoot, inputPath)) : '',
      inputFormat,
      inputHash,
      inputBytes: inputStats?.bytes || 0,
      inputRecordCount: parsedRows.length,
      validRecordCount: validRows.length,
      invalidRecordCount: invalidRows.length,
      invalidRowSamples: safeSample(invalidRows.map((row) => ({
        rowNumber: row.rowNumber,
        missingFields: row.missingFields,
        eventName: row.eventName,
        occurredAtRaw: row.occurredAtRaw,
        workspaceId: row.workspaceId,
        userId: row.userId,
      })), 25),
      earliestEventAt: toIso(summary.earliest),
      latestEventAt: toIso(summary.latest),
      cohortWindowDays,
      activationCohortCount: cohortSummaries.filter((item) => item.firstActivation).length,
      retainedCohortCount: cohortSummaries.filter((item) => item.withinWindow).length,
      cohortCount: cohortSummaries.length,
      activationRowCount: activationRows.length,
      retentionRowCount: retentionRows.length,
      billingRowCount: summary.counts.billing.length,
      relevantRowCount: relevantRows.length,
      relevantRowsSample: relevantRowsSample.map((row) => ({
        rowNumber: row.rowNumber,
        eventName: row.eventName,
        occurredAt: formatDateTime(row.occurredAtIso),
        workspaceId: row.workspaceId,
        userId: row.userId,
      })),
      eventCounts: summary.eventCounts,
      cohortSummaries: cohortSummaries.map((item) => ({
        cohortKey: item.cohortKey,
        firstActivation: item.firstActivation ? {
          rowNumber: item.firstActivation.rowNumber,
          eventName: item.firstActivation.eventName,
          occurredAt: formatDateTime(item.firstActivation.occurredAtIso),
        } : null,
        firstRetention: item.firstRetention ? {
          rowNumber: item.firstRetention.rowNumber,
          eventName: item.firstRetention.eventName,
          occurredAt: formatDateTime(item.firstRetention.occurredAtIso),
        } : null,
        withinWindow: item.withinWindow,
      })),
      missingInputs,
      gateReasons,
      referenceDocs,
      requiredInputs,
      reportJsonPath: '',
      reportMarkdownPath: '',
    },
    '',
  );

  const reportMarkdown = buildReportMarkdown({
    status,
    gateText,
    generatedAt,
    inputPath: inputPath ? rel(path.resolve(repoRoot, inputPath)) : '',
    inputFormat,
    cohortWindowDays,
    requiredInputs,
    parsedRecordCount: parsedRows.length,
    validRecordCount: validRows.length,
    cohortCount: cohortSummaries.length,
    activationCohortCount: cohortSummaries.filter((item) => item.firstActivation).length,
    retainedCohortCount: cohortSummaries.filter((item) => item.withinWindow).length,
    billingRowCount: summary.counts.billing.length,
    missingInputs,
    gateReasons,
    eventCounts: summary.eventCounts,
    referenceDocs,
    reportJsonPath: rel(artifactPaths.reportJsonPath),
    reportMarkdownPath: rel(artifactPaths.reportMarkdownPath),
  });

  const artifactJson = {
    generatedAt,
    status,
    gateText,
    input: {
      path: inputPath ? rel(path.resolve(repoRoot, inputPath)) : '',
      format: inputFormat,
      sha256: inputHash,
      bytes: inputStats?.bytes || 0,
      recordCount: parsedRows.length,
    },
    config: {
      cohortWindowDays,
    },
    contract: {
      requiredInputs,
      referenceDocs,
    },
    findings: {
      parsedRecordCount: parsedRows.length,
      validRecordCount: validRows.length,
      invalidRecordCount: invalidRows.length,
      invalidRows: safeSample(invalidRows.map((row) => ({
        rowNumber: row.rowNumber,
        missingFields: row.missingFields,
        eventName: row.eventName,
        occurredAtRaw: row.occurredAtRaw,
        workspaceId: row.workspaceId,
        userId: row.userId,
      })), 50),
      earliestEventAt: toIso(summary.earliest),
      latestEventAt: toIso(summary.latest),
      eventCounts: summary.eventCounts,
      activationRows: safeSample(activationRows.map((row) => ({
        rowNumber: row.rowNumber,
        eventName: row.eventName,
        occurredAt: row.occurredAtIso,
        workspaceId: row.workspaceId,
        userId: row.userId,
      })), 200),
      retentionRows: safeSample(retentionRows.map((row) => ({
        rowNumber: row.rowNumber,
        eventName: row.eventName,
        occurredAt: row.occurredAtIso,
        workspaceId: row.workspaceId,
        userId: row.userId,
      })), 200),
      billingRows: safeSample(summary.counts.billing.map((row) => ({
        rowNumber: row.rowNumber,
        eventName: row.eventName,
        occurredAt: row.occurredAtIso,
        workspaceId: row.workspaceId,
        userId: row.userId,
      })), 200),
      cohortSummaries: cohortSummaries.map((item) => ({
        cohortKey: item.cohortKey,
        firstActivation: item.firstActivation ? {
          rowNumber: item.firstActivation.rowNumber,
          eventName: item.firstActivation.eventName,
          occurredAt: item.firstActivation.occurredAtIso,
        } : null,
        firstRetention: item.firstRetention ? {
          rowNumber: item.firstRetention.rowNumber,
          eventName: item.firstRetention.eventName,
          occurredAt: item.firstRetention.occurredAtIso,
        } : null,
        withinWindow: item.withinWindow,
      })),
    },
    assessment: {
      missingInputs,
      gateReasons,
    },
  };

  await fs.writeFile(artifactPaths.reportJsonPath, `${JSON.stringify(artifactJson, null, 2)}\n`, 'utf8');
  await fs.writeFile(artifactPaths.reportMarkdownPath, reportMarkdown, 'utf8');

  process.stdout.write('Flow Finance - activation and retention evidence check\n');
  process.stdout.write('=======================================================\n');
  process.stdout.write(`Input: ${inputPath ? rel(path.resolve(repoRoot, inputPath)) : 'not provided'}\n`);
  process.stdout.write(`Format: ${inputFormat}\n`);
  process.stdout.write(`Cohort window: ${cohortWindowDays !== null ? `${cohortWindowDays} day(s)` : 'missing'}\n`);
  process.stdout.write(`Artifact: ${rel(artifactPaths.reportJsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifactPaths.reportMarkdownPath)}\n`);
  process.stdout.write('\n');

  if (hasEnoughEvidence) {
    process.stdout.write('PASS: EVIDENCIA SUFICIENTE\n');
    process.stdout.write(`- activation cohorts: ${cohortSummaries.filter((item) => item.firstActivation).length}\n`);
    process.stdout.write(`- retained cohorts within window: ${cohortSummaries.filter((item) => item.withinWindow).length}\n`);
  } else {
    process.stdout.write('BLOCK: SEM EVIDENCIA SUFICIENTE\n');
    for (const reason of gateReasons) {
      process.stdout.write(`- ${reason}\n`);
    }
  }

  process.exitCode = hasEnoughEvidence ? 0 : 1;
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
