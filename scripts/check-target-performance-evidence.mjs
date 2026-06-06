#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const RUNNER_NAME = 'Target performance evidence runner';
const GATE_NAME = 'Performance in target environment';
const BENCHMARK_ROUTE = '/?bench=dashboard';
const DEFAULT_BASELINE_RELATIVE_PATH = 'test-results/performance-baseline/chromium-dashboard.json';
const DEFAULT_OUTPUT_ROOT = 'test-results/target-performance-evidence';
const TARGET_URL_ENV_VARS = ['FLOW_LAUNCH_TARGET_URL', 'VERCEL_TARGET_URL'];
const GOTO_TIMEOUT_MS = 45_000;
const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const METRIC_NAMES = ['navigationDurationMs', 'domContentLoadedMs', 'loadEventMs', 'resourceCount'];

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(value) {
  return normalizeSlashes(path.relative(process.cwd(), value));
}

function safeTimestamp(value) {
  return value.replace(/[:.]/g, '-');
}

function summarizeText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--target-url') {
      args.targetUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--target-url=')) {
      args.targetUrl = token.slice('--target-url='.length);
      continue;
    }

    if (token === '--baseline') {
      args.baseline = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--baseline=')) {
      args.baseline = token.slice('--baseline='.length);
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

function pickFirstEnv(names) {
  for (const name of names) {
    const value = readStringEnv(name);
    if (value) {
      return { value, source: name };
    }
  }

  return { value: '', source: null };
}

function getTargetUrl(args) {
  const explicit = typeof args.targetUrl === 'string' ? args.targetUrl.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--target-url' };
  }

  return pickFirstEnv(TARGET_URL_ENV_VARS);
}

function getBaselinePath(args) {
  const explicit = typeof args.baseline === 'string' ? args.baseline.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--baseline' };
  }

  const envValue = readStringEnv('TARGET_PERFORMANCE_BASELINE_PATH');
  if (envValue) {
    return { value: envValue, source: 'TARGET_PERFORMANCE_BASELINE_PATH' };
  }

  return { value: DEFAULT_BASELINE_RELATIVE_PATH, source: 'default' };
}

function getOutputRoot(args) {
  const explicit = typeof args.outputDir === 'string' ? args.outputDir.trim() : '';
  if (explicit) {
    return { value: explicit, source: '--output-dir' };
  }

  const envValue = readStringEnv('TARGET_PERFORMANCE_EVIDENCE_OUTPUT_DIR');
  if (envValue) {
    return { value: envValue, source: 'TARGET_PERFORMANCE_EVIDENCE_OUTPUT_DIR' };
  }

  return { value: DEFAULT_OUTPUT_ROOT, source: 'default' };
}

function normalizeMetrics(source, label) {
  const metrics = {};
  const errors = [];

  for (const name of METRIC_NAMES) {
    const value = toFiniteNumber(source?.[name]);
    if (value === null) {
      errors.push(`${label}.${name} missing or invalid`);
      continue;
    }

    metrics[name] = Math.round(value);
  }

  return { metrics, errors };
}

async function loadBaseline(baselinePath) {
  const absolutePath = path.resolve(process.cwd(), baselinePath);
  const baseline = {
    ok: false,
    sourcePath: absolutePath,
    sourcePathRelative: rel(absolutePath),
    exists: false,
    size: 0,
    hash: null,
    capturedAt: null,
    route: null,
    projectName: null,
    metrics: null,
    errors: [],
  };

  try {
    const raw = await fs.readFile(absolutePath, 'utf8');
    const stats = await fs.stat(absolutePath);
    baseline.exists = true;
    baseline.size = stats.size;
    baseline.hash = hashText(raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      baseline.errors.push(`baseline JSON invalid: ${summarizeText(error?.message || String(error), 180)}`);
      return baseline;
    }

    if (!isRecord(parsed)) {
      baseline.errors.push('baseline JSON is not an object');
      return baseline;
    }

    if (typeof parsed.capturedAt === 'string' && parsed.capturedAt.trim()) {
      baseline.capturedAt = parsed.capturedAt.trim();
    } else {
      baseline.errors.push('baseline.capturedAt missing or invalid');
    }

    if (typeof parsed.route === 'string' && parsed.route.trim()) {
      baseline.route = parsed.route.trim();
    } else {
      baseline.errors.push('baseline.route missing or invalid');
    }

    if (typeof parsed.projectName === 'string' && parsed.projectName.trim()) {
      baseline.projectName = parsed.projectName.trim();
    } else {
      baseline.errors.push('baseline.projectName missing or invalid');
    }

    if (!isRecord(parsed.metrics)) {
      baseline.errors.push('baseline.metrics missing or invalid');
      return baseline;
    }

    const { metrics, errors } = normalizeMetrics(parsed.metrics, 'baseline.metrics');
    baseline.metrics = metrics;
    baseline.errors.push(...errors);
    baseline.ok = baseline.errors.length === 0;
    return baseline;
  } catch (error) {
    baseline.errors.push(
      error?.code === 'ENOENT'
        ? 'baseline file missing'
        : summarizeText(error?.message || String(error), 180),
    );
    return baseline;
  }
}

