import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const PROJECTS = [
  'chromium',
  'firefox',
  'webkit',
  'Mobile Chrome',
  'Mobile Safari',
];

export function parseArgs(argv) {
  const sourceArgs = [...argv];
  const dryRun = sourceArgs.some((arg) => arg === '--dry-run' || arg === '--dryrun');
  const args = [];

  for (let index = 0; index < sourceArgs.length; index += 1) {
    const arg = sourceArgs[index];

    if (arg === '--dry-run' || arg === '--dryrun') {
      continue;
    }

    if (arg.startsWith('--project=')) {
      const value = arg.slice('--project='.length);
      if (value) {
        args.push('--project', value);
      } else {
        args.push('--project');
      }
      continue;
    }

    args.push(arg);
  }

  return { dryRun, args };
}

export function hasAnyProjectFlag(args) {
  return args.some((arg, idx) => (
    arg === '--project'
    || arg.startsWith('--project=')
    || (arg === '-p' && typeof args[idx + 1] === 'string')
  ));
}

export function printDryRun(args) {
  const explicitProject = hasAnyProjectFlag(args);
  const payload = {
    projects: explicitProject ? null : PROJECTS,
    note: explicitProject
      ? 'Dry-run: project filter provided; Playwright will run only the selected project(s).'
      : 'Dry-run: no project filter provided; matrix list matches validated Flow gate.',
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function runPlaywright(args) {
  const playwrightCli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  const child = spawn(process.execPath, [
    playwrightCli,
    'test',
    '--config',
    'playwright.config.ts',
    '--workers=1',
    ...args,
  ], {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exitCode = Number.isFinite(code) ? code : 1;
  });
}

const { dryRun, args } = parseArgs(process.argv.slice(2));

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  if (dryRun) {
    printDryRun(args);
    process.exit(0);
  }

  runPlaywright(args);
}
