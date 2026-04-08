import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const ignoredDirs = new Set(['node_modules', 'coverage', 'dist', '.git', '.vercel']);
const defaultExcludedPatterns = [
  'tests/e2e/',
  'integration',
  'tests/firestore/firestore.rules.emulator.test.ts',
  'tests/unit/api-storage-provider.test.ts',
  'tests/unit/backend-controllers.test.ts',
  'tests/unit/backend-oauth.test.ts',
];
const isolatedTestFiles = new Set([
  'tests/unit/ai-control-panel-viewers.test.tsx',
]);

function collectTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        results.push(...collectTestFiles(fullPath));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.test\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    const relativePath = path.relative(projectRoot, fullPath).split(path.sep).join('/');
    if (defaultExcludedPatterns.some((pattern) => relativePath.includes(pattern))) {
      continue;
    }

    results.push(relativePath);
  }

  return results;
}

function splitIntoChunks(items, chunkCount) {
  const chunks = [];
  const baseSize = Math.floor(items.length / chunkCount);
  const remainder = items.length % chunkCount;
  let cursor = 0;

  for (let index = 0; index < chunkCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const chunk = items.slice(cursor, cursor + size);
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    cursor += size;
  }

  return chunks;
}

function runVitestChunk(files, index, total) {
  console.log(`[vitest-stable] Running chunk ${index + 1}/${total} with ${files.length} files`);

  const result = spawnSync(
    npxCommand,
    ['vitest', 'run', ...files, '--maxWorkers=1', '--silent=true'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    }
  );

  if (typeof result.status === 'number' && result.status !== 0) {
    return result.status;
  }

  if (typeof result.signal === 'string') {
    console.error(`[vitest-stable] Chunk ${index + 1} exited with signal ${result.signal}`);
    return 1;
  }

  return 0;
}

const allTestFiles = collectTestFiles(projectRoot).sort();

if (allTestFiles.length === 0) {
  console.error('[vitest-stable] No test files found.');
  process.exit(1);
}

const isolatedChunks = allTestFiles
  .filter((file) => isolatedTestFiles.has(file))
  .map((file) => [file]);
const remainingFiles = allTestFiles.filter((file) => !isolatedTestFiles.has(file));

const chunkCount = Number(process.env.VITEST_STABLE_CHUNKS || '4');
const regularChunks = splitIntoChunks(remainingFiles, Math.max(1, chunkCount));
const chunks = [...regularChunks, ...isolatedChunks];

for (let index = 0; index < chunks.length; index += 1) {
  const exitCode = runVitestChunk(chunks[index], index, chunks.length);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

console.log(`[vitest-stable] Completed ${allTestFiles.length} test files across ${chunks.length} chunk(s).`);
