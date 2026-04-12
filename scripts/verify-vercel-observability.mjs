#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const argBaseUrl = process.argv[2];
const baseUrl = (argBaseUrl || process.env.VERCEL_TARGET_URL || '').trim().replace(/\/$/, '');

function usage() {
  console.error('Uso:');
  console.error('  node scripts/verify-vercel-observability.mjs https://preview-url.vercel.app');
  console.error('  ou');
  console.error('  VERCEL_TARGET_URL=https://preview-url.vercel.app npm run health:vercel');
  process.exit(1);
}

if (!baseUrl) {
  usage();
}

const checks = [
  { path: '/', label: 'root', expectJson: false },
  { path: '/health', label: 'health', expectJson: true },
  { path: '/api/health', label: 'apiHealth', expectJson: true },
  { path: '/api/version', label: 'apiVersion', expectJson: true },
];

function summarizeBody(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

async function fetchCheck({ path, label, expectJson }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Accept: expectJson ? 'application/json,text/plain;q=0.8,*/*;q=0.5' : 'text/html,*/*',
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const location = response.headers.get('location') || '';
  const raw = await response.text();

  let json = null;
  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }

  return {
    label,
    path,
    expectJson,
    status: response.status,
    ok: response.ok,
    contentType,
    location,
    json,
    bodySnippet: summarizeBody(raw),
  };
}

function hasBlockedByVercelAuth(results) {
  const blockedStatuses = new Set([401, 403]);
  const blockedCount = results.filter((result) => blockedStatuses.has(result.status)).length;
  const redirectedToLogin = results.some((result) =>
    result.status >= 300 &&
    result.status < 400 &&
    /vercel|login|auth/i.test(result.location),
  );
  return blockedCount >= 3 || redirectedToLogin;
}

function assertHealthContract(result) {
  if (!result.json || typeof result.json !== 'object') {
    throw new Error(`${result.path}: resposta sem JSON valido`);
  }

  if (!result.json.requestId || !result.json.routeScope) {
    throw new Error(`${result.path}: contrato sem requestId/routeScope`);
  }

  if (result.path === '/health') {
    const observability = result.json.checks?.observability;
    if (!observability || typeof observability.configured !== 'boolean') {
      throw new Error('/health: checks.observability ausente ou invalido');
    }
  }

  if (result.path === '/api/health') {
    const sentryConfigured = result.json.observability?.sentryConfigured;
    if (typeof sentryConfigured !== 'boolean') {
      throw new Error('/api/health: observability.sentryConfigured ausente ou invalido');
    }
  }
}

export function isExpectedApiRoot404(result) {
  if (!result || result.path !== '/' || result.status !== 404) {
    return false;
  }

  const message = result.json?.message;
  return (
    typeof result.json?.requestId === 'string' &&
    typeof result.json?.routeScope === 'string' &&
    typeof message === 'string' &&
    /Route GET \/ does not exist/i.test(message)
  );
}

export function isFailedCheck(result) {
  if (result.path === '/') {
    return result.status >= 400 && !isExpectedApiRoot404(result);
  }

  return result.status !== 200;
}

async function run() {
  const results = [];
  for (const check of checks) {
    results.push(await fetchCheck(check));
  }

  const blockedByAuth = hasBlockedByVercelAuth(results);
  const output = {
    baseUrl,
    blockedByVercelAuth: blockedByAuth,
    results,
  };

  if (blockedByAuth) {
    output.summary = [
      'Deploy protegido por Vercel Authentication antes da aplicacao responder.',
      'Liberar acesso temporario ao preview ou validar com URL compartilhada.',
      'Depois repetir a checagem para confirmar /health, /api/health e /api/version.',
    ];
    console.error(JSON.stringify(output, null, 2));
    process.exit(2);
  }

  for (const result of results.filter((item) => item.expectJson !== false && item.status === 200)) {
    assertHealthContract(result);
  }

  const failed = results.filter(isFailedCheck);

  if (failed.length > 0) {
    output.summary = failed.map((result) => `${result.path} retornou HTTP ${result.status}`);
    console.error(JSON.stringify(output, null, 2));
    process.exit(1);
  }

  const rootResult = results.find((result) => result.path === '/');
  const apiOnlyRoot404 = Boolean(rootResult && isExpectedApiRoot404(rootResult));
  output.summary = [
    'Deploy acessivel.',
    'Contratos de /health, /api/health e /api/version confirmados.',
  ];

  if (apiOnlyRoot404) {
    output.summary.push('GET / retornou 404 esperado para backend API-only.');
  }

  console.log(JSON.stringify(output, null, 2));
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    console.error(JSON.stringify({
      baseUrl,
      error: error.message,
    }, null, 2));
    process.exit(1);
  });
}