async function captureTargetMeasurement(targetUrl) {
  const measurement = {
    ok: false,
    sourceUrl: targetUrl,
    benchmarkUrl: null,
    finalUrl: null,
    benchmarkFlag: null,
    responseStatus: null,
    responseOk: null,
    capturedAt: new Date().toISOString(),
    waitForNetworkIdle: 'not-run',
    networkIdleError: null,
    metrics: null,
    consoleErrors: [],
    pageErrors: [],
    errors: [],
  };

  let browser;
  let context;
  let page;

  try {
    measurement.benchmarkUrl = new URL(BENCHMARK_ROUTE, targetUrl).toString();
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    page = await context.newPage();

    page.on('console', (message) => {
      const type = message.type();
      if (type === 'error' || type === 'warning') {
        measurement.consoleErrors.push({
          type,
          text: summarizeText(message.text(), 240),
        });
      }
    });

    page.on('pageerror', (error) => {
      measurement.pageErrors.push(summarizeText(error?.message || String(error), 240));
    });

    const response = await page.goto(measurement.benchmarkUrl, {
      waitUntil: 'domcontentloaded',
      timeout: GOTO_TIMEOUT_MS,
    });

    measurement.responseStatus = response?.status() ?? null;
    measurement.responseOk = response?.ok() ?? null;
    measurement.finalUrl = page.url();

    try {
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS });
      measurement.waitForNetworkIdle = 'reached';
    } catch (error) {
      measurement.waitForNetworkIdle = 'timeout';
      measurement.networkIdleError = summarizeText(error?.message || String(error), 240);
    }

    const extracted = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];

      return {
        navigationDurationMs: Math.round(navigation?.duration ?? 0),
        domContentLoadedMs: Math.round((navigation?.domContentLoadedEventEnd ?? 0) - (navigation?.startTime ?? 0)),
        loadEventMs: Math.round((navigation?.loadEventEnd ?? 0) - (navigation?.startTime ?? 0)),
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    const normalized = normalizeMetrics(extracted, 'target.metrics');
    measurement.metrics = normalized.metrics;
    measurement.errors.push(...normalized.errors);

    try {
      const parsedFinalUrl = new URL(measurement.finalUrl || measurement.benchmarkUrl || targetUrl);
      measurement.benchmarkFlag = parsedFinalUrl.searchParams.get('bench') || null;
    } catch {
      measurement.benchmarkFlag = null;
    }

    measurement.ok = measurement.errors.length === 0;
    return measurement;
  } catch (error) {
    measurement.errors.push(summarizeText(error?.message || String(error), 240));
    return measurement;
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

function formatDelta(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value >= 0 ? '+' : ''}${value}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function buildComparison(baseline, target) {
  const metrics = {};
  let comparable = true;

  for (const name of METRIC_NAMES) {
    const baselineValue = toFiniteNumber(baseline.metrics?.[name]);
    const targetValue = toFiniteNumber(target.metrics?.[name]);

    if (baselineValue === null || targetValue === null) {
      comparable = false;
      metrics[name] = {
        baseline: baselineValue,
        target: targetValue,
        delta: null,
        deltaPct: null,
        comparable: false,
      };
      continue;
    }

    const delta = targetValue - baselineValue;
    const deltaPct = baselineValue === 0 ? null : (delta / baselineValue) * 100;

    metrics[name] = {
      baseline: baselineValue,
      target: targetValue,
      delta,
      deltaPct,
      comparable: true,
    };
  }

  const summary = METRIC_NAMES.map((name) => {
    const item = metrics[name];
    const unit = name === 'resourceCount' ? 'count' : 'ms';

    if (!item.comparable) {
      return `${name}: n/a`;
    }

    return `${name}: ${formatDelta(item.delta)} ${unit} (${formatPercent(item.deltaPct)})`;
  }).join(' | ');

  return {
    comparable,
    metrics,
    summary,
  };
}

function determineResult({ targetUrl, baseline, targetMeasurement, comparison }) {
  const missing = [];

  if (!targetUrl) {
    missing.push('SEM EVIDENCIA SUFICIENTE: faltou URL alvo');
  }

  if (!baseline.ok) {
    missing.push(`SEM EVIDENCIA SUFICIENTE: baseline local indisponivel (${baseline.errors.join('; ')})`);
  }

  if (!targetMeasurement.benchmarkUrl) {
    missing.push('SEM EVIDENCIA SUFICIENTE: nao foi possivel montar a URL de benchmark do dashboard');
  }

  if (targetMeasurement.responseStatus !== 200) {
    missing.push(
      `SEM EVIDENCIA SUFICIENTE: alvo retornou HTTP ${targetMeasurement.responseStatus ?? 'sem resposta'}`,
    );
  }

  if (targetMeasurement.benchmarkFlag !== 'dashboard') {
    missing.push('SEM EVIDENCIA SUFICIENTE: o benchmark dashboard nao permaneceu visivel no alvo');
  }

  const targetMetrics = targetMeasurement.metrics;
  if (!targetMetrics || METRIC_NAMES.some((name) => !Number.isFinite(targetMetrics[name]) || targetMetrics[name] <= 0)) {
    missing.push('SEM EVIDENCIA SUFICIENTE: medicao alvo incompleta ou invalida');
  }

  if (!comparison.comparable) {
    missing.push('SEM EVIDENCIA SUFICIENTE: medicao nao comparavel com baseline local');
  }

  if (missing.length > 0) {
    return {
      status: 'BLOCK',
      summary: `BLOCK: ${missing[0]}`,
      reason: missing,
    };
  }

  return {
    status: 'PASS',
    summary: 'PASS: medicao do dashboard capturada no alvo e comparada com baseline local',
    reason: [],
  };
}

function renderMarkdownReport(payload) {
  const lines = [
    `# ${GATE_NAME} evidence`,
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- target url: ${payload.inputs.targetUrl.value || 'absent'}`,
    `- benchmark url: ${payload.targetMeasurement.benchmarkUrl || 'absent'}`,
    `- baseline path: ${payload.inputs.baselinePath.sourcePathRelative}`,
    `- baseline hash: ${payload.baseline.hash || 'absent'}`,
    `- artifact root: ${payload.artifacts.rootRelative}`,
    '',
    '## Inputs',
    '',
    '| field | value | source |',
    '| --- | --- | --- |',
    `| target url | ${payload.inputs.targetUrl.value || 'absent'} | ${payload.inputs.targetUrl.source || 'absent'} |`,
    `| baseline path | ${payload.inputs.baselinePath.sourcePathRelative} | ${payload.inputs.baselinePath.source || 'absent'} |`,
    `| output dir | ${payload.inputs.outputDir.sourcePathRelative} | ${payload.inputs.outputDir.source || 'absent'} |`,
    '',
    '## Baseline',
    '',
    `- source path: ${payload.baseline.sourcePathRelative}`,
    `- captured at: ${payload.baseline.capturedAt || 'absent'}`,
    `- route: ${payload.baseline.route || 'absent'}`,
    `- project: ${payload.baseline.projectName || 'absent'}`,
    `- hash: ${payload.baseline.hash || 'absent'}`,
    '',
    '| metric | baseline | target | delta | delta % |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const name of METRIC_NAMES) {
    const item = payload.comparison.metrics[name] || {};
    const unit = name === 'resourceCount' ? 'count' : 'ms';
    const baselineValue = Number.isFinite(item.baseline) ? `${item.baseline} ${unit}` : 'n/a';
    const targetValue = Number.isFinite(item.target) ? `${item.target} ${unit}` : 'n/a';
    const delta = Number.isFinite(item.delta) ? `${formatDelta(item.delta)} ${unit}` : 'n/a';
    const deltaPct = Number.isFinite(item.deltaPct) ? formatPercent(item.deltaPct) : 'n/a';
    lines.push(`| ${name} | ${baselineValue} | ${targetValue} | ${delta} | ${deltaPct} |`);
  }

  lines.push(
    '',
    '## Target measurement',
    '',
    `- source url: ${payload.targetMeasurement.sourceUrl || 'absent'}`,
    `- benchmark url: ${payload.targetMeasurement.benchmarkUrl || 'absent'}`,
    `- final url: ${payload.targetMeasurement.finalUrl || 'absent'}`,
    `- response status: ${payload.targetMeasurement.responseStatus ?? 'absent'}`,
    `- response ok: ${payload.targetMeasurement.responseOk === null ? 'absent' : String(payload.targetMeasurement.responseOk)}`,
    `- benchmark flag: ${payload.targetMeasurement.benchmarkFlag || 'absent'}`,
    `- network idle: ${payload.targetMeasurement.waitForNetworkIdle}`,
    `- capture errors: ${payload.targetMeasurement.errors.length > 0 ? payload.targetMeasurement.errors.join(' | ') : 'none'}`,
    `- console warnings/errors: ${payload.targetMeasurement.consoleErrors.length}`,
    `- page errors: ${payload.targetMeasurement.pageErrors.length}`,
    '',
    '| metric | value |',
    '| --- | --- |',
  );

  for (const name of METRIC_NAMES) {
    const unit = name === 'resourceCount' ? 'count' : 'ms';
    const value = Number.isFinite(payload.targetMeasurement.metrics?.[name])
      ? `${payload.targetMeasurement.metrics[name]} ${unit}`
      : 'n/a';
    lines.push(`| ${name} | ${value} |`);
  }

  lines.push(
    '',
    '## Comparison',
    '',
    `- comparable: ${payload.comparison.comparable ? 'yes' : 'no'}`,
    `- summary: ${payload.comparison.summary}`,
    '',
    '## Result',
    '',
    `- status: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- reason: ${payload.result.reason.length > 0 ? payload.result.reason.join(' | ') : 'none'}`,
    '',
    '## Runtime',
    '',
    `- node: ${payload.runtime.nodeVersion}`,
    `- platform: ${payload.runtime.platform}`,
    `- arch: ${payload.runtime.arch}`,
    '',
  );

  return `${lines.join('\n')}`;
}

function usage() {
  process.stdout.write('Uso:\n');
  process.stdout.write('  npm run health:target-performance -- --target-url https://preview-url.vercel.app\n');
  process.stdout.write('  ou\n');
  process.stdout.write('  FLOW_LAUNCH_TARGET_URL=https://preview-url.vercel.app npm run health:target-performance\n');
  process.stdout.write('  ou\n');
  process.stdout.write('  VERCEL_TARGET_URL=https://preview-url.vercel.app npm run health:target-performance\n');
  process.stdout.write('  baseline padrao: test-results/performance-baseline/chromium-dashboard.json\n');
  process.exit(1);
}

async function writeArtifact(payload) {
  await fs.mkdir(payload.artifacts.rootAbsolute, { recursive: true });

  const jsonPath = path.join(payload.artifacts.rootAbsolute, 'report.json');
  const mdPath = path.join(payload.artifacts.rootAbsolute, 'report.md');

  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, `${renderMarkdownReport(payload)}\n`, 'utf8');

  return {
    jsonPath,
    mdPath,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    usage();
  }

  const timestamp = new Date().toISOString();
  const runId = safeTimestamp(timestamp);
  const targetInput = getTargetUrl(args);
  const baselineInput = getBaselinePath(args);
  const outputInput = getOutputRoot(args);

  const outputRootAbsolute = path.resolve(process.cwd(), outputInput.value, runId);
  const outputRootRelative = rel(outputRootAbsolute);

  const baseline = await loadBaseline(baselineInput.value);
  const targetMeasurement = targetInput.value
    ? await captureTargetMeasurement(targetInput.value)
    : {
        ok: false,
        sourceUrl: '',
        benchmarkUrl: null,
        finalUrl: null,
        benchmarkFlag: null,
        responseStatus: null,
        responseOk: null,
        capturedAt: new Date().toISOString(),
        waitForNetworkIdle: 'not-run',
        networkIdleError: null,
        metrics: null,
        consoleErrors: [],
        pageErrors: [],
        errors: [],
      };

  const comparison = buildComparison(baseline, targetMeasurement);
  const result = determineResult({
    targetUrl: targetInput.value,
    baseline,
    targetMeasurement,
    comparison,
  });

  const payload = {
    runnerName: RUNNER_NAME,
    gateName: GATE_NAME,
    timestamp,
    runId,
    inputs: {
      targetUrl: {
        value: targetInput.value,
        source: targetInput.source,
      },
      baselinePath: {
        value: baselineInput.value,
        source: baselineInput.source,
        sourcePathRelative: rel(path.resolve(process.cwd(), baselineInput.value)),
      },
      outputDir: {
        value: outputInput.value,
        source: outputInput.source,
        sourcePathRelative: outputRootRelative,
      },
    },
    baseline,
    targetMeasurement,
    comparison,
    result,
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    artifacts: {
      rootAbsolute: outputRootAbsolute,
      rootRelative: outputRootRelative,
      jsonRelative: rel(path.join(outputRootAbsolute, 'report.json')),
      markdownRelative: rel(path.join(outputRootAbsolute, 'report.md')),
    },
  };

  const artifactPaths = await writeArtifact(payload);
  payload.artifacts.jsonRelative = rel(artifactPaths.jsonPath);
  payload.artifacts.markdownRelative = rel(artifactPaths.mdPath);

  process.stdout.write(`${GATE_NAME}\n`);
  process.stdout.write(`${'='.repeat(GATE_NAME.length)}\n`);
  process.stdout.write(`${result.status}: ${result.reason[0] || result.summary}\n`);
  process.stdout.write(`artifact-json: ${payload.artifacts.jsonRelative}\n`);
  process.stdout.write(`artifact-md: ${payload.artifacts.markdownRelative}\n`);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  if (result.status !== 'PASS') {
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      runnerName: RUNNER_NAME,
      gateName: GATE_NAME,
      error: summarizeText(error?.message || String(error), 240),
    }, null, 2)}\n`);
    process.exit(1);
  });
}
