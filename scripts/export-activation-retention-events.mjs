#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const RUNNER_NAME = 'Activation/retention export runner';
const GATE_NAME = 'Activation and retention evidence export';
const DEFAULT_OUTPUT_ROOT = 'test-results/activation-retention-export';
const DEFAULT_PAGE_LIMIT = 500;
const DEFAULT_MAX_PAGES = 20;
const RELEVANT_EVENTS = [
  'activation_first_transaction',
  'activation_first_dashboard_useful',
  'weekly_cash_review_completed',
];

const BACKEND_URL_ENV = 'ACTIVATION_RETENTION_EXPORT_BACKEND_URL';
const BACKEND_URL_ALIASES = ['FLOW_LAUNCH_TARGET_URL', 'VERCEL_TARGET_URL'];
const BEARER_ENV = 'ACTIVATION_RETENTION_EXPORT_BEARER_TOKEN';
const BEARER_ALIASES = ['STRIPE_LIVE_SMOKE_BEARER_TOKEN'];
const COOKIE_ENV = 'ACTIVATION_RETENTION_EXPORT_COOKIE_HEADER';
const COOKIE_ALIASES = ['STRIPE_LIVE_SMOKE_COOKIE_HEADER'];
const WORKSPACE_ENV = 'ACTIVATION_RETENTION_EXPORT_WORKSPACE_ID';
const WORKSPACE_ALIASES = ['STRIPE_LIVE_SMOKE_WORKSPACE_ID'];

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

function readFirstEnv(name, aliases = []) {
  const value = readEnv(name);
  if (value) {
    return { value, source: name };
  }

  for (const alias of aliases) {
    const aliasValue = readEnv(alias);
    if (aliasValue) {
      return { value: aliasValue, source: alias };
    }
  }

  return { value: '', source: null };
}

