#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const RUNNER_NAME = 'Flow Finance visual regression runner';
const DEFAULT_BASE_URL = 'http://127.0.0.1:4176';
const DEFAULT_OUTPUT_ROOT = 'test-results/visual-regression';
const VITE_CLI_PATH = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const DEV_SERVER_COMMAND = process.execPath;
const DEV_SERVER_ARGS = [VITE_CLI_PATH, 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'];
const SERVER_READY_TIMEOUT_MS = 120_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_TABS = [
  { tab: 'dashboard', label: 'Resumo' },
  { tab: 'history', label: 'Transacoes' },
  { tab: 'flow', label: 'Previsto vs realizado' },
  { tab: 'insights', label: 'Sinais do caixa' },
  { tab: 'cfo', label: 'Consultor de caixa' },
  { tab: 'settings', label: 'Conta e plano' },
];
const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

function normalizeSlashes(value) {
  return value.replaceAll('\\', '/');
}

function rel(value) {
  return normalizeSlashes(path.relative(process.cwd(), value));
}

function safeTimestamp(value) {
  return value.replace(/[:.]/g, '-');
}

function readStringEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parseListArg(value) {
  if (!value || typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    tabs: [],
    viewports: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }

    if (token === '--base-url') {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (token.startsWith('--base-url=')) {
      args.baseUrl = token.slice('--base-url='.length);
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

    if (token === '--tabs') {
      args.tabs = parseListArg(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith('--tabs=')) {
      args.tabs = parseListArg(token.slice('--tabs='.length));
      continue;
    }

    if (token === '--viewports') {
      args.viewports = parseListArg(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith('--viewports=')) {
      args.viewports = parseListArg(token.slice('--viewports='.length));
      continue;
    }
  }

  return args;
}

function resolveTabs(args) {
  if (args.tabs.length === 0) {
    return DEFAULT_TABS;
  }

  const lookup = new Map(DEFAULT_TABS.map((item) => [item.tab, item.label]));
  return args.tabs.map((tab) => ({
    tab,
    label: lookup.get(tab) || tab,
  }));
}

function resolveViewports(args) {
  if (args.viewports.length === 0) {
    return DEFAULT_VIEWPORTS;
  }

  const lookup = new Map(DEFAULT_VIEWPORTS.map((item) => [item.name, item]));
  return args.viewports
    .map((name) => lookup.get(name))
    .filter(Boolean);
}

async function isBaseUrlReachable(baseUrl) {
  try {
    const response = await fetch(new URL('/', baseUrl), {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    return response.ok || response.status === 304;
  } catch {
    return false;
  }
}

async function waitForBaseUrl(baseUrl, timeoutMs = SERVER_READY_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBaseUrlReachable(baseUrl)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function ensureDevServer(baseUrl) {
  if (await isBaseUrlReachable(baseUrl)) {
    return { started: false, child: null };
  }

  const child = spawn(DEV_SERVER_COMMAND, DEV_SERVER_ARGS, {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  });

  const ready = await waitForBaseUrl(baseUrl);
  if (!ready) {
    child.kill('SIGINT');
    throw new Error(`Dev server not reachable at ${baseUrl} after ${SERVER_READY_TIMEOUT_MS}ms`);
  }

  return { started: true, child };
}

function buildDemoUrl(baseUrl, tab) {
  const url = new URL('/', baseUrl);
  url.searchParams.set('demoData', '1');
  url.searchParams.set('demoPlan', 'pro');
  url.searchParams.set('demoUserId', 'visual-regression-user');
  url.searchParams.set('demoUserEmail', 'visual@flow.dev');
  url.searchParams.set('demoUserName', 'Visual Regression');
  url.searchParams.set('demoWorkspaceId', 'ws-visual-regression');
  url.searchParams.set('demoWorkspaceName', 'Atelie Aurora');
  url.searchParams.set('demoTenantId', 'tenant-visual-regression');
  url.searchParams.set('demoTenantName', 'Flow Finance Demo');
  url.searchParams.set('demoToken', 'visual-regression-token');
  url.searchParams.set('tab', tab);
  return url.toString();
}

function sha256File(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function fileInfo(absolutePath) {
  const buffer = await fs.readFile(absolutePath);
  const stats = await fs.stat(absolutePath);
  return {
    path: absolutePath,
    relativePath: rel(absolutePath),
    size: stats.size,
    sha256: sha256File(buffer),
  };
}

function summarizeText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isIgnorableConsoleIssue(type, text) {
  if (type === 'warning') {
    return text.includes('Service Worker registration blocked by Playwright')
      || text.includes('[Sentry] DSN ausente');
  }

  if (type === 'error') {
    return text.includes('Failed to load resource: net::ERR_CONNECTION_REFUSED')
      || text.includes('Failed to load resource: the server responded with a status of 404 (Not Found)');
  }

  return false;
}

async function fulfillDemoApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method().toUpperCase();
  const now = new Date().toISOString();

  const json = (body) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: `${JSON.stringify(body)}\n`,
  });

  if (url.pathname === '/api/integrations/keys' && method === 'GET') {
    return json({
      configured: false,
      keyPrefix: null,
      createdAt: null,
    });
  }

  if (url.pathname === '/api/integrations/keys' && method === 'DELETE') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/integrations/keys/generate' && method === 'POST') {
    return json({
      key: 'flw_demo_key_123456',
      keyPrefix: 'flw_',
      createdAt: now,
      warning: 'demo response',
    });
  }

  if (url.pathname === '/api/saas/usage' && method === 'GET') {
    return json({ usage: {} });
  }

  if (url.pathname === '/api/saas/plans' && method === 'GET') {
    return json({
      scope: 'workspace',
      workspaceId: 'ws-visual-regression',
      currentPlan: 'pro',
      mockBillingEnabled: false,
      stripeConfigured: false,
      stripePortalEnabled: false,
      hasBillingCustomer: false,
      billingProvider: 'none',
      manualPlanChangeAllowed: false,
      plans: [],
    });
  }

  if (url.pathname === '/api/saas/billing-hooks' && method === 'POST') {
    return json({ ok: true });
  }

  if (url.pathname === '/api/saas/stripe/checkout-session' && method === 'POST') {
    return json({ id: 'demo_checkout_session', url: null });
  }

  if (url.pathname === '/api/saas/stripe/portal-session' && method === 'POST') {
    return json({ url: '' });
  }

  if (url.pathname === '/api/ai/cfo' && method === 'POST') {
    return json({
      answer: 'Demo response: a leitura de caixa esta pronta para screenshots locais.',
    });
  }

  if (url.pathname === '/api/workspace' && method === 'GET') {
    return json({
      workspaces: [
        {
          workspaceId: 'ws-visual-regression',
          name: 'Atelie Aurora',
          tenantId: 'tenant-visual-regression',
          tenantName: 'Flow Finance Demo',
          plan: 'pro',
          role: 'owner',
          isDefault: true,
        },
      ],
    });
  }

  return json({});
}

async function captureViewport(browser, baseUrl, runDir, viewport, tabs) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    colorScheme: 'light',
    serviceWorkers: 'block',
    ignoreHTTPSErrors: true,
  });

  const consoleIssues = [];
  const pageErrors = [];

  const page = await context.newPage();
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      const text = summarizeText(message.text());
      if (!isIgnorableConsoleIssue(type, text)) {
        consoleIssues.push({
          type,
          text,
        });
      }
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(summarizeText(error?.message || String(error)));
  });

  await context.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.host === 'localhost:3001' || requestUrl.host === '127.0.0.1:3001') {
      await fulfillDemoApi(route);
      return;
    }

    await route.continue();
  });

  await page.addInitScript((bootstrap) => {
    window.localStorage.setItem('flow_demo_data', '1');
    window.localStorage.setItem('flow_demo_plan', 'pro');
    window.localStorage.setItem('flow_demo_user_id', bootstrap.userId);
    window.localStorage.setItem('flow_demo_user_email', bootstrap.userEmail);
    window.localStorage.setItem('flow_demo_user_name', bootstrap.userName);
    window.localStorage.setItem('flow_demo_workspace_id', bootstrap.workspaceId);
    window.localStorage.setItem('flow_demo_workspace_name', bootstrap.workspaceName);
    window.localStorage.setItem('flow_demo_tenant_id', bootstrap.tenantId);
    window.localStorage.setItem('flow_demo_tenant_name', bootstrap.tenantName);
    window.localStorage.setItem('flow_demo_auth_token', bootstrap.token);
  }, {
    userId: 'visual-regression-user',
    userEmail: 'visual@flow.dev',
    userName: 'Visual Regression',
    workspaceId: 'ws-visual-regression',
    workspaceName: 'Atelie Aurora',
    tenantId: 'tenant-visual-regression',
    tenantName: 'Flow Finance Demo',
    token: 'visual-regression-token',
  });

  const captures = [];

  for (const { tab, label } of tabs) {
    const targetUrl = buildDemoUrl(baseUrl, tab);
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(700);
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
      `,
    });

    const screenshotPath = path.join(runDir, `${tab}-${viewport.name}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: 'disabled',
    });

    captures.push({
      tab,
      label,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      url: page.url(),
      responseStatus: response?.status() ?? null,
      screenshot: {
        ...await fileInfo(screenshotPath),
      },
    });
  }

  await context.close();

  return {
    viewport: viewport.name,
    captures,
    consoleIssues,
    pageErrors,
  };
}

