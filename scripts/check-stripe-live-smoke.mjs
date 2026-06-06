#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GATE_NAME = 'Stripe real smoke';
const RUNNER_NAME = 'Stripe live smoke runner';
const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results/stripe-live-smoke');

const REQUIRED_TARGET_ENV_VARS = [
  'STRIPE_LIVE_SMOKE_BACKEND_URL',
  'STRIPE_LIVE_SMOKE_RETURN_URL',
  'STRIPE_LIVE_SMOKE_WORKSPACE_ID',
];

const OPTIONAL_ALIAS_ENV_VARS = {
  STRIPE_LIVE_SMOKE_BACKEND_URL: ['FLOW_LAUNCH_TARGET_URL', 'VERCEL_TARGET_URL'],
};

const AUDIT_ENV_VARS = [
  ...REQUIRED_TARGET_ENV_VARS,
  'STRIPE_LIVE_SMOKE_BEARER_TOKEN',
  'STRIPE_LIVE_SMOKE_COOKIE_HEADER',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PRO_MONTHLY',
  'STRIPE_WEBHOOK_SECRET',
  'FLOW_LAUNCH_TARGET_URL',
  'VERCEL_TARGET_URL',
];

const FETCH_TIMEOUT_MS = 15000;
const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
];

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function maskGeneric(value) {
  if (!value) {
    return 'absent';
  }

  if (value.length <= 8) {
    return `${value[0]}***${value.at(-1) || ''}`;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalizeCookieHeader(value) {
  return String(value || '')
    .replace(/^cookie\s*:\s*/i, '')
    .trim();
}

function maskCookieHeader(value) {
  const normalized = normalizeCookieHeader(value);
  if (!normalized) {
    return 'absent';
  }

  const maskedPairs = normalized
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex === -1) {
        return `${pair}=***`;
      }

      const name = pair.slice(0, separatorIndex).trim();
      return name ? `${name}=***` : '***';
    });

  return maskedPairs.length > 0 ? maskedPairs.join('; ') : 'absent';
}

function maskUrl(value) {
  if (!value) {
    return 'absent';
  }

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return maskGeneric(value);
  }
}

function maskEnvValue(name, value) {
  if (!value) {
    return { present: false, masked: 'absent' };
  }

  if (name.includes('COOKIE_HEADER')) {
    return { present: true, masked: maskCookieHeader(value) };
  }

  if (name.includes('URL')) {
    return { present: true, masked: maskUrl(value) };
  }

  if (name.includes('TOKEN') || name.includes('SECRET') || name.includes('KEY')) {
    return { present: true, masked: maskGeneric(value) };
  }

  return { present: true, masked: maskGeneric(value) };
}

function pickFirstEnv(name, aliases = []) {
  const primary = readStringEnv(name);
  if (primary) {
    return { name, value: primary, source: name };
  }

  for (const alias of aliases) {
    const aliasValue = readStringEnv(alias);
    if (aliasValue) {
      return { name, value: aliasValue, source: alias };
    }
  }

  return { name, value: '', source: null };
}