function maskGeneric(value) {
  if (!value) return 'absent';
  if (value.length <= 8) return `${value[0]}***${value.at(-1) || ''}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalizeCookieHeader(value) {
  return String(value || '')
    .replace(/^cookie\s*:\s*/i, '')
    .trim();
}

function maskCookieHeader(value) {
  const normalized = normalizeCookieHeader(value);
  if (!normalized) return 'absent';

  return normalized
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return `${pair}=***`;
      const name = pair.slice(0, index).trim();
      return name ? `${name}=***` : '***';
    })
    .join('; ');
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--backend-url') {
      args.backendUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--backend-url=')) {
      args.backendUrl = token.slice('--backend-url='.length);
      continue;
    }

    if (token === '--workspace-id') {
      args.workspaceId = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--workspace-id=')) {
      args.workspaceId = token.slice('--workspace-id='.length);
      continue;
    }

    if (token === '--bearer-token') {
      args.bearerToken = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--bearer-token=')) {
      args.bearerToken = token.slice('--bearer-token='.length);
      continue;
    }

    if (token === '--cookie-header') {
      args.cookieHeader = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--cookie-header=')) {
      args.cookieHeader = token.slice('--cookie-header='.length);
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

    if (token === '--limit') {
      args.limit = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--limit=')) {
      args.limit = token.slice('--limit='.length);
      continue;
    }

    if (token === '--max-pages') {
      args.maxPages = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--max-pages=')) {
      args.maxPages = token.slice('--max-pages='.length);
      continue;
    }
  }

  return args;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildTargetUrl(baseUrl, pathname, params = {}) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function pickStringValue(raw, keys) {
  if (!raw || typeof raw !== 'object') return '';

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return '';
}

function toIsoString(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function isRelevantEventName(eventName) {
  return RELEVANT_EVENTS.includes(eventName);
}

function normalizeFinanceEvent(raw) {
  const eventName = pickStringValue(raw, ['event_name', 'eventName', 'type', 'name', 'event']);
  const occurredAt = pickStringValue(raw, ['occurred_at', 'occurredAt', 'timestamp', 'time', 'created_at', 'createdAt']);
  const workspaceId = pickStringValue(raw, ['workspace_id', 'workspaceId', 'workspace', 'tenant_id', 'tenantId']);
  const userId = pickStringValue(raw, ['user_id', 'userId', 'user', 'member_id', 'memberId', 'actor_id', 'actorId']);

  return {
    event_name: eventName,
    occurred_at: toIsoString(occurredAt),
    workspace_id: workspaceId,
    user_id: userId,
    valid: Boolean(eventName && occurredAt && workspaceId && userId && isRelevantEventName(eventName)),
  };
}

function sortNormalizedRows(left, right) {
  const leftTime = Date.parse(left.occurred_at);
  const rightTime = Date.parse(right.occurred_at);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.event_name !== right.event_name) {
    return left.event_name.localeCompare(right.event_name);
  }

  if (left.workspace_id !== right.workspace_id) {
    return left.workspace_id.localeCompare(right.workspace_id);
  }

  return left.user_id.localeCompare(right.user_id);
}

function resolveBackendTarget(args) {
  const explicit = typeof args.backendUrl === 'string' ? args.backendUrl.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--backend-url' };
  }

  return readFirstEnv(BACKEND_URL_ENV, BACKEND_URL_ALIASES);
}

function resolveWorkspaceId(args) {
  const explicit = typeof args.workspaceId === 'string' ? args.workspaceId.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--workspace-id' };
  }

  return readFirstEnv(WORKSPACE_ENV, WORKSPACE_ALIASES);
}

function resolveAuthContext(args) {
  const bearerToken = typeof args.bearerToken === 'string' ? args.bearerToken.trim() : '';
  if (bearerToken) {
    return {
      mode: 'bearer',
      source: '--bearer-token',
      value: bearerToken,
      masked: maskGeneric(bearerToken),
    };
  }

  const bearerEnv = readFirstEnv(BEARER_ENV, BEARER_ALIASES);
  if (bearerEnv.value) {
    return {
      mode: 'bearer',
      source: bearerEnv.source,
      value: bearerEnv.value,
      masked: maskGeneric(bearerEnv.value),
    };
  }

  const cookieHeader = typeof args.cookieHeader === 'string' ? normalizeCookieHeader(args.cookieHeader) : '';
  if (cookieHeader) {
    return {
      mode: 'cookie',
      source: '--cookie-header',
      value: cookieHeader,
      masked: maskCookieHeader(cookieHeader),
    };
  }

  const cookieEnv = readFirstEnv(COOKIE_ENV, COOKIE_ALIASES);
  if (cookieEnv.value) {
    return {
      mode: 'cookie',
      source: cookieEnv.source,
      value: normalizeCookieHeader(cookieEnv.value),
      masked: maskCookieHeader(cookieEnv.value),
    };
  }

  return {
    mode: null,
    source: null,
    value: '',
    masked: 'absent',
  };
}

function resolveOutputDir(args) {
  const explicit = typeof args.outputDir === 'string' ? args.outputDir.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--output-dir' };
  }

  const envValue = readEnv('ACTIVATION_RETENTION_EXPORT_OUTPUT_DIR');
  if (envValue) {
    return { value: envValue, source: 'ACTIVATION_RETENTION_EXPORT_OUTPUT_DIR' };
  }

  return { value: DEFAULT_OUTPUT_ROOT, source: 'default' };
}

function buildHeaders(authContext, workspaceId) {
  const headers = {
    Accept: 'application/json,text/plain;q=0.8,*/*;q=0.5',
    'x-workspace-id': workspaceId,
  };

  if (authContext.mode === 'bearer') {
    headers.Authorization = `Bearer ${authContext.value}`;
  } else if (authContext.mode === 'cookie') {
    headers.Cookie = authContext.value;
  }

  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('request timed out')), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchEventsPage(targetUrl, authContext, workspaceId, { limit, until }) {
  const requestUrl = buildTargetUrl(targetUrl, '/api/finance/events', {
    limit,
    until,
  });

  const response = await fetchWithTimeout(requestUrl, {
    method: 'GET',
    headers: buildHeaders(authContext, workspaceId),
  });

  const rawBody = await response.text();
  let json = null;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    json = null;
  }

  return {
    requestUrl: requestUrl.toString(),
    status: response.status,
    ok: response.ok,
    rawBody,
    json,
  };
}

async function collectEvents(targetUrl, authContext, workspaceId, { limit, maxPages }) {
  const pages = [];
  const rawEvents = [];
  let until = '';

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchEventsPage(targetUrl, authContext, workspaceId, { limit, until });
    pages.push({
      pageIndex: pageIndex + 1,
      requestUrl: page.requestUrl,
      status: page.status,
      ok: page.ok,
      rawBody: String(page.rawBody || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    });

    if (!page.ok) {
      return {
        ok: false,
        pages,
        rawEvents,
        error: {
          requestUrl: page.requestUrl,
          status: page.status,
          rawBody: page.rawBody,
          json: page.json,
        },
      };
    }

    const events = Array.isArray(page.json?.events) ? page.json.events : null;
    if (!events) {
      return {
        ok: false,
        pages,
        rawEvents,
        error: {
          requestUrl: page.requestUrl,
          status: page.status,
          rawBody: page.rawBody,
          json: page.json,
          reason: 'response missing events array',
        },
      };
    }

    rawEvents.push(...events);

    if (events.length < limit) {
      break;
    }

    const oldestTime = events.reduce((acc, event) => {
      const occurredAt = pickStringValue(event, ['occurredAt', 'occurred_at', 'timestamp', 'time', 'createdAt', 'created_at']);
      const parsed = Date.parse(occurredAt);
      if (!Number.isFinite(parsed)) return acc;
      return acc === null || parsed < acc ? parsed : acc;
    }, null);

    if (oldestTime === null) {
      return {
        ok: false,
        pages,
        rawEvents,
        error: {
          requestUrl: page.requestUrl,
          status: page.status,
          rawBody: page.rawBody,
          json: page.json,
          reason: 'could not determine pagination cursor',
        },
      };
    }

    until = new Date(oldestTime - 1).toISOString();
  }

  return {
    ok: true,
    pages,
    rawEvents,
    error: null,
  };
}

function buildNormalization(rawEvents) {
  const normalizedRows = rawEvents.map(normalizeFinanceEvent);
  const invalidRows = normalizedRows.filter((row) => !row.valid);
  const exportRows = normalizedRows
    .filter((row) => row.valid)
    .map((row) => ({
      event_name: row.event_name,
      occurred_at: row.occurred_at,
      workspace_id: row.workspace_id,
      user_id: row.user_id,
    }))
    .sort(sortNormalizedRows);

  const activationRows = exportRows.filter((row) => row.event_name === 'activation_first_transaction' || row.event_name === 'activation_first_dashboard_useful');
  const retentionRows = exportRows.filter((row) => row.event_name === 'weekly_cash_review_completed');

  return {
    normalizedRows,
    invalidRows,
    exportRows,
    activationRows,
    retentionRows,
    earliest: exportRows[0]?.occurred_at || '',
    latest: exportRows[exportRows.length - 1]?.occurred_at || '',
  };
}

function determineResult({ fetchState, exportRows, invalidRows, activationRows, retentionRows, workspaceId, backendUrl, authContext }) {
  const reasons = [];

  if (!backendUrl) reasons.push('missing backend url');
  if (!workspaceId) reasons.push('missing workspace id');
  if (!authContext.mode) reasons.push('missing bearer token or cookie header');
  if (!fetchState.ok) reasons.push(`failed to fetch finance events from backend (HTTP ${fetchState.error?.status ?? 'unknown'})`);
  if (invalidRows.length > 0) reasons.push(`normalized rows missing required fields: ${invalidRows.length}`);
  if (exportRows.length === 0) reasons.push('no relevant activation/retention events were found');
  if (activationRows.length === 0) reasons.push('no activation events were found');
  if (retentionRows.length === 0) reasons.push('no retention events were found');

  const usableEvidence = reasons.length === 0;

  return {
    status: usableEvidence ? 'PASS' : 'BLOCK',
    summary: usableEvidence
      ? 'PASS: real activation and retention events were exported from the backend'
      : `BLOCK: SEM EVIDENCIA SUFICIENTE: ${reasons[0]}`,
    usableEvidence,
    reasons,
  };
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function renderMarkdownReport(payload) {
  const lines = [
    '# Flow Finance - activation and retention export',
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- backend url: ${payload.inputs.backendUrl.value || 'absent'}`,
    `- workspace id: ${payload.inputs.workspaceId.value || 'absent'}`,
    `- auth mode: ${payload.inputs.auth.mode || 'absent'}`,
    `- export file: ${payload.artifacts.exportRelative}`,
    `- report file: ${payload.artifacts.jsonRelative}`,
    '',
    '## Fetch summary',
    '',
    `- pages fetched: ${payload.fetch.pagesFetched}`,
    `- raw records fetched: ${payload.fetch.rawRecordCount}`,
    `- relevant records kept: ${payload.fetch.relevantRecordCount}`,
    `- activation rows: ${payload.fetch.activationRowCount}`,
    `- retention rows: ${payload.fetch.retentionRowCount}`,
    `- usable evidence: ${payload.result.usableEvidence ? 'yes' : 'no'}`,
    '',
    '## Artifact',
    '',
    `- export: ${payload.artifacts.exportRelative}`,
    `- report: ${payload.artifacts.jsonRelative}`,
    '',
  ];

  return `${lines.join('\n')}`;
}

