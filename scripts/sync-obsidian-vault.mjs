import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'obsidian-vault', 'imports.manifest.json');

function resolvePath(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function syncEntry(entry) {
  const sourcePath = resolvePath(entry.source);
  const targetPath = resolvePath(entry.target);

  if (entry.mode === 'skip') {
    return { sourcePath, targetPath, status: 'skipped' };
  }

  try {
    await fs.access(sourcePath);
  } catch {
    return { sourcePath, targetPath, status: 'missing' };
  }

  const content = await fs.readFile(sourcePath, 'utf8');
  await ensureDir(targetPath);
  await fs.writeFile(targetPath, content, 'utf8');

  return { sourcePath, targetPath, status: 'copied' };
}

async function main() {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  const results = [];
  for (const entry of manifest) {
    results.push(await syncEntry(entry));
  }

  for (const result of results) {
    console.log(`${result.status.toUpperCase()}: ${path.relative(repoRoot, result.sourcePath)} -> ${path.relative(repoRoot, result.targetPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
