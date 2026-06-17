#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RUNNER_NAME = 'Scale readiness evidence runner';
const GATE_NAME = 'Scale readiness';
const OUTPUT_DIR = path.resolve(process.cwd(), 'test-results/scale-readiness-evidence');
const TARGET_URL_ENV_VARS = ['FLOW_LAUNCH_TARGET_URL', 'VERCEL_TARGET_URL'];
const DEFAULT_TARGET_URL = 'https://flow-finance-frontend-nine.vercel.app';
const BACKEND_URL_ENV_VARS = [
  'SCALE_READINESS_BACKEND_URL',
  'STRIPE_LIVE_SMOKE_BACKEND_URL',
  'ACTIVATION_RETENTION_EXPORT_BACKEND_URL',
  'FLOW_LAUNCH_TARGET_URL',
  'VERCEL_TARGET_URL',
];
const WORKSPACE_ID_ENV_VARS = [
  'SCALE_READINESS_WORKSPACE_ID',
  'STRIPE_LIVE_SMOKE_WORKSPACE_ID',
  'ACTIVATION_RETENTION_EXPORT_WORKSPACE_ID',
];
const BEARER_ENV_VARS = [
  'SCALE_READINESS_BEARER_TOKEN',
  'STRIPE_LIVE_SMOKE_BEARER_TOKEN',
  'ACTIVATION_RETENTION_EXPORT_BEARER_TOKEN',
];
const COOKIE_ENV_VARS = [
  'SCALE_READINESS_COOKIE_HEADER',
  'STRIPE_LIVE_SMOKE_COOKIE_HEADER',
  'ACTIVATION_RETENTION_EXPORT_COOKIE_HEADER',
];
const EMAIL_ENV_VARS = [
  'SCALE_READINESS_EMAIL',
  'STRIPE_LIVE_SMOKE_EMAIL',
  'ACTIVATION_RETENTION_EXPORT_EMAIL',
];
const PASSWORD_ENV_VARS = [
  'SCALE_READINESS_PASSWORD',
  'STRIPE_LIVE_SMOKE_PASSWORD',
  'ACTIVATION_RETENTION_EXPORT_PASSWORD',
];
const FIREBASE_API_KEY_ENV = 'VITE_FIREBASE_API_KEY';
const LOCAL_ENV_FILE = path.resolve(process.cwd(), '.env.local');
const BOOTSTRAP_ARTIFACT_RELATIVE = 'test-results/published-workspace-bootstrap/post-signup-nameflow-retry-1780712240110.json';
const STRIPE_ARTIFACT_RELATIVE = 'test-results/stripe-live-smoke/2026-06-05T02-27-29-531Z.json';
const PERFORMANCE_REPORT_GLOB_ROOT = 'test-results/target-performance-evidence';

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readLocalEnvFile() {
  if (!fs.existsSync(LOCAL_ENV_FILE)) {
    return {};
  }

  const raw = fs.readFileSync(LOCAL_ENV_FILE, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }

  return env;
}

function loadMergedEnv() {
  return {
    ...readLocalEnvFile(),
    ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string')),
  };
}

function pickFirstEnv(names) {
  const env = loadMergedEnv();
  for (const name of names) {
    const value = typeof env[name] === 'string' && env[name].trim() ? env[name].trim() : '';
    if (value) {
      return { value, source: name };
    }
  }
  return { value: '', source: null };
}

function resolveTargetUrl() {
  const fromEnv = pickFirstEnv(TARGET_URL_ENV_VARS);
  if (fromEnv.value) {
    return fromEnv;
  }
  return { value: DEFAULT_TARGET_URL, source: 'default' };
}

function resolveBackendUrl() {
  return pickFirstEnv(BACKEND_URL_ENV_VARS);
}

function normalizeCookieHeader(value) {
  return String(value || '').replace(/^cookie\s*:\s*/i, '').trim();
}

