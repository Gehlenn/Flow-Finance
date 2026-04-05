import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const args = process.argv.slice(2);

function getArgValue(name) {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function hasFlag(flag) {
  return args.includes(flag);
}

function readDefaultFirebaseProject() {
  const file = path.resolve(cwd, '.firebaserc');
  if (!fs.existsSync(file)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed?.projects?.default;
  } catch {
    return undefined;
  }
}

function run(command, commandArgs) {
  const resolvedCommand = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;
  const result = spawnSync(resolvedCommand, commandArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const project = getArgValue('--project') || readDefaultFirebaseProject();
const collectionsArg = getArgValue('--collections');
const collections = collectionsArg
  ? collectionsArg.split(',').map((value) => value.trim()).filter(Boolean)
  : [];

const skipFirestore = hasFlag('--skip-firestore');
const skipLocal = hasFlag('--skip-local');

if (!skipFirestore) {
  if (!project) {
    console.error('Projeto Firebase nao encontrado. Use --project=<id>.');
    process.exit(1);
  }

  if (collections.length > 0) {
    for (const collection of collections) {
      console.log(`\n[firestore] Limpando colecao: ${collection}`);
      run('npx', [
        'firebase',
        'firestore:delete',
        `/${collection}`,
        '--project',
        project,
        '--recursive',
        '--force',
      ]);
    }
  } else {
    console.log(`\n[firestore] Limpando todas as colecoes do projeto: ${project}`);
    run('npx', [
      'firebase',
      'firestore:delete',
      '--project',
      project,
      '--all-collections',
      '--recursive',
      '--force',
    ]);
  }
}

if (!skipLocal) {
  const backendDataDir = path.resolve(cwd, 'backend', 'data');
  fs.mkdirSync(backendDataDir, { recursive: true });

  const saasStorePath = path.join(backendDataDir, 'saas-store.json');
  const workspacesPath = path.join(backendDataDir, 'workspaces.json');
  const externalIdempotencyPath = path.join(backendDataDir, 'external-idempotency.json');

  const saasStore = {
    usageByWorkspace: {},
    usageByUser: {},
    billingHooksByWorkspace: {},
    billingHooksByUser: {},
    usageEventsByWorkspace: {},
    userPlans: {},
  };

  const workspaceStore = {
    tenants: [],
    workspaces: [],
    workspaceUsers: [],
    userPreferences: [],
  };

  fs.writeFileSync(saasStorePath, `${JSON.stringify(saasStore, null, 2)}\n`, 'utf8');
  fs.writeFileSync(workspacesPath, `${JSON.stringify(workspaceStore, null, 2)}\n`, 'utf8');

  if (fs.existsSync(externalIdempotencyPath)) {
    fs.rmSync(externalIdempotencyPath, { force: true });
  }

  console.log('\n[local] backend/data resetado com sucesso.');
}

console.log('\nReset concluido.');