function summarizeBody(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

function createStep(name, status, detail, extra = {}) {
  return {
    name,
    status,
    detail,
    ...extra,
  };
}

function buildEnvSnapshot() {
  return Object.fromEntries(
    AUDIT_ENV_VARS.map((name) => {
      const raw = readStringEnv(name);
      return [name, maskEnvValue(name, raw)];
    }),
  );
}

function resolveTargetBackendUrl() {
  return pickFirstEnv(
    'STRIPE_LIVE_SMOKE_BACKEND_URL',
    OPTIONAL_ALIAS_ENV_VARS.STRIPE_LIVE_SMOKE_BACKEND_URL,
  );
}

function resolveAuthContext() {
  const bearerToken = readStringEnv('STRIPE_LIVE_SMOKE_BEARER_TOKEN');
  if (bearerToken) {
    return {
      mode: 'bearer',
      source: 'STRIPE_LIVE_SMOKE_BEARER_TOKEN',
      value: bearerToken,
      masked: maskGeneric(bearerToken),
    };
  }

  const cookieHeader = normalizeCookieHeader(readStringEnv('STRIPE_LIVE_SMOKE_COOKIE_HEADER'));
  if (cookieHeader) {
    return {
      mode: 'cookie',
      source: 'STRIPE_LIVE_SMOKE_COOKIE_HEADER',
      value: cookieHeader,
      masked: maskCookieHeader(cookieHeader),
    };
  }

  return {
    mode: null,
    source: null,
    value: '',
    masked: 'absent',
  };
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeArtifact(baseName, payload) {
  ensureOutputDir();
  const jsonPath = path.join(OUTPUT_DIR, `${baseName}.json`);
  const mdPath = path.join(OUTPUT_DIR, `${baseName}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const mdLines = [
    `# ${GATE_NAME} evidence`,
    '',
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    `- artifact: ${path.relative(process.cwd(), jsonPath)}`,
    '',
    '## Environment snapshot',
    '',
    '| env | present | masked | source |',
    '| --- | --- | --- | --- |',
  ];

  for (const [name, env] of Object.entries(payload.environment)) {
    mdLines.push(`| \`${name}\` | ${env.present ? 'yes' : 'no'} | ${env.masked} | ${payload.environmentSources?.[name] || name} |`);
  }

  mdLines.push(
    '',
    '## Steps',
    '',
    '| step | status | detail |',
    '| --- | --- | --- |',
  );

  for (const step of payload.steps) {
    mdLines.push(`| ${step.name} | ${step.status} | ${step.detail || ''} |`);
  }

  mdLines.push('', '## Result', '', '```json', JSON.stringify(payload.result, null, 2), '```', '');

  fs.writeFileSync(mdPath, `${mdLines.join('\n')}`, 'utf8');

  return { jsonPath, mdPath };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('request timed out')), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function attemptCheckoutSession(targetUrl, authContext, workspaceId, returnUrl) {
  const endpoint = new URL('/api/saas/stripe/checkout-session', targetUrl);
  const headers = {
    Accept: 'application/json,text/plain;q=0.8,*/*;q=0.5',
    'Content-Type': 'application/json',
    'x-workspace-id': workspaceId,
  };

  if (authContext.mode === 'bearer') {
    headers.Authorization = `Bearer ${authContext.value}`;
  } else if (authContext.mode === 'cookie') {
    headers.Cookie = authContext.value;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    redirect: 'manual',
    headers,
    body: JSON.stringify({ returnUrl }),
  });

  const contentType = response.headers.get('content-type') || '';
  const location = response.headers.get('location') || '';
  const rawBody = await response.text();
  let json = null;

  if (contentType.includes('application/json')) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = null;
    }
  }

  return {
    endpoint: endpoint.toString(),
    status: response.status,
    ok: response.ok,
    contentType,
    location,
    rawBody,
    json,
  };
}

