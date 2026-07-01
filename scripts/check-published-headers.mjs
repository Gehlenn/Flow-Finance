#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const backendUrl = (process.env.PUBLISHED_BACKEND_URL || 'https://flow-finance-backend.vercel.app').trim().replace(/\/$/, '');
const frontendUrl = (process.env.PUBLISHED_FRONTEND_URL || 'https://flow-finance-frontend-nine.vercel.app').trim().replace(/\/$/, '');
const strictMode = process.argv.includes('--strict') || process.env.PUBLISHED_HEADERS_STRICT === '1';
const outputDir = path.resolve(process.cwd(), 'test-results/published-headers');

const checks = [
  {
    name: 'backend-health',
    url: `${backendUrl}/health`,
    expectedStatus: 200,
    requiredHeaders: [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'x-request-id',
    ],
  },
  {
    name: 'backend-root',
    url: `${backendUrl}/`,
    expectedStatus: 404,
    requiredHeaders: [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'x-request-id',
    ],
  },
  {
    name: 'frontend-root',
    url: `${frontendUrl}/`,
    expectedStatus: 200,
    requiredHeaders: [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
    ],
    forbiddenCspTokens: {
      'script-src': [
        "'unsafe-inline'",
        'https://esm.sh',
      ],
      'style-src': [
        "'unsafe-inline'",
      ],
    },
  },
];

function normalizeHeaders(headers) {
  const snapshot = {};
  for (const [key, value] of headers.entries()) {
    snapshot[key.toLowerCase()] = value;
  }
  return snapshot;
}

function shortValue(value) {
  return String(value || '').slice(0, 160);
}

function parseCsp(value) {
  const directives = new Map();
  for (const part of String(value || '').split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

async function fetchHeadLike({ url }) {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    },
  });

  const body = response.status === 200 ? await response.text() : '';

  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    headers: normalizeHeaders(response.headers),
    bodySnippet: shortValue(body.replace(/\s+/g, ' ')),
  };
}

function assess(check, result) {
  const missing = check.requiredHeaders.filter((header) => !result.headers[header]);
  const csp = parseCsp(result.headers['content-security-policy']);
  const cspViolations = [];

  if (check.forbiddenCspTokens) {
    for (const [directive, forbiddenTokens] of Object.entries(check.forbiddenCspTokens)) {
      const sources = csp.get(directive.toLowerCase()) || [];
      for (const token of forbiddenTokens) {
        if (sources.includes(token)) {
          cspViolations.push(`${directive} includes ${token}`);
        }
      }
    }
  }

  const statusOk = result.status === check.expectedStatus;
  const passed = statusOk && cspViolations.length === 0 && (missing.length === 0 || !strictMode && check.name === 'frontend-root');

  return {
    name: check.name,
    url: check.url,
    expectedStatus: check.expectedStatus,
    status: result.status,
    contentType: result.contentType,
    missingHeaders: missing,
    cspViolations,
    headers: result.headers,
    bodySnippet: result.bodySnippet,
    passed,
  };
}

function safeTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function writeArtifact(output) {
  fs.mkdirSync(outputDir, { recursive: true });
  const runId = safeTimestamp();
  const jsonPath = path.join(outputDir, `${runId}.json`);
  const mdPath = path.join(outputDir, `${runId}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const lines = [
    '# Published headers evidence',
    '',
    `- status: ${output.status}`,
    `- strictMode: ${output.strictMode}`,
    `- backendUrl: ${output.backendUrl}`,
    `- frontendUrl: ${output.frontendUrl}`,
    '',
    '## Summary',
    '',
    ...output.summary.map((line) => `- ${line}`),
    '',
    '## Results',
    '',
    '| check | status | expected | missing headers |',
    '| --- | ---: | ---: | --- |',
    ...output.results.map((result) => (
      `| ${result.name} | ${result.status} | ${result.expectedStatus} | ${[...result.missingHeaders, ...result.cspViolations].length > 0 ? [...result.missingHeaders, ...result.cspViolations].join(', ') : 'none'} |`
    )),
    '',
  ];

  fs.writeFileSync(mdPath, `${lines.join('\n')}`, 'utf8');
  return {
    jsonPath,
    mdPath,
  };
}

async function main() {
  const results = [];

  for (const check of checks) {
    const result = await fetchHeadLike(check);
    results.push(assess(check, result));
  }

  const failed = results.filter((result) => !result.passed);
  const output = {
    status: failed.length === 0 ? 'PASS' : 'BLOCK',
    strictMode,
    backendUrl,
    frontendUrl,
    results,
    summary: failed.length === 0
      ? ['Headers publicados conferidos.']
      : failed.map((result) => {
        if (result.missingHeaders.length > 0) {
          return `${result.name} ausente(s): ${result.missingHeaders.join(', ')}`;
        }
        if (result.cspViolations.length > 0) {
          return `${result.name} CSP fraca: ${result.cspViolations.join(', ')}`;
        }
        return `${result.name} retornou HTTP ${result.status} em vez de ${result.expectedStatus}`;
      }),
  };

  const artifact = writeArtifact(output);
  output.artifact = {
    json: path.relative(process.cwd(), artifact.jsonPath),
    md: path.relative(process.cwd(), artifact.mdPath),
  };
  fs.writeFileSync(artifact.jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    strictMode,
    backendUrl,
    frontendUrl,
    error: error.message,
  }, null, 2)}\n`);
  process.exit(1);
});