function resolveAuthContext() {
  const bearer = pickFirstEnv(BEARER_ENV_VARS);
  if (bearer.value) {
    return {
      mode: 'bearer',
      source: bearer.source,
      value: bearer.value,
    };
  }

  const cookie = pickFirstEnv(COOKIE_ENV_VARS);
  if (cookie.value) {
    return {
      mode: 'cookie',
      source: cookie.source,
      value: normalizeCookieHeader(cookie.value),
    };
  }

  return {
    mode: null,
    source: null,
    value: '',
  };
}

function resolveWorkspaceId() {
  return pickFirstEnv(WORKSPACE_ID_ENV_VARS);
}

function resolveLoginCredentials() {
  return {
    email: pickFirstEnv(EMAIL_ENV_VARS),
    password: pickFirstEnv(PASSWORD_ENV_VARS),
  };
}

function resolveFirebaseApiKey() {
  return pickFirstEnv([FIREBASE_API_KEY_ENV]);
}

function extractWorkspaceIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const workspaceId = extractWorkspaceIdFromPayload(item);
      if (workspaceId) {
        return workspaceId;
      }
    }

    return '';
  }

  const directCandidates = [
    payload.workspaceId,
    payload.id,
    payload.workspace_id,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nestedCandidates = [
    payload.workspace,
    payload.data,
    payload.result,
  ];

  for (const nested of nestedCandidates) {
    const nestedId = extractWorkspaceIdFromPayload(nested);
    if (nestedId) {
      return nestedId;
    }
  }

  return '';
}

function extractWorkspaceIdFromWorkspaceListPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  return extractWorkspaceIdFromPayload(payload.workspaces);
}