async function inspectStripeWebhookConfig(targetUrl) {
  const secretKey = readStringEnv('STRIPE_SECRET_KEY');
  if (!secretKey) {
    return { skipped: true, reason: 'STRIPE_SECRET_KEY ausente' };
  }

  const expectedUrl = new URL('/api/saas/stripe/webhook', targetUrl).toString();
  const response = await fetchWithTimeout('https://api.stripe.com/v1/webhook_endpoints', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const rawBody = await response.text();
  let json = null;

  try {
    json = JSON.parse(rawBody);
  } catch {
    json = null;
  }

  if (!response.ok) {
    return {
      skipped: false,
      ok: false,
      expectedUrl,
      status: response.status,
      rawBody,
      json,
      match: null,
    };
  }

  const endpoints = Array.isArray(json?.data) ? json.data : [];
  const match = endpoints.find((endpoint) => endpoint?.url === expectedUrl) || null;
  const enabledEvents = Array.isArray(match?.enabled_events) ? match.enabled_events : [];
  const missingEvents = REQUIRED_WEBHOOK_EVENTS.filter((eventName) => !enabledEvents.includes(eventName));

  return {
    skipped: false,
    ok: Boolean(match) && missingEvents.length === 0,
    expectedUrl,
    status: response.status,
    rawBody,
    json,
    match: match
      ? {
        id: match.id,
        url: match.url,
        status: match.status,
        enabled_events: enabledEvents,
      }
      : null,
    missingEvents,
  };
}

function summarizeAttempt(attempt) {
  const parts = [`HTTP ${attempt.status}`];

  if (attempt.contentType) {
    parts.push(`content-type=${attempt.contentType}`);
  }

  if (attempt.location) {
    parts.push(`location=${attempt.location}`);
  }

  if (attempt.json && typeof attempt.json === 'object') {
    const id = typeof attempt.json.id === 'string' ? attempt.json.id : '';
    const url = typeof attempt.json.url === 'string' ? attempt.json.url : '';
    if (id) {
      parts.push(`session.id=${id}`);
    }
    if (url) {
      parts.push(`session.url=${url}`);
    }
  } else {
    const body = summarizeBody(attempt.rawBody);
    if (body) {
      parts.push(`body=${body}`);
    }
  }

  return parts.join(' | ');
}

async function run() {
  const timestamp = formatTimestamp();
  const envSnapshot = buildEnvSnapshot();
  const backendTarget = resolveTargetBackendUrl();
  const returnUrl = readStringEnv('STRIPE_LIVE_SMOKE_RETURN_URL');
  const authContext = resolveAuthContext();
  const workspaceId = readStringEnv('STRIPE_LIVE_SMOKE_WORKSPACE_ID');

  const environmentSources = {
    STRIPE_LIVE_SMOKE_BACKEND_URL: backendTarget.source || 'unset',
    STRIPE_LIVE_SMOKE_RETURN_URL: 'STRIPE_LIVE_SMOKE_RETURN_URL',
    STRIPE_LIVE_SMOKE_BEARER_TOKEN: authContext.mode === 'bearer' ? authContext.source : 'unset',
    STRIPE_LIVE_SMOKE_COOKIE_HEADER: authContext.mode === 'cookie' ? authContext.source : 'unset',
    STRIPE_LIVE_SMOKE_WORKSPACE_ID: 'STRIPE_LIVE_SMOKE_WORKSPACE_ID',
  };

  const steps = [];
  const blockReasons = [];
  let attemptedCheckout = null;

  steps.push(createStep(
    'inspect_environment',
    'PASS',
    'snapshot criado com valores mascarados e fontes registradas',
    { evidence: Object.keys(envSnapshot) },
  ));

  if (backendTarget.value) {
    steps.push(createStep(
      'resolve_backend_target',
      'PASS',
      `backend alvo resolvido via ${backendTarget.source}`,
      { target: backendTarget.value, source: backendTarget.source },
    ));
  } else {
    steps.push(createStep(
      'resolve_backend_target',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltou URL de backend alvo (STRIPE_LIVE_SMOKE_BACKEND_URL, FLOW_LAUNCH_TARGET_URL ou VERCEL_TARGET_URL)',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltou URL de backend alvo');
  }

  if (!returnUrl) {
    steps.push(createStep(
      'check_return_url',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_RETURN_URL',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_RETURN_URL');
  } else {
    steps.push(createStep(
      'check_return_url',
      'PASS',
      maskUrl(returnUrl),
    ));
  }

  if (authContext.mode === 'bearer' || authContext.mode === 'cookie') {
    steps.push(createStep(
      'check_auth_context',
      'PASS',
      `${authContext.mode === 'bearer' ? 'Authorization Bearer' : 'Cookie header'} via ${authContext.source} (${authContext.masked})`,
    ));
  } else {
    steps.push(createStep(
      'check_auth_context',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_BEARER_TOKEN ou STRIPE_LIVE_SMOKE_COOKIE_HEADER',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_BEARER_TOKEN ou STRIPE_LIVE_SMOKE_COOKIE_HEADER');
  }

  if (!workspaceId) {
    steps.push(createStep(
      'check_workspace_id',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_WORKSPACE_ID',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltou STRIPE_LIVE_SMOKE_WORKSPACE_ID');
  } else {
    steps.push(createStep(
      'check_workspace_id',
      'PASS',
      maskGeneric(workspaceId),
    ));
  }

  if (backendTarget.value) {
    try {
      const webhookConfig = await inspectStripeWebhookConfig(backendTarget.value);
      if (webhookConfig.skipped) {
        steps.push(createStep(
          'check_webhook_endpoint_config',
          'BLOCK',
          `SEM EVIDENCIA SUFICIENTE: ${webhookConfig.reason}`,
        ));
        blockReasons.push(`SEM EVIDENCIA SUFICIENTE: ${webhookConfig.reason}`);
      } else if (!webhookConfig.ok) {
        const missingEvents = webhookConfig.missingEvents?.length
          ? `; missing_events=${webhookConfig.missingEvents.join(',')}`
          : '';
        const endpointId = webhookConfig.match?.id ? `endpoint=${webhookConfig.match.id}; ` : '';
        steps.push(createStep(
          'check_webhook_endpoint_config',
          'BLOCK',
          `BLOCK: endpoint Stripe incompatível com o backend alvo; expected_url=${webhookConfig.expectedUrl}; ${endpointId}status=${webhookConfig.status}${missingEvents}`,
          {
            expectedUrl: webhookConfig.expectedUrl,
            endpoint: webhookConfig.match,
          },
        ));
        blockReasons.push('BLOCK: endpoint Stripe incompatível com o backend alvo');
      } else {
        steps.push(createStep(
          'check_webhook_endpoint_config',
          'PASS',
          `endpoint ${webhookConfig.match.id} alinhado com ${webhookConfig.expectedUrl}`,
          {
            expectedUrl: webhookConfig.expectedUrl,
            endpoint: webhookConfig.match,
          },
        ));
      }
    } catch (error) {
      const reason = error?.name === 'AbortError'
        ? `request timed out after ${FETCH_TIMEOUT_MS}ms`
        : error?.message || 'unexpected webhook endpoint inspection failure';
      steps.push(createStep(
        'check_webhook_endpoint_config',
        'BLOCK',
        `BLOCK: nao foi possivel inspecionar o endpoint Stripe: ${reason}`,
      ));
      blockReasons.push(`BLOCK: nao foi possivel inspecionar o endpoint Stripe: ${reason}`);
    }
  } else {
    steps.push(createStep(
      'check_webhook_endpoint_config',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltou backend alvo para conferir endpoint Stripe',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltou backend alvo para conferir endpoint Stripe');
  }

  if (backendTarget.value && returnUrl && authContext.mode && workspaceId) {
    try {
      attemptedCheckout = await attemptCheckoutSession(backendTarget.value, authContext, workspaceId, returnUrl);
      const sessionUrl = attemptedCheckout.json && typeof attemptedCheckout.json.url === 'string'
        ? attemptedCheckout.json.url
        : '';

      if (!attemptedCheckout.ok) {
        const responseDetail = summarizeAttempt(attemptedCheckout);
        const reason = attemptedCheckout.status === 503
          ? 'SEM EVIDENCIA SUFICIENTE: backend alvo recusou o checkout por configuracao Stripe ausente'
          : 'SEM EVIDENCIA SUFICIENTE: o backend alvo nao comprovou checkout real';
        steps.push(createStep('attempt_checkout_session', 'BLOCK', `${reason}; ${responseDetail}`, {
          endpoint: attemptedCheckout.endpoint,
          response: {
            status: attemptedCheckout.status,
            contentType: attemptedCheckout.contentType,
            location: attemptedCheckout.location,
            body: summarizeBody(attemptedCheckout.rawBody),
            json: attemptedCheckout.json,
          },
        }));
        blockReasons.push(`${reason}; ${responseDetail}`);
      } else if (!sessionUrl) {
        const responseDetail = summarizeAttempt(attemptedCheckout);
        steps.push(createStep(
          'attempt_checkout_session',
          'BLOCK',
          `SEM EVIDENCIA SUFICIENTE: checkout-session retornou 200 sem url; ${responseDetail}`,
          {
            endpoint: attemptedCheckout.endpoint,
            response: {
              status: attemptedCheckout.status,
              contentType: attemptedCheckout.contentType,
              location: attemptedCheckout.location,
              body: summarizeBody(attemptedCheckout.rawBody),
              json: attemptedCheckout.json,
            },
          },
        ));
        blockReasons.push('SEM EVIDENCIA SUFICIENTE: checkout-session retornou 200 sem url');
      } else {
        steps.push(createStep(
          'attempt_checkout_session',
          'PASS',
          `checkout session criada com url ${sessionUrl}`,
          {
            endpoint: attemptedCheckout.endpoint,
            session: attemptedCheckout.json,
          },
        ));
        blockReasons.push('SEM EVIDENCIA SUFICIENTE: checkout session criada, mas webhook receipt, plan change e portal open ainda nao foram comprovados pelo runner');
      }
    } catch (error) {
      const reason = error?.name === 'AbortError'
        ? `request timed out after ${FETCH_TIMEOUT_MS}ms`
        : error?.message || 'unexpected failure while attempting checkout session';
      steps.push(createStep(
        'attempt_checkout_session',
        'BLOCK',
        `BLOCK: nao foi possivel comprovar checkout real no backend alvo: ${reason}`,
      ));
      blockReasons.push(`BLOCK: nao foi possivel comprovar checkout real no backend alvo: ${reason}`);
    }
  } else {
    steps.push(createStep(
      'attempt_checkout_session',
      'BLOCK',
      'SEM EVIDENCIA SUFICIENTE: faltam backend alvo, returnUrl, auth bearer/cookie ou workspaceId para tentar checkout real',
    ));
    blockReasons.push('SEM EVIDENCIA SUFICIENTE: faltam backend alvo, returnUrl, auth bearer/cookie ou workspaceId para tentar checkout real');
  }

  const result = {
    gate: GATE_NAME,
    runner: RUNNER_NAME,
    timestamp,
    result: {
      status: 'BLOCK',
      summary: blockReasons.length > 0
        ? blockReasons[0]
        : 'SEM EVIDENCIA SUFICIENTE: o runner nao recebeu prova suficiente para fechar o gate',
    },
    environment: envSnapshot,
    environmentSources,
    target: {
      backendUrl: backendTarget.value ? backendTarget.value : null,
      backendUrlSource: backendTarget.source,
      returnUrl: returnUrl || null,
      authMode: authContext.mode,
      authSource: authContext.source,
      workspaceId: workspaceId ? maskGeneric(workspaceId) : null,
    },
    steps,
    attempt: attemptedCheckout ? {
      endpoint: attemptedCheckout.endpoint,
      status: attemptedCheckout.status,
      ok: attemptedCheckout.ok,
      contentType: attemptedCheckout.contentType,
      location: attemptedCheckout.location,
      body: summarizeBody(attemptedCheckout.rawBody),
      json: attemptedCheckout.json,
    } : null,
    blockReasons,
  };

  const artifactBaseName = timestamp;
  const artifactPaths = writeArtifact(artifactBaseName, result);

  process.stdout.write(`\n${GATE_NAME}\n`);
  process.stdout.write(`${'='.repeat(GATE_NAME.length)}\n`);
  for (const step of steps) {
    process.stdout.write(`${step.status} ${step.name} - ${step.detail || ''}\n`);
  }
  process.stdout.write('\n');
  process.stdout.write(`BLOCK: ${result.result.summary}\n`);
  process.stdout.write(`artifact-json: ${path.relative(process.cwd(), artifactPaths.jsonPath)}\n`);
  process.stdout.write(`artifact-md: ${path.relative(process.cwd(), artifactPaths.mdPath)}\n`);

  process.exit(1);
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    const timestamp = formatTimestamp();
    ensureOutputDir();
    const crashArtifact = {
      gate: GATE_NAME,
      runner: RUNNER_NAME,
      timestamp,
      result: {
        status: 'BLOCK',
        summary: error?.message || 'unexpected failure',
      },
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'unexpected failure',
        stack: error?.stack || '',
      },
    };

    const crashBaseName = `${timestamp}-crash`;
    const crashJsonPath = path.join(OUTPUT_DIR, `${crashBaseName}.json`);
    fs.writeFileSync(crashJsonPath, `${JSON.stringify(crashArtifact, null, 2)}\n`, 'utf8');
    process.stderr.write(`BLOCK script - ${error?.message || 'unexpected failure'}\n`);
    process.stderr.write(`artifact-json: ${path.relative(process.cwd(), crashJsonPath)}\n`);
    process.exit(1);
  });
}
