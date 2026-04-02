import 'dotenv/config';

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

function runStep(name: string, scriptPath: string, extraEnv: NodeJS.ProcessEnv = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', scriptPath],
      {
        cwd: backendRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          POSTGRES_STATE_STORE_ENABLED: 'true',
          ...extraEnv,
        },
      },
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
        return;
      }

      reject(new Error(`${name} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function main(): Promise<void> {
  const steps = [
    {
      name: 'apply migrations',
      scriptPath: path.join(backendRoot, 'scripts', 'apply-normalized-migrations.ts'),
      extraEnv: {},
    },
    {
      name: 'preflight before backfill',
      scriptPath: path.join(backendRoot, 'scripts', 'postgres-cutover-preflight.ts'),
      extraEnv: {},
    },
    {
      name: 'backfill normalized state',
      scriptPath: path.join(backendRoot, 'scripts', 'backfill-normalized-state.ts'),
      extraEnv: {
        DISABLE_LEGACY_STATE_BLOBS: 'false',
      },
    },
    {
      name: 'preflight after backfill',
      scriptPath: path.join(backendRoot, 'scripts', 'postgres-cutover-preflight.ts'),
      extraEnv: {},
    },
  ] as const;

  for (const step of steps) {
    console.log(`\n[postgres-cutover-run] starting: ${step.name}`);
    await runStep(step.name, step.scriptPath, step.extraEnv);
  }

  console.log(JSON.stringify({
    status: 'ok',
    nextStep: 'Enable DISABLE_LEGACY_STATE_BLOBS=true in the runtime environment after smoke-testing the application against Postgres.',
  }, null, 2));
}

void main().catch((error) => {
  console.error('[postgres-cutover-run] failed');
  console.error(error);
  process.exit(1);
});
