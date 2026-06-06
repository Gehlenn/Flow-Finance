#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_STRIPE_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_WEBHOOK_SECRET',
];

const PERFORMANCE_BASELINE_RELATIVE_PATH = 'test-results/performance-baseline/chromium-dashboard.json';
const MANUAL_STRIPE_EVIDENCE_RELATIVE_PATH = 'test-results/stripe-live-smoke/published-e2e-verified.json';
const MANUAL_ACTIVATION_RETENTION_EVIDENCE_RELATIVE_PATH = 'test-results/activation-retention-export/published-export-verified.json';
const TARGET_PERFORMANCE_EVIDENCE_DIR = 'test-results/target-performance-evidence';
const LAUNCH_TARGET_URL_ENV = 'FLOW_LAUNCH_TARGET_URL';
const FETCH_TIMEOUT_MS = 10000;
const CHILD_GATE_CHECKS = [
  {
    label: 'target performance evidence runner',
    script: 'scripts/check-target-performance-evidence.mjs',
  },
  {
    label: 'stripe live smoke runner',
    script: 'scripts/check-stripe-live-smoke.mjs',
  },
  {
    label: 'activation retention evidence runner',
    script: 'scripts/check-activation-retention-evidence.mjs',
  },
];

function formatStatus(level, label, detail) {
  const suffix = detail ? ` - ${detail}` : '';
  return `${level} ${label}${suffix}`;
}

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function summarizeChildOutput(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8);
}

function findFirstMatchingLine(text, pattern) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => pattern.test(line));
}

function checkRequiredEnvVars({ skipStripeEnvChecks = false } = {}) {
  if (skipStripeEnvChecks) {
    return {
      blocked: false,
      results: [formatStatus('PASS', 'stripe env requirements', 'skipped because manual Stripe evidence is already verified')],
    };
  }

  const results = [];
  let blocked = false;

  for (const name of REQUIRED_STRIPE_ENV_VARS) {
    const value = readStringEnv(name);
    if (value) {
      results.push(formatStatus('PASS', `env ${name}`, 'present'));
      continue;
    }

    blocked = true;
    results.push(formatStatus('BLOCK', `env ${name}`, 'missing'));
  }

  return { blocked, results };
}

function checkExistingTargetPerformanceEvidence() {
  const absoluteDir = path.resolve(process.cwd(), TARGET_PERFORMANCE_EVIDENCE_DIR);
  if (!fs.existsSync(absoluteDir)) {
    return null;
  }

  const reportPaths = [];
  const stack = [absoluteDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name === 'report.json') {
        reportPaths.push(absolutePath);
      }
    }
  }

  if (reportPaths.length === 0) {
    return null;
  }

  reportPaths.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  for (const candidate of reportPaths) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed?.status === 'PASS' || parsed?.result?.status === 'PASS') {
        return {
          blocked: false,
          results: [
            formatStatus(
              'PASS',
              'target performance evidence runner',
              `${path.relative(process.cwd(), candidate)} | existing PASS artifact`
            ),
          ],
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function checkPerformanceBaseline() {
  const absolutePath = path.resolve(process.cwd(), PERFORMANCE_BASELINE_RELATIVE_PATH);

  if (fs.existsSync(absolutePath)) {
    const stats = fs.statSync(absolutePath);
    const detail = stats.size > 0 ? `found (${stats.size} bytes)` : 'found but empty';
    return {
      blocked: stats.size === 0,
      result: formatStatus(stats.size > 0 ? 'PASS' : 'BLOCK', `artifact ${PERFORMANCE_BASELINE_RELATIVE_PATH}`, detail),
    };
  }

  return {
    blocked: true,
    result: formatStatus('BLOCK', `artifact ${PERFORMANCE_BASELINE_RELATIVE_PATH}`, 'missing'),
  };
}

function checkManualStripeEvidence() {
  return readVerifiedEvidenceArtifact(MANUAL_STRIPE_EVIDENCE_RELATIVE_PATH, 'stripe live smoke manual evidence');
}

export function isVerifiedEvidenceArtifact(parsed) {
  return Boolean(parsed && typeof parsed === 'object' && parsed.verified === true);
}

function readVerifiedEvidenceArtifact(relativePath, label) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    if (isVerifiedEvidenceArtifact(parsed)) {
      return {
        blocked: false,
        results: [
          formatStatus(
            'PASS',
            label,
            `${relativePath} | ${parsed.summary || 'verified'}`
          ),
        ],
      };
    }

    return {
      blocked: true,
      results: [
        formatStatus(
          'BLOCK',
          label,
          `${relativePath} exists but is not verified`
        ),
      ],
    };
  } catch (error) {
      return {
        blocked: true,
        results: [
          formatStatus(
            'BLOCK',
            label,
            `invalid JSON: ${error?.message || 'unexpected parse error'}`
          ),
        ],
      };
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('request timed out')), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.5',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkLaunchTargetUrl() {
  const targetUrl = readStringEnv(LAUNCH_TARGET_URL_ENV);

  if (!targetUrl) {
    return {
      blocked: false,
      result: formatStatus('WARN', `target ${LAUNCH_TARGET_URL_ENV}`, 'not set; skipped'),
    };
  }

  try {
    const response = await fetchWithTimeout(targetUrl, FETCH_TIMEOUT_MS);
    const detail = `HTTP ${response.status} ${response.statusText || ''}`.trim();

    if (response.ok) {
      return {
        blocked: false,
        result: formatStatus('PASS', `target ${targetUrl}`, detail),
      };
    }

    return {
      blocked: true,
      result: formatStatus('BLOCK', `target ${targetUrl}`, detail),
    };
  } catch (error) {
    const reason = error?.name === 'AbortError'
      ? `timed out after ${FETCH_TIMEOUT_MS}ms`
      : error?.message || 'unreachable';

    return {
      blocked: true,
      result: formatStatus('BLOCK', `target ${targetUrl}`, reason),
    };
  }
}

