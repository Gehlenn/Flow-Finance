import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

export const OPTIONAL_BACKEND_KEYS = ['VITE_BACKEND_URL', 'VITE_API_PROD_URL'];

export function parseEnvFileContent(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, '');
    env[key] = value;
  }

  return env;
}

export function evaluateAuthReadiness(env) {
  const hasBackend = OPTIONAL_BACKEND_KEYS.some((key) => Boolean(env[key]));
  const missingFirebase = REQUIRED_FIREBASE_KEYS.filter((key) => !env[key]);

  return {
    hasBackend,
    missingFirebase,
    ready: hasBackend && missingFirebase.length === 0,
  };
}

function readEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return null;
  }

  const raw = fs.readFileSync(envFilePath, 'utf8');
  return parseEnvFileContent(raw);
}

function printHumanReport({ envFilePath, env, result }) {
  console.log('Flow Finance - Auth Readiness Check');
  console.log('===================================');
  console.log(`env file: ${envFilePath}`);
  console.log('');

  for (const key of OPTIONAL_BACKEND_KEYS) {
    console.log(`${key}: ${env[key] ? 'SET' : 'MISSING'}`);
  }

  for (const key of REQUIRED_FIREBASE_KEYS) {
    console.log(`${key}: ${env[key] ? 'SET' : 'MISSING'}`);
  }

  console.log('');
  if (result.ready) {
    console.log('READY: local auth smoke prerequisites are satisfied.');
    return;
  }

  console.log('NOT READY: missing prerequisites.');
  if (!result.hasBackend) {
    console.log('- Set one backend URL: VITE_BACKEND_URL or VITE_API_PROD_URL');
  }
  if (result.missingFirebase.length > 0) {
    console.log(`- Missing Firebase keys: ${result.missingFirebase.join(', ')}`);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const envFileArgIndex = args.indexOf('--env-file');
  const envFilePath = envFileArgIndex >= 0 && args[envFileArgIndex + 1]
    ? path.resolve(process.cwd(), args[envFileArgIndex + 1])
    : path.resolve(process.cwd(), '.env.local');

  const env = readEnvFile(envFilePath);
  if (!env) {
    const output = {
      ready: false,
      reason: 'env_file_missing',
      envFilePath,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('Flow Finance - Auth Readiness Check');
      console.log('===================================');
      console.log(`env file not found: ${envFilePath}`);
      console.log('Create .env.local from .env.local.example before real auth smoke test.');
    }

    process.exit(2);
    return;
  }

  const result = evaluateAuthReadiness(env);

  if (jsonOutput) {
    console.log(JSON.stringify({
      ready: result.ready,
      envFilePath,
      hasBackend: result.hasBackend,
      missingFirebase: result.missingFirebase,
    }, null, 2));
  } else {
    printHumanReport({ envFilePath, env, result });
  }

  process.exit(result.ready ? 0 : 2);
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedDirectly) {
  run().catch((error) => {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  });
}