function renderManifest(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write([
      'Flow Finance visual regression runner',
      '',
      'Usage:',
      '  node scripts/capture-visual-regression.mjs',
      '  node scripts/capture-visual-regression.mjs --tabs=dashboard,history,flow',
      '  node scripts/capture-visual-regression.mjs --viewports=desktop,mobile',
      '  node scripts/capture-visual-regression.mjs --base-url http://127.0.0.1:4173',
      '',
      'Output:',
      `  ${DEFAULT_OUTPUT_ROOT}/<timestamp>/manifest.json`,
      '',
    ].join('\n'));
    return;
  }

  const baseUrl = (typeof args.baseUrl === 'string' && args.baseUrl.trim())
    || readStringEnv('FLOW_VISUAL_REGRESSION_BASE_URL')
    || DEFAULT_BASE_URL;
  const outputRoot = (typeof args.outputDir === 'string' && args.outputDir.trim())
    || readStringEnv('FLOW_VISUAL_REGRESSION_OUTPUT_DIR')
    || DEFAULT_OUTPUT_ROOT;
  const tabs = resolveTabs(args);
  const viewports = resolveViewports(args);

  if (tabs.length === 0) {
    throw new Error('No capture tabs resolved from the provided arguments');
  }

  if (viewports.length === 0) {
    throw new Error('No capture viewports resolved from the provided arguments');
  }

  const timestamp = new Date().toISOString();
  const runId = safeTimestamp(timestamp);
  const runDir = path.resolve(process.cwd(), outputRoot, runId);

  await fs.mkdir(runDir, { recursive: true });

  const server = await ensureDevServer(baseUrl);
  const viewportRuns = [];
  const aggregateConsoleIssues = [];
  const aggregatePageErrors = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of viewports) {
      const run = await captureViewport(browser, baseUrl, runDir, viewport, tabs);
      viewportRuns.push(run);
      aggregateConsoleIssues.push(...run.consoleIssues);
      aggregatePageErrors.push(...run.pageErrors);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    if (server.started && server.child) {
      server.child.kill('SIGINT');
    }
  }

  const captureEntries = viewportRuns.flatMap((run) => run.captures);
  const manifest = {
    runnerName: RUNNER_NAME,
    capturedAt: timestamp,
    runId,
    baseUrl,
    outputDir: {
      absolute: runDir,
      relative: rel(runDir),
    },
    server: {
      reusedExisting: !server.started,
      startedForRun: server.started,
      command: DEV_SERVER_COMMAND,
      args: DEV_SERVER_ARGS,
    },
    tabs,
    viewports,
    summary: {
      screenshots: captureEntries.length,
      routes: tabs.length,
      viewportCount: viewports.length,
      consoleIssues: aggregateConsoleIssues.length,
      pageErrors: aggregatePageErrors.length,
    },
    captures: captureEntries,
    issues: {
      console: aggregateConsoleIssues,
      pageErrors: aggregatePageErrors,
    },
  };

  manifest.status = manifest.summary.consoleIssues === 0 && manifest.summary.pageErrors === 0
    ? 'PASS'
    : 'BLOCK';
  manifest.summaryText = manifest.status === 'PASS'
    ? 'PASS: visual regression screenshots captured for the central Flow Finance screens'
    : 'BLOCK: visual regression captured, but unexpected runtime issues were observed';

  const manifestPath = path.join(runDir, 'manifest.json');
  await fs.writeFile(manifestPath, renderManifest(manifest), 'utf8');

  process.stdout.write('Flow Finance visual regression\n');
  process.stdout.write('==============================\n');
  process.stdout.write(`Status: ${manifest.status}\n`);
  process.stdout.write(`Manifest: ${rel(manifestPath)}\n`);
  process.stdout.write(`Screenshots: ${manifest.summary.screenshots}\n`);

  if (manifest.status !== 'PASS') {
    process.exitCode = 1;
  }
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