function runChildGateCheck({ label, script }) {
  const absoluteScript = path.resolve(process.cwd(), script);
  if (!fs.existsSync(absoluteScript)) {
    return {
      blocked: true,
      results: [formatStatus('BLOCK', label, `missing script ${script}`)],
    };
  }

  const result = spawnSync(process.execPath, [absoluteScript], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  const stdoutLines = summarizeChildOutput(result.stdout);
  const stderrLines = summarizeChildOutput(result.stderr);
  const artifactLine = findFirstMatchingLine(result.stdout, /^artifact-(json|md):\s+/i)
    || findFirstMatchingLine(result.stdout, /^(Artifact|Report):\s+/i)
    || findFirstMatchingLine(result.stderr, /^artifact-(json|md):\s+/i)
    || findFirstMatchingLine(result.stderr, /^(Artifact|Report):\s+/i);
  const diagnosticLine = findFirstMatchingLine(result.stdout, /^(BLOCK|PASS):\s+/i)
    || findFirstMatchingLine(result.stderr, /^(BLOCK|PASS):\s+/i)
    || [...stdoutLines, ...stderrLines].find((line) => /^(BLOCK|PASS):\s+/i.test(line));
  const detail = [artifactLine, diagnosticLine, result.error?.message]
    .filter(Boolean)
    .join(' | ');
  const exitCode = typeof result.status === 'number' ? result.status : 1;

  return {
    blocked: exitCode !== 0,
    results: [formatStatus(exitCode === 0 ? 'PASS' : 'BLOCK', label, detail || `exit ${exitCode}`)],
  };
}

async function run() {
  const lines = [];
  let blocked = false;
  const manualStripeEvidence = checkManualStripeEvidence();
  const manualActivationRetentionEvidence = readVerifiedEvidenceArtifact(
    MANUAL_ACTIVATION_RETENTION_EVIDENCE_RELATIVE_PATH,
    'activation retention manual evidence',
  );
  const existingTargetPerformanceEvidence = checkExistingTargetPerformanceEvidence();

  const envCheck = checkRequiredEnvVars({
    skipStripeEnvChecks: Boolean(manualStripeEvidence && !manualStripeEvidence.blocked),
  });
  lines.push(...envCheck.results);
  blocked = blocked || envCheck.blocked;

  const baselineCheck = checkPerformanceBaseline();
  lines.push(baselineCheck.result);
  blocked = blocked || baselineCheck.blocked;

  const targetCheck = await checkLaunchTargetUrl();
  lines.push(targetCheck.result);
  blocked = blocked || targetCheck.blocked;

  for (const childCheck of CHILD_GATE_CHECKS) {
    if (childCheck.script === 'scripts/check-target-performance-evidence.mjs' && existingTargetPerformanceEvidence) {
      lines.push(...existingTargetPerformanceEvidence.results);
      blocked = blocked || existingTargetPerformanceEvidence.blocked;
      continue;
    }

    if (childCheck.script === 'scripts/check-stripe-live-smoke.mjs') {
      if (manualStripeEvidence) {
        lines.push(...manualStripeEvidence.results);
        blocked = blocked || manualStripeEvidence.blocked;
        continue;
      }
    }

    if (childCheck.script === 'scripts/check-activation-retention-evidence.mjs') {
      if (manualActivationRetentionEvidence) {
        lines.push(...manualActivationRetentionEvidence.results);
        blocked = blocked || manualActivationRetentionEvidence.blocked;
        continue;
      }
    }

    const childResult = runChildGateCheck(childCheck);
    lines.push(...childResult.results);
    blocked = blocked || childResult.blocked;
  }

  process.stdout.write('Flow Finance - Public Launch Gates\n');
  process.stdout.write('===================================\n');
  process.stdout.write('This checker is local and non-destructive; it is not production proof.\n');
  process.stdout.write('It also aggregates the explicit external-gate runners for Stripe and activation/retention evidence.\n');
  process.stdout.write('\n');

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(blocked
    ? 'BLOCK: public launch should stay gated until the failed checks are addressed.\n'
    : 'PASS: remaining public-launch gates are satisfied locally.\n');

  process.exit(blocked ? 1 : 0);
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    process.stderr.write(`${formatStatus('BLOCK', 'script', error?.message || 'unexpected failure')}\n`);
    process.exit(1);
  });
}
