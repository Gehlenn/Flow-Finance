import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function resolveJavaHome() {
  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
    return process.env.JAVA_HOME;
  }

  const localJdkRoot = path.resolve(process.cwd(), '.tmp', 'jdk21');
  if (existsSync(localJdkRoot)) {
    const candidates = readdirSync(localJdkRoot)
      .filter((entry) => entry.startsWith('jdk-21') || entry.startsWith('jdk21'))
      .sort()
      .reverse();

    for (const candidate of candidates) {
      const candidateHome = path.join(localJdkRoot, candidate);
      if (existsSync(path.join(candidateHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) {
        return candidateHome;
      }
    }
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
  const javaBinPath = path.join(javaHome, 'bin');
  if (process.platform === 'win32') {
    const originalPath = env.Path || env.PATH || '';
    env.Path = `${javaBinPath}${path.delimiter}${originalPath}`;
    env.PATH = env.Path;
  } else {
    env.PATH = `${javaBinPath}${path.delimiter}${env.PATH || ''}`;
  }

  process.env.JAVA_HOME = env.JAVA_HOME;
  process.env.PATH = env.PATH;
  if (process.platform === 'win32') {
    process.env.Path = env.Path;
  }
}

const javaVersionCheck = spawnSync('java', ['-version'], {
  env,
  encoding: 'utf8',
});

if (javaVersionCheck.status !== 0) {
  process.stderr.write(`[firestore-rules] Failed to run java -version with prepared environment.\n${javaVersionCheck.stderr || javaVersionCheck.stdout || ''}\n`);
  process.exit(1);
}

const javaVersionOutput = `${javaVersionCheck.stdout || ''}\n${javaVersionCheck.stderr || ''}`;
const javaMajorMatch = /version "([1-9][0-9]*)/.exec(javaVersionOutput);
const javaMajorVersion = javaMajorMatch ? Number.parseInt(javaMajorMatch[1], 10) : NaN;

process.stderr.write(`[firestore-rules] Using JAVA_HOME=${javaHome || 'unset'}\n`);
process.stderr.write(`[firestore-rules] ${javaVersionOutput.split(/\r?\n/).filter(Boolean)[0] || 'java -version produced no output'}\n`);

if (!Number.isFinite(javaMajorVersion) || javaMajorVersion < 21) {
  process.stderr.write('[firestore-rules] Firestore emulator requires Java 21+.\n');
  process.exit(1);
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
