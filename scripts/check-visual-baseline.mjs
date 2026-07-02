#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Visual baseline contract runner';
const DEFAULT_BASELINE = 'docs/visual-baselines/core-readiness.json';
const DEFAULT_VISUAL_ROOT = 'test-results/visual-regression';
const DEFAULT_OUTPUT_ROOT = 'test-results/visual-baseline';

function safeTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(filePath) {
  return normalizeSlashes(path.relative(process.cwd(), filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    baseline: DEFAULT_BASELINE,
    manifest: '',
    outputRoot: DEFAULT_OUTPUT_ROOT,
    strictHash: false,
  };

  for (const arg of argv) {
    if (arg === '--strict-hash') {
      args.strictHash = true;
    } else if (arg.startsWith('--baseline=')) {
      args.baseline = arg.slice('--baseline='.length);
    } else if (arg.startsWith('--manifest=')) {
      args.manifest = arg.slice('--manifest='.length);
    } else if (arg.startsWith('--output-root=')) {
      args.outputRoot = arg.slice('--output-root='.length);
    } else if (arg === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function captureKey(capture) {
  return `${capture.captureType}:${capture.tab || capture.routeState}:${capture.viewport}`;
}

function manifestCaptures(manifest) {
  return [
    ...(Array.isArray(manifest.tabCaptures) ? manifest.tabCaptures : []),
    ...(Array.isArray(manifest.routeStateCaptures) ? manifest.routeStateCaptures : []),
  ];
}

function scoreManifestCompleteness(manifest) {
  const summary = manifest?.summary && typeof manifest.summary === 'object' ? manifest.summary : {};
  return {
    screenshots: Number(summary.screenshots || 0),
    routeStateScreenshots: Number(summary.routeStateScreenshots || 0),
    routes: Number(summary.routes || 0),
    routeStates: Number(summary.routeStates || 0),
  };
}

function compareManifestCandidates(left, right) {
  for (const field of ['screenshots', 'routeStateScreenshots', 'routes', 'routeStates']) {
    if (left.score[field] !== right.score[field]) return left.score[field] - right.score[field];
  }
  return left.name.localeCompare(right.name);
}

function findLatestManifest(root = DEFAULT_VISUAL_ROOT) {
  const absoluteRoot = path.resolve(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return '';

  const candidates = fs.readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(absoluteRoot, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return null;
      try {
        return {
          name: entry.name,
          path: manifestPath,
          score: scoreManifestCompleteness(readJson(manifestPath)),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return candidates.sort(compareManifestCandidates).at(-1)?.path || '';
}

function pushIssue(issues, severity, code, message, evidence = {}) {
  issues.push({ severity, code, message, evidence });
}

function evaluateVisualBaseline({ baseline, manifest, strictHash = false }) {
  const issues = [];
  const warnings = [];
  const policy = baseline.policy || {};
  const summaryPolicy = baseline.expectedSummary || {};
  const summary = manifest.summary || {};
  const captures = new Map(manifestCaptures(manifest).map((capture) => [captureKey(capture), capture]));

  if (Number(summary.screenshots || 0) < Number(summaryPolicy.minScreenshots || 0)) {
    pushIssue(issues, 'BLOCK', 'summary.screenshots', 'Visual manifest has fewer screenshots than the baseline requires.', {
      actual: summary.screenshots || 0,
      expectedMinimum: summaryPolicy.minScreenshots || 0,
    });
  }

  if (Number(summary.routes || 0) < Number(summaryPolicy.minRoutes || 0)) {
    pushIssue(issues, 'BLOCK', 'summary.routes', 'Visual manifest has fewer routes than the baseline requires.', {
      actual: summary.routes || 0,
      expectedMinimum: summaryPolicy.minRoutes || 0,
    });
  }

  if (Number(summary.viewportCount || 0) < Number(summaryPolicy.minViewportCount || 0)) {
    pushIssue(issues, 'BLOCK', 'summary.viewportCount', 'Visual manifest has fewer viewports than the baseline requires.', {
      actual: summary.viewportCount || 0,
      expectedMinimum: summaryPolicy.minViewportCount || 0,
    });
  }

  if (policy.blockOnConsoleIssues && Number(summary.consoleIssues || 0) > Number(summaryPolicy.maxConsoleIssues || 0)) {
    pushIssue(issues, 'BLOCK', 'summary.consoleIssues', 'Visual run reported console issues.', {
      actual: summary.consoleIssues || 0,
      allowed: summaryPolicy.maxConsoleIssues || 0,
    });
  }

  if (policy.blockOnPageErrors && Number(summary.pageErrors || 0) > Number(summaryPolicy.maxPageErrors || 0)) {
    pushIssue(issues, 'BLOCK', 'summary.pageErrors', 'Visual run reported page errors.', {
      actual: summary.pageErrors || 0,
      allowed: summaryPolicy.maxPageErrors || 0,
    });
  }

  for (const expected of baseline.captures || []) {
    const actual = captures.get(expected.key);
    if (!actual) {
      pushIssue(issues, 'BLOCK', 'capture.missing', `Expected visual capture missing: ${expected.key}`, expected);
      continue;
    }

    if (policy.blockOnViewportMismatch && (actual.width !== expected.width || actual.height !== expected.height)) {
      pushIssue(issues, 'BLOCK', 'capture.viewport', `Viewport mismatch for ${expected.key}.`, {
        actual: { width: actual.width, height: actual.height },
        expected: { width: expected.width, height: expected.height },
      });
    }

    if (policy.blockOnResponseStatusMismatch && actual.responseStatus !== expected.responseStatus) {
      pushIssue(issues, 'BLOCK', 'capture.responseStatus', `Response status mismatch for ${expected.key}.`, {
        actual: actual.responseStatus,
        expected: expected.responseStatus,
      });
    }

    const screenshotSize = Number(actual.screenshot?.size || 0);
    if (policy.blockOnScreenshotTooSmall && screenshotSize < Number(expected.minScreenshotBytes || 0)) {
      pushIssue(issues, 'BLOCK', 'capture.screenshotSize', `Screenshot is smaller than the baseline floor for ${expected.key}.`, {
        actual: screenshotSize,
        expectedMinimum: expected.minScreenshotBytes,
      });
    }

    const actualHash = actual.screenshot?.sha256 || '';
    if (actualHash && expected.referenceSha256 && actualHash !== expected.referenceSha256) {
      const item = {
        severity: strictHash || policy.blockOnHashChange ? 'BLOCK' : 'WARN',
        code: 'capture.sha256',
        message: `Screenshot hash changed for ${expected.key}.`,
        evidence: {
          actual: actualHash,
          expected: expected.referenceSha256,
        },
      };
      if (item.severity === 'BLOCK') issues.push(item);
      else warnings.push(item);
    }
  }

  const status = issues.length === 0 ? 'PASS' : 'BLOCK';
  return {
    runnerName: RUNNER_NAME,
    status,
    summary: status === 'PASS'
      ? 'PASS: visual manifest satisfies the committed coverage baseline.'
      : 'BLOCK: visual manifest violates the committed coverage baseline.',
    issues,
    warnings,
    baselineName: baseline.name || '',
    manifestRunId: manifest.runId || '',
    manifestSummary: summary,
  };
}

function buildMarkdown(report) {
  const lines = [
    `# ${RUNNER_NAME}`,
    '',
    `Status: ${report.status}`,
    '',
    report.summary,
    '',
    `Baseline: ${report.baselinePath}`,
    `Manifest: ${report.manifestPath}`,
    '',
    '## Issues',
    '',
  ];

  if (report.issues.length === 0) {
    lines.push('- None.');
  } else {
    for (const issue of report.issues) {
      lines.push(`- ${issue.code}: ${issue.message}`);
    }
  }

  lines.push('', '## Warnings', '');
  if (report.warnings.length === 0) {
    lines.push('- None.');
  } else {
    for (const warning of report.warnings) {
      lines.push(`- ${warning.code}: ${warning.message}`);
    }
  }

  lines.push(
    '',
    '## Evidence boundary',
    '',
    'This runner proves visual coverage contract health for the captured manifest. It does not prove user preference, conversion lift, accessibility behavior, or real authenticated usage.'
  );

  return `${lines.join('\n')}\n`;
}

function printHelp() {
  process.stdout.write([
    'Flow Finance visual baseline contract runner',
    '',
    'Usage:',
    '  node scripts/check-visual-baseline.mjs',
    '  node scripts/check-visual-baseline.mjs --manifest=test-results/visual-regression/<run>/manifest.json',
    '  node scripts/check-visual-baseline.mjs --baseline=docs/visual-baselines/core-readiness.json',
    '  node scripts/check-visual-baseline.mjs --strict-hash',
    '',
  ].join('\n'));
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const baselinePath = path.resolve(process.cwd(), args.baseline);
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : findLatestManifest();

  if (!manifestPath) {
    throw new Error(`No visual regression manifest found under ${DEFAULT_VISUAL_ROOT}`);
  }

  const baseline = readJson(baselinePath);
  const manifest = readJson(manifestPath);
  const report = {
    ...evaluateVisualBaseline({ baseline, manifest, strictHash: args.strictHash }),
    timestamp: new Date().toISOString(),
    baselinePath: rel(baselinePath),
    manifestPath: rel(manifestPath),
  };

  const runId = safeTimestamp();
  const outputDir = path.resolve(process.cwd(), args.outputRoot, runId);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'report.md'), buildMarkdown(report), 'utf8');

  process.stdout.write(`${RUNNER_NAME}\n`);
  process.stdout.write(`${'='.repeat(RUNNER_NAME.length)}\n`);
  process.stdout.write(`Status: ${report.status}\n`);
  process.stdout.write(`Manifest: ${report.manifestPath}\n`);
  process.stdout.write(`Artifact: ${rel(path.join(outputDir, 'report.json'))}\n`);

  if (report.status !== 'PASS') {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`BLOCK: ${error?.message || 'unexpected failure'}\n`);
    process.exitCode = 1;
  });
}

export {
  captureKey,
  evaluateVisualBaseline,
  findLatestManifest,
  manifestCaptures,
  parseArgs,
};
