#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BACKEND_KEYS = [
  'SCALE_READINESS_BACKEND_URL',
  'STRIPE_LIVE_SMOKE_BACKEND_URL',
  'ACTIVATION_RETENTION_EXPORT_BACKEND_URL',
  'FLOW_LAUNCH_TARGET_URL',
  'VERCEL_TARGET_URL',
];

const EMAIL_KEYS = [
  'SCALE_READINESS_EMAIL',
  'STRIPE_LIVE_SMOKE_EMAIL',
  'ACTIVATION_RETENTION_EXPORT_EMAIL',
];

const PASSWORD_KEYS = [
  'SCALE_READINESS_PASSWORD',
  'STRIPE_LIVE_SMOKE_PASSWORD',
  'ACTIVATION_RETENTION_EXPORT_PASSWORD',
];

const WORKSPACE_KEYS = [
  'SCALE_READINESS_WORKSPACE_ID',
  'STRIPE_LIVE_SMOKE_WORKSPACE_ID',
  'ACTIVATION_RETENTION_EXPORT_WORKSPACE_ID',
];

const COOKIE_KEYS = [
  'SCALE_READINESS_COOKIE_HEADER',
  'STRIPE_LIVE_SMOKE_COOKIE_HEADER',
  'ACTIVATION_RETENTION_EXPORT_COOKIE_HEADER',
];

const BEARER_KEYS = [
  'SCALE_READINESS_BEARER_TOKEN',
  'STRIPE_LIVE_SMOKE_BEARER_TOKEN',
  'ACTIVATION_RETENTION_EXPORT_BEARER_TOKEN',
];

function parseEnvFileContent(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const env = {};

  for (const line of lines) {
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

function readEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return null;
  }

  return parseEnvFileContent(fs.readFileSync(envFilePath, 'utf8'));
}

function readFirst(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return { key, present: true };
    }
  }

  return { key: null, present: false };
}

function evaluateScaleReadiness(env) {
  const backend = readFirst(env, BACKEND_KEYS);
  const email = readFirst(env, EMAIL_KEYS);
  const password = readFirst(env, PASSWORD_KEYS);
  const workspace = readFirst(env, WORKSPACE_KEYS);
  const cookie = readFirst(env, COOKIE_KEYS);
  const bearer = readFirst(env, BEARER_KEYS);

  const hasAutoLogin = backend.present && email.present && password.present;
  const hasDirectAuth = backend.present && workspace.present && (cookie.present || bearer.present);

  return {
    ready: hasAutoLogin || hasDirectAuth,
    hasAutoLogin,
    hasDirectAuth,
    backend,
    email,
    password,
    workspace,
    cookie,
    bearer,
  };
}

function printStatusLine(label, probe) {
  process.stdout.write(`${label}: ${probe.present ? `SET (${probe.key})` : 'MISSING'}\n`);
}

function printHumanReport({ envFilePath, result }) {
  process.stdout.write('Flow Finance - Scale Readiness Prereqs\n');
  process.stdout.write('======================================\n');
  process.stdout.write(`env file: ${envFilePath}\n`);
  process.stdout.write('\n');

  printStatusLine('backend target', result.backend);
  printStatusLine('email', result.email);
  printStatusLine('password', result.password);
  printStatusLine('workspace id', result.workspace);
  printStatusLine('cookie header', result.cookie);
  printStatusLine('bearer token', result.bearer);
  process.stdout.write('\n');

  if (result.ready) {
    const mode = result.hasAutoLogin ? 'AUTO_LOGIN' : 'DIRECT_AUTH';
    process.stdout.write(`READY: published scale-readiness prerequisites are satisfied via ${mode}.\n`);
    return;
  }

  process.stdout.write('NOT READY: missing prerequisites.\n');
  process.stdout.write('- For auto login, set backend + email + password.\n');
  process.stdout.write('- For direct auth, set backend + workspace id + cookie or bearer.\n');
}

async function run() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const envFileArgIndex = args.indexOf('--env-file');
  const envFilePath = envFileArgIndex >= 0 && args[envFileArgIndex + 1]
    ? path.resolve(process.cwd(), args[envFileArgIndex + 1])
    : path.resolve(process.cwd(), '.env.local');

  const fileEnv = readEnvFile(envFilePath);
  const processEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => typeof value === 'string'),
  );
  const mergedEnv = {
    ...(fileEnv || {}),
    ...processEnv,
  };

  const result = evaluateScaleReadiness(mergedEnv);

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify({
      ready: result.ready,
      mode: result.hasAutoLogin ? 'AUTO_LOGIN' : (result.hasDirectAuth ? 'DIRECT_AUTH' : 'BLOCKED'),
      envFilePath,
      sources: {
        backend: result.backend.key,
        email: result.email.key,
        password: result.password.key,
        workspace: result.workspace.key,
        cookie: result.cookie.key,
        bearer: result.bearer.key,
      },
    }, null, 2)}\n`);
  } else {
    printHumanReport({ envFilePath, result });
  }

  process.exit(result.ready ? 0 : 2);
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}
