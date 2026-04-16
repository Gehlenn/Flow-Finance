import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function resolveJavaHome() {
  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
    return process.env.JAVA_HOME;
  }

  if (process.platform === 'win32') {
    const adoptiumRoot = 'C:\\Program Files\\Eclipse Adoptium';
    if (existsSync(adoptiumRoot)) {
      const candidates = readdirSync(adoptiumRoot)
        .filter((entry) => entry.startsWith('jdk-21'))
        .sort()
        .reverse();

      if (candidates.length > 0) {
        return path.join(adoptiumRoot, candidates[0]);
      }
    }
  }

  return process.env.JAVA_HOME || null;
}

const javaHome = resolveJavaHome();
const env = { ...process.env };

if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
}

const firebaseCli = path.resolve(process.cwd(), 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const vitestCli = path.resolve(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const vitestCommand = `\"${process.execPath}\" \"${vitestCli}\" run --config vitest.firestore.config.ts --maxWorkers=1 --pool=forks`;

const child = spawn(process.execPath, [
  firebaseCli,
  'emulators:exec',
  '--only',
  'firestore',
  '--project',
  'demo-flow-finance',
  vitestCommand,
], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

child.on('error', (error) => {
  console.error('[firestore-rules] Failed to launch emulator runner:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
