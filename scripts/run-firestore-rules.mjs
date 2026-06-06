import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

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

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error('Failed to reserve Firestore emulator port'));
          return;
        }

        resolve(port);
      });
    });
  });
}

function writeTemporaryFirebaseConfig(port) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'flow-firestore-rules-'));
  const configPath = path.join(tempDir, 'firebase.json');
  writeFileSync(configPath, JSON.stringify({
    firestore: {
      rules: path.resolve(process.cwd(), 'firestore.rules'),
    },
    emulators: {
      firestore: {
        host: '127.0.0.1',
        port,
      },
      ui: {
        enabled: false,
      },
      singleProjectMode: true,
    },
  }, null, 2));
  return configPath;
}

const javaHome = resolveJavaHome();
const env = { ...process.env };

if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
}

const firebaseCli = path.resolve(process.cwd(), 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const vitestCli = path.resolve(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
const vitestCommand = `"${process.execPath}" "${vitestCli}" run --config vitest.firestore.config.ts --maxWorkers=1 --pool=forks`;
const firestorePort = await reservePort();
const firebaseConfig = writeTemporaryFirebaseConfig(firestorePort);

const child = spawn(process.execPath, [
  firebaseCli,
  'emulators:exec',
  '--config',
  firebaseConfig,
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
  process.stderr.write(`[firestore-rules] Failed to launch emulator runner: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