async function exchangeFirebaseIdentity({ apiKey, email, password }) {
  if (!apiKey || !email || !password) {
    return {
      ok: false,
      idToken: '',
      source: null,
      reasons: ['missing firebase api key, email, or password'],
    };
  }

  const endpoints = [
    {
      source: 'firebase-signin',
      url: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      payload: { email, password, returnSecureToken: true },
    },
    {
      source: 'firebase-signup',
      url: `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      payload: { email, password, returnSecureToken: true },
    },
  ];

  const reasons = [];
  for (const endpoint of endpoints) {
    const response = await fetchWithTimeout(endpoint.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpoint.payload),
    });

    const payload = await response.json().catch(() => null);
    const idToken = typeof payload?.idToken === 'string' ? payload.idToken.trim() : '';
    if (response.ok && idToken) {
      return {
        ok: true,
        idToken,
        source: endpoint.source,
        reasons: [],
      };
    }

    const errorMessage = typeof payload?.error?.message === 'string'
      ? payload.error.message
      : `HTTP ${response.status}`;
    reasons.push(`${endpoint.source} failed with ${errorMessage}`);
  }

  return {
    ok: false,
    idToken: '',
    source: null,
    reasons,
  };
}

function rel(filePath) {
  return filePath.replaceAll('\\', '/').replace(`${process.cwd().replaceAll('\\', '/')}/`, '');
}

function formatTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function findLatestReportJson(rootDir) {
  const absoluteRoot = path.resolve(process.cwd(), rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return null;
  }

  const candidates = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name === 'report.json') {
        candidates.push(absolutePath);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return candidates[0];
}

function tryReadJson(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { exists: false, absolutePath, parsed: null };
  }

  try {
    return {
      exists: true,
      absolutePath,
      parsed: JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
    };
  } catch (error) {
    return {
      exists: true,
      absolutePath,
      parsed: null,
      error: error?.message || 'invalid json',
    };
  }
}

function runTargetPerformance(targetUrl) {
  if (!targetUrl) {
    return {
      status: 'BLOCK',
      summary: 'missing target url for target-performance runner',
      artifact: null,
    };
  }

  const child = spawnSync(
    process.execPath,
    ['scripts/check-target-performance-evidence.mjs', '--target-url', targetUrl],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
    },
  );

  const latestReport = findLatestReportJson(PERFORMANCE_REPORT_GLOB_ROOT);
  const latestParsed = latestReport ? tryReadJson(rel(latestReport)) : null;

  return {
    status: child.status === 0 ? 'PASS' : 'BLOCK',
    summary: child.status === 0
      ? 'dashboard benchmark captured in published target'
      : 'target-performance runner failed or blocked',
    stdoutTail: String(child.stdout || '').trim().split(/\r?\n/).slice(-8),
    stderrTail: String(child.stderr || '').trim().split(/\r?\n/).slice(-8),
    artifact: latestParsed?.exists ? rel(latestParsed.absolutePath) : null,
    measurementStatus: latestParsed?.parsed?.result?.status || latestParsed?.parsed?.status || null,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
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

function buildPublishedHeaders(authContext, workspaceId) {
  const headers = {
    Accept: 'application/json,text/plain;q=0.8,*/*;q=0.5',
    'Content-Type': 'application/json',
  };

  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  if (authContext.mode === 'bearer') {
    headers.Authorization = `Bearer ${authContext.value}`;
  } else if (authContext.mode === 'cookie') {
    headers.Cookie = authContext.value;
  }

  return headers;
}

function sanitizeUrl(candidate) {
  if (!candidate) {
    return '';
  }

  try {
    const url = new URL(candidate);
    if (url.pathname === '/' || !url.pathname) {
      return url.origin;
    }
    if (url.pathname.startsWith('/api/')) {
      return url.origin;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function extractCookieHeader(response) {
  const direct = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [];
  const rawCookies = direct.length > 0
    ? direct
    : [response.headers.get('set-cookie')].filter(Boolean);

  if (rawCookies.length === 0) {
    return '';
  }

  const normalized = rawCookies
    .flatMap((cookieLine) => String(cookieLine).split(/,(?=\s*[^;,\s]+=)/))
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter(Boolean);

  return normalized.join('; ');
}

async function loginPublishedContext({ backendUrl, email, password }) {
  if (!backendUrl || !email || !password) {
    return {
      ok: false,
      authContext: { mode: null, source: null, value: '' },
      workspaceId: '',
      reasons: ['missing backend url, email, or password for published login bootstrap'],
    };
  }

  const firebaseApiKey = resolveFirebaseApiKey().value;
  if (firebaseApiKey) {
    const firebaseIdentity = await exchangeFirebaseIdentity({ apiKey: firebaseApiKey, email, password });

    if (firebaseIdentity.ok && firebaseIdentity.idToken) {
      const firebaseSessionResponse = await fetchWithTimeout(new URL('/api/auth/firebase', backendUrl), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: firebaseIdentity.idToken }),
      });

      const firebaseSessionPayload = await firebaseSessionResponse.json().catch(() => null);
      const cookieHeader = extractCookieHeader(firebaseSessionResponse);
      const bearerToken = typeof firebaseSessionPayload?.token === 'string' ? firebaseSessionPayload.token.trim() : '';

      let authContext = { mode: null, source: null, value: '' };
      if (cookieHeader) {
        authContext = { mode: 'cookie', source: 'published-firebase-cookie', value: cookieHeader };
      } else if (bearerToken) {
        authContext = { mode: 'bearer', source: 'published-firebase-token', value: bearerToken };
      }

      if (firebaseSessionResponse.ok && authContext.mode) {
        const workspaceResponse = await fetchWithTimeout(new URL('/api/workspace', backendUrl), {
          method: 'GET',
          headers: buildPublishedHeaders(authContext, ''),
        });
        const workspacePayload = await workspaceResponse.json().catch(() => null);
        let workspaceId = extractWorkspaceIdFromWorkspaceListPayload(workspacePayload);

        if (!workspaceId) {
          const createWorkspaceResponse = await fetchWithTimeout(new URL('/api/workspace', backendUrl), {
            method: 'POST',
            headers: {
              ...buildPublishedHeaders(authContext, ''),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Flow Finance Audit' }),
          });
          const createWorkspacePayload = await createWorkspaceResponse.json().catch(() => null);
          workspaceId = extractWorkspaceIdFromPayload(createWorkspacePayload);

          if (createWorkspaceResponse.ok && workspaceId) {
            return {
              ok: true,
              authContext,
              workspaceId,
              loginStatus: firebaseSessionResponse.status,
              workspaceStatus: createWorkspaceResponse.status,
              reasons: [],
            };
          }

          return {
            ok: false,
            authContext,
            workspaceId: '',
            loginStatus: firebaseSessionResponse.status,
            workspaceStatus: createWorkspaceResponse.status,
            reasons: !createWorkspaceResponse.ok
              ? [`published workspace create failed with HTTP ${createWorkspaceResponse.status}`]
              : ['published workspace create succeeded but returned no workspace id'],
          };
        }

        if (workspaceResponse.ok && workspaceId) {
          return {
            ok: true,
            authContext,
            workspaceId,
            loginStatus: firebaseSessionResponse.status,
            workspaceStatus: workspaceResponse.status,
            reasons: [],
          };
        }

        return {
          ok: false,
          authContext,
          workspaceId: '',
          loginStatus: firebaseSessionResponse.status,
          workspaceStatus: workspaceResponse.status,
          reasons: !workspaceResponse.ok
            ? [`published workspace lookup failed with HTTP ${workspaceResponse.status}`]
            : ['published workspace lookup succeeded but returned no workspace id'],
        };
      }

      return {
        ok: false,
        authContext,
        workspaceId: '',
        loginStatus: firebaseSessionResponse.status,
        reasons: !firebaseSessionResponse.ok
          ? [`published firebase session exchange failed with HTTP ${firebaseSessionResponse.status}`]
          : ['published firebase session exchange succeeded but returned neither reusable cookie nor bearer token'],
      };
    }

    return {
      ok: false,
      authContext: { mode: null, source: null, value: '' },
      workspaceId: '',
      loginStatus: 400,
      reasons: firebaseIdentity.reasons.length > 0
        ? firebaseIdentity.reasons.map((reason) => `firebase identity bootstrap failed: ${reason}`)
        : ['firebase identity bootstrap failed for an unknown reason'],
    };
  }

  const loginResponse = await fetchWithTimeout(new URL('/api/auth/login', backendUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const loginPayload = await loginResponse.json().catch(() => null);
  const cookieHeader = extractCookieHeader(loginResponse);
  const bearerToken = typeof loginPayload?.token === 'string' ? loginPayload.token.trim() : '';

  let authContext = { mode: null, source: null, value: '' };
  if (cookieHeader) {
    authContext = { mode: 'cookie', source: 'published-login-cookie', value: cookieHeader };
  } else if (bearerToken) {
    authContext = { mode: 'bearer', source: 'published-login-token', value: bearerToken };
  }

  if (!loginResponse.ok || !authContext.mode) {
    return {
      ok: false,
      authContext,
      workspaceId: '',
      loginStatus: loginResponse.status,
      reasons: !loginResponse.ok
        ? [`published login failed with HTTP ${loginResponse.status}`]
        : ['published login succeeded but returned neither reusable cookie nor bearer token'],
    };
  }

  const workspaceResponse = await fetchWithTimeout(new URL('/api/workspace', backendUrl), {
    method: 'GET',
    headers: buildPublishedHeaders(authContext, ''),
  });
  const workspacePayload = await workspaceResponse.json().catch(() => null);
  const workspaceId = extractWorkspaceIdFromWorkspaceListPayload(workspacePayload);

  if (!workspaceResponse.ok || !workspaceId) {
    return {
      ok: false,
      authContext,
      workspaceId: '',
      loginStatus: loginResponse.status,
      workspaceStatus: workspaceResponse.status,
      reasons: !workspaceResponse.ok
        ? [`published workspace lookup failed with HTTP ${workspaceResponse.status}`]
        : ['published workspace lookup succeeded but returned no workspace id'],
    };
  }

  return {
    ok: true,
    authContext,
    workspaceId,
    loginStatus: loginResponse.status,
    workspaceStatus: workspaceResponse.status,
    reasons: [],
  };
}

async function runSyncPullLoad({ backendUrl, authContext, workspaceId, repetitions = 3 }) {
  if (!backendUrl || !workspaceId || !authContext.mode) {
    return {
      status: 'BLOCK',
      evidence: [],
      reasons: ['missing backend url, workspace id, or authenticated published context for sync pull load'],
      attempts: [],
    };
  }

  const attempts = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetchWithTimeout(new URL('/api/sync/pull', backendUrl), {
        method: 'GET',
        headers: buildPublishedHeaders(authContext, workspaceId),
      });
      const durationMs = Date.now() - startedAt;
      attempts.push({
        attempt: index + 1,
        status: response.status,
        ok: response.ok,
        durationMs,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      attempts.push({
        attempt: index + 1,
        status: null,
        ok: false,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const pass = attempts.length === repetitions && attempts.every((attempt) => attempt.status === 200);
  return {
    status: pass ? 'PASS' : 'BLOCK',
    evidence: [],
    reasons: pass ? [] : ['sync pull did not return 200 on every repeated attempt'],
    attempts,
  };
}

async function runAiCfoLoad({ backendUrl, authContext, workspaceId, repetitions = 2 }) {
  if (!backendUrl || !workspaceId || !authContext.mode) {
    return {
      status: 'BLOCK',
      evidence: [],
      reasons: ['missing backend url, workspace id, or authenticated published context for AI CFO load'],
      attempts: [],
    };
  }

  const attempts = [];
  const body = {
    question: 'Qual o risco do caixa nesta semana?',
    context: 'Saldo confirmado: 10000. Recebiveis pendentes: 2500. Saidas previstas nos proximos 7 dias: 7800.',
    intent: 'risk_question',
  };

  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetchWithTimeout(new URL('/api/ai/cfo', backendUrl), {
        method: 'POST',
        headers: {
          ...buildPublishedHeaders(authContext, workspaceId),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 30000);
      const payload = await response.json().catch(() => null);
      const durationMs = Date.now() - startedAt;
      const hasAnswer = Boolean(payload && typeof payload.answer === 'string' && payload.answer.trim());
      const hasFallbackDiagnostic = Boolean(payload && payload.diagnostic && payload.explainability);
      attempts.push({
        attempt: index + 1,
        status: response.status,
        ok: response.ok,
        durationMs,
        hasAnswer,
        hasFallbackDiagnostic,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      attempts.push({
        attempt: index + 1,
        status: null,
        ok: false,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const pass = attempts.length === repetitions && attempts.every((attempt) => attempt.status === 200 && (attempt.hasAnswer || attempt.hasFallbackDiagnostic));
  return {
    status: pass ? 'PASS' : 'BLOCK',
    evidence: [],
    reasons: pass ? [] : ['AI CFO did not return 200 with answer or explicit fallback on every repeated attempt'],
    attempts,
  };
}

function evaluateScenario({ id, title, objective, status, evidence, reasons }) {
  return { id, title, objective, status, evidence, reasons };
}

function buildMarkdown(payload) {
  const lines = [
    `# ${GATE_NAME} evidence`,
    '',
    `- runner: ${payload.runnerName}`,
    `- timestamp: ${payload.timestamp}`,
    `- result: ${payload.result.status}`,
    `- summary: ${payload.result.summary}`,
    '',
    '## Scenarios',
  ];

  for (const scenario of payload.scenarios) {
    lines.push('');
    lines.push(`### ${scenario.id} - ${scenario.title}`);
    lines.push(`- status: ${scenario.status}`);
    lines.push(`- objective: ${scenario.objective}`);
    if (scenario.evidence.length > 0) {
      lines.push('- evidence:');
      for (const item of scenario.evidence) {
        lines.push(`  - ${item}`);
      }
    }
    if (scenario.reasons.length > 0) {
      lines.push('- reasons:');
      for (const item of scenario.reasons) {
        lines.push(`  - ${item}`);
      }
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

function hasDocumentedReference(filePath, patterns) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  return patterns.every((pattern) => content.includes(pattern));
}

async function main() {
  const timestamp = new Date().toISOString();
  const runId = formatTimestamp(new Date());
  const targetUrl = resolveTargetUrl();
  const backendUrl = resolveBackendUrl();
  let authContext = resolveAuthContext();
  let workspaceId = resolveWorkspaceId();
  const loginCredentials = resolveLoginCredentials();
  const backendBaseUrl = sanitizeUrl(backendUrl.value);
  let publishedLoginBootstrap = null;

  if ((!authContext.mode || !workspaceId.value) && backendBaseUrl && loginCredentials.email.value && loginCredentials.password.value) {
    publishedLoginBootstrap = await loginPublishedContext({
      backendUrl: backendBaseUrl,
      email: loginCredentials.email.value,
      password: loginCredentials.password.value,
    });

    if (publishedLoginBootstrap.ok) {
      if (!authContext.mode) {
        authContext = publishedLoginBootstrap.authContext;
      }
      if (!workspaceId.value) {
        workspaceId = {
          value: publishedLoginBootstrap.workspaceId,
          source: 'published-login-bootstrap',
        };
      }
    }
  }

  const targetPerformance = runTargetPerformance(targetUrl.value);
  const bootstrapArtifact = tryReadJson(BOOTSTRAP_ARTIFACT_RELATIVE);
  const stripeArtifact = tryReadJson(STRIPE_ARTIFACT_RELATIVE);
  const documentedBootstrapEvidence = hasDocumentedReference('docs/DEPLOYMENT_STATUS.md', [
    'post-signup-nameflow-retry-1780712240110.json',
    'POST /api/auth/firebase',
    'GET /api/sync/pull',
  ]);
  const documentedStripeEvidence = hasDocumentedReference('docs/STRIPE_LIVE_SMOKE_2026-06-04.md', [
    'test-results/stripe-live-smoke/2026-06-05T02-27-29-531Z.json',
    'gate externo **Stripe real smoke** esta `CLOSED / EVIDENCED`',
  ]);
  const syncPullLoad = await runSyncPullLoad({
    backendUrl: backendBaseUrl,
    authContext,
    workspaceId: workspaceId.value,
  });
  const aiCfoLoad = await runAiCfoLoad({
    backendUrl: backendBaseUrl,
    authContext,
    workspaceId: workspaceId.value,
  });

  const scenarios = [
    evaluateScenario({
      id: 'L1',
      title: 'Auth bootstrap publicado',
      objective: 'login, workspace bootstrap e persistencia sem degradacao',
      status: bootstrapArtifact.exists ? 'BLOCK' : (documentedBootstrapEvidence ? 'DOCUMENTED_ONLY' : 'BLOCK'),
      evidence: bootstrapArtifact.exists
        ? [BOOTSTRAP_ARTIFACT_RELATIVE]
        : (documentedBootstrapEvidence ? ['docs/DEPLOYMENT_STATUS.md'] : []),
      reasons: bootstrapArtifact.exists
        ? ['historical smoke exists, but there is no repeated load artifact for auth/bootstrap']
        : documentedBootstrapEvidence
          ? ['historical published bootstrap evidence is documented, but the local artifact is absent and there is no repeated-load proof']
          : ['no published bootstrap artifact found'],
    }),
    evaluateScenario({
      id: 'L2',
      title: 'Sync pull publicado',
      objective: 'sync pull sob repeticao controlada',
      status: syncPullLoad.status,
      evidence: syncPullLoad.evidence,
      reasons: syncPullLoad.reasons,
    }),
    evaluateScenario({
      id: 'L3',
      title: 'Dashboard benchmark publicado',
      objective: 'dashboard benchmark in published target',
      status: targetPerformance.status,
      evidence: targetPerformance.artifact ? [targetPerformance.artifact] : [],
      reasons: targetPerformance.status === 'PASS' ? [] : [targetPerformance.summary],
    }),
    evaluateScenario({
      id: 'L4',
      title: 'Consultor IA sob repeticao controlada',
      objective: 'AI responses or explicit fallback under repetition',
      status: aiCfoLoad.status,
      evidence: aiCfoLoad.evidence,
      reasons: aiCfoLoad.reasons,
    }),
    evaluateScenario({
      id: 'L5',
      title: 'Billing e workspace persistence apos checkout',
      objective: 'checkout, webhook, workspace persistence, and portal under repeated validation',
      status: stripeArtifact.exists ? 'BLOCK' : (documentedStripeEvidence ? 'DOCUMENTED_ONLY' : 'BLOCK'),
      evidence: stripeArtifact.exists
        ? [STRIPE_ARTIFACT_RELATIVE]
        : (documentedStripeEvidence ? ['docs/STRIPE_LIVE_SMOKE_2026-06-04.md'] : []),
      reasons: stripeArtifact.exists
        ? ['historical billing evidence exists, but there is no scale or repeated-load artifact for billing persistence']
        : documentedStripeEvidence
          ? ['historical published billing evidence is documented, but the local artifact is absent and there is no repeated-load proof']
          : ['no Stripe live smoke artifact found'],
    }),
  ];

  const passCount = scenarios.filter((scenario) => scenario.status === 'PASS').length;
  const documentedCount = scenarios.filter((scenario) => scenario.status === 'DOCUMENTED_ONLY').length;
  const blockCount = scenarios.filter((scenario) => scenario.status === 'BLOCK').length;
  const result = {
    status: blockCount === 0 ? 'PASS' : 'BLOCK',
    summary: blockCount === 0
      ? 'all scale-readiness scenarios are evidenced'
      : `${passCount} scenario(s) evidenced, ${documentedCount} documented-only, ${blockCount} still blocked`,
  };

  const payload = {
    runnerName: RUNNER_NAME,
    gateName: GATE_NAME,
    timestamp,
    inputs: {
      targetUrl,
      backendUrl,
      backendBaseUrl,
      workspaceId,
      loginCredentials: {
        emailSource: loginCredentials.email.source,
        passwordSource: loginCredentials.password.source,
      },
      authContext: {
        mode: authContext.mode,
        source: authContext.source,
      },
    },
    publishedLoginBootstrap: publishedLoginBootstrap
      ? {
          ok: publishedLoginBootstrap.ok,
          loginStatus: publishedLoginBootstrap.loginStatus ?? null,
          workspaceStatus: publishedLoginBootstrap.workspaceStatus ?? null,
          authMode: publishedLoginBootstrap.authContext.mode,
          authSource: publishedLoginBootstrap.authContext.source,
          workspaceIdDiscovered: publishedLoginBootstrap.workspaceId || null,
          reasons: publishedLoginBootstrap.reasons,
        }
      : null,
    targetPerformance,
    syncPullLoad,
    aiCfoLoad,
    scenarios,
    result,
  };

  const artifacts = writeArtifact(runId, payload);

  process.stdout.write('Scale readiness evidence\n');
  process.stdout.write('========================\n');
  process.stdout.write(`Result: ${result.status}\n`);
  process.stdout.write(`Summary: ${result.summary}\n`);
  process.stdout.write(`Artifact: ${rel(artifacts.jsonPath)}\n`);
  process.stdout.write(`Report: ${rel(artifacts.mdPath)}\n`);

  for (const scenario of scenarios) {
    process.stdout.write(`- ${scenario.id} ${scenario.status}: ${scenario.title}\n`);
  }

  process.exitCode = result.status === 'PASS' ? 0 : 1;
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