async function writeArtifact(outputDir, baseName, payload, exportRows) {
  const runDir = path.join(outputDir, baseName);
  await fs.mkdir(runDir, { recursive: true });

  const exportPath = path.join(runDir, 'events.jsonl');
  const reportJsonPath = path.join(runDir, 'report.json');
  const reportMarkdownPath = path.join(runDir, 'report.md');

  const exportBody = `${exportRows.map((row) => JSON.stringify(row)).join('\n')}${exportRows.length > 0 ? '\n' : ''}`;
  await fs.writeFile(exportPath, exportBody, 'utf8');
  await fs.writeFile(reportJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportMarkdownPath, `${renderMarkdownReport(payload)}\n`, 'utf8');

  return {
    runDir,
    exportPath,
    reportJsonPath,
    reportMarkdownPath,
  };
}

export {
  buildNormalization,
  buildTargetUrl,
  collectEvents,
  determineResult,
  normalizeFinanceEvent,
  parseArgs,
  resolveAuthContext,
  resolveBackendTarget,
  resolveOutputDir,
  resolveWorkspaceId,
  RELEVANT_EVENTS,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backendTarget = resolveBackendTarget(args);
  const authContext = resolveAuthContext(args);
  const workspaceTarget = resolveWorkspaceId(args);
  const outputTarget = resolveOutputDir(args);
  const limit = parsePositiveInteger(args.limit, DEFAULT_PAGE_LIMIT);
  const maxPages = parsePositiveInteger(args.maxPages, DEFAULT_MAX_PAGES);

  if (args.help) {
    process.stdout.write([
      'Flow Finance activation/retention export runner',
      '',
      'Usage:',
      '  node scripts/export-activation-retention-events.mjs --backend-url <url> --workspace-id <id> [--bearer-token <token> | --cookie-header <cookie>]',
      '',
      'Env:',
      `  ${BACKEND_URL_ENV}`,
      `  ${BEARER_ENV}`,
      `  ${COOKIE_ENV}`,
      `  ${WORKSPACE_ENV}`,
      '  ACTIVATION_RETENTION_EXPORT_OUTPUT_DIR',
      '',
      'Aliases:',
      `  ${BACKEND_URL_ALIASES.join(', ')}`,
      `  ${BEARER_ALIASES.join(', ')}`,
      `  ${COOKIE_ALIASES.join(', ')}`,
      `  ${WORKSPACE_ALIASES.join(', ')}`,
      '',
      'Output:',
      `  ${DEFAULT_OUTPUT_ROOT}/<timestamp>/events.jsonl`,
      '',
    ].join('\n'));
    return;
  }

  const timestamp = formatTimestamp();
  const canFetch = backendTarget.value && workspaceTarget.value && authContext.mode;
  const fetchState = canFetch
    ? await collectEvents(backendTarget.value, authContext, workspaceTarget.value, { limit, maxPages })
    : {
        ok: false,
        pages: [],
        rawEvents: [],
        error: { reason: 'missing required inputs for backend fetch' },
      };

  const normalization = buildNormalization(fetchState.rawEvents);
  const result = determineResult({
    fetchState,
    exportRows: normalization.exportRows,
    invalidRows: normalization.invalidRows,
    activationRows: normalization.activationRows,
    retentionRows: normalization.retentionRows,
    workspaceId: workspaceTarget.value,
    backendUrl: backendTarget.value,
    authContext,
  });

  const runBaseName = timestamp.replace(/[:.]/g, '-');
  const reportPayload = {
    runnerName: RUNNER_NAME,
    gateName: GATE_NAME,
    timestamp,
    result,
    inputs: {
      backendUrl: backendTarget,
      workspaceId: workspaceTarget,
      auth: {
        mode: authContext.mode,
        source: authContext.source,
        masked: authContext.masked,
      },
      outputDir: outputTarget,
      limit,
      maxPages,
    },
    fetch: {
      pagesFetched: fetchState.pages.length,
      rawRecordCount: fetchState.rawEvents.length,
      relevantRecordCount: normalization.exportRows.length,
      activationRowCount: normalization.activationRows.length,
      retentionRowCount: normalization.retentionRows.length,
      earliest: normalization.earliest,
      latest: normalization.latest,
      pages: fetchState.pages,
      error: fetchState.ok ? null : fetchState.error,
    },
    export: {
      rowCount: normalization.exportRows.length,
      hash: hashText(`${normalization.exportRows.map((row) => JSON.stringify(row)).join('\n')}${normalization.exportRows.length > 0 ? '\n' : ''}`),
    },
    artifacts: {
      rootRelative: '',
      exportRelative: '',
      jsonRelative: '',
      markdownRelative: '',
    },
  };

  const outputRootAbsolute = path.resolve(repoRoot, outputTarget.value);
  const artifacts = await writeArtifact(outputRootAbsolute, runBaseName, reportPayload, normalization.exportRows);

  reportPayload.artifacts = {
    rootRelative: rel(artifacts.runDir),
    exportRelative: rel(artifacts.exportPath),
    jsonRelative: rel(artifacts.reportJsonPath),
    markdownRelative: rel(artifacts.reportMarkdownPath),
  };

  await fs.writeFile(artifacts.reportJsonPath, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');
  await fs.writeFile(artifacts.reportMarkdownPath, `${renderMarkdownReport(reportPayload)}\n`, 'utf8');

  process.stdout.write('Flow Finance - activation and retention export\n');
  process.stdout.write('==============================================\n');
  process.stdout.write(`Backend: ${backendTarget.value || 'not provided'}\n`);
  process.stdout.write(`Workspace: ${workspaceTarget.value || 'not provided'}\n`);
  process.stdout.write(`Auth: ${authContext.mode || 'not provided'} (${authContext.masked})\n`);
  process.stdout.write(`Export: ${rel(artifacts.exportPath)}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.reportJsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.reportMarkdownPath)}\n`);
  process.stdout.write('\n');
  process.stdout.write(`${result.summary}\n`);
  process.stdout.write(`export-jsonl: ${rel(artifacts.exportPath)}\n`);
  process.stdout.write(`artifact-json: ${rel(artifacts.reportJsonPath)}\n`);
  process.stdout.write(`artifact-md: ${rel(artifacts.reportMarkdownPath)}\n`);

  process.exitCode = result.usableEvidence ? 0 : 1;
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
