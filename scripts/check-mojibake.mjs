import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

// Scan the whole repository, but skip heavy/generated directories.
const roots = [repoRoot];

const ignoredDirNames = new Set([
  '.git',
  '.vercel',
  '.firebase',
  '.tmp',
  '.tmp-gh-run-download',
  '.logs',
  '.worktrees',
  '.planning',
  'node_modules',
  'build',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'qa-reports',
]);

const textExtensions = new Set([
  '.md',
  '.yaml',
  '.yml',
  '.xml',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.json',
]);

// Conservative mojibake detection.
//
// Typical signals:
// - "acao" intended as "acao" is fine; but "acao" intended as "acao" doesn't show.
// - "acao" intended as "acao" isn't relevant.
// - Real mojibake examples:
//   - "ação" -> "aÃ§Ã£o"
//   - "—" -> "â€”"
//   - "“" -> "â€œ"
//
// We flag:
// - 'Ã' followed by U+0080..U+00BF (common for broken accented letters: Ã©, Ã£, Ã§, ...)
// - 'â'/'Â' followed by U+0080..U+00BF (common for broken quotes/dashes/nbsp)
const patterns = [
  /Ã[\u0080-\u00BF]/,
  /â[\u0080-\u00BF]/,
  /Â[\u0080-\u00BF]/,
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRec(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirNames.has(entry.name)) continue;
      out.push(...(await listFilesRec(abs)));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (textExtensions.has(ext)) out.push(abs);
  }
  return out;
}

function normalizeSlashes(p) {
  return p.replaceAll('\\', '/');
}

function findFirstPattern(line) {
  for (const p of patterns) {
    const m = line.match(p);
    if (m) return m[0];
  }
  return null;
}

async function main() {
  const files = [];
  for (const r of roots) {
    if (await pathExists(r)) files.push(...(await listFilesRec(r)));
  }

  const hits = [];

  for (const f of files) {
    // This file intentionally contains mojibake examples in comments.
    if (path.resolve(f) === path.resolve(path.join(repoRoot, 'scripts', 'check-mojibake.mjs'))) {
      continue;
    }
    let content = '';
    try {
      content = await fs.readFile(f, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const p = findFirstPattern(line);
      if (!p) continue;
      hits.push({
        file: f,
        line: i + 1,
        pattern: p,
        text: line.trim().slice(0, 240),
      });
      if (hits.length >= 200) break;
    }
    if (hits.length >= 200) break;
  }

  if (hits.length === 0) {
    console.log('OK: no mojibake patterns found.');
    return;
  }

  console.log(`MOJIBAKE: found ${hits.length} hit(s) (showing up to 200):\n`);
  for (const h of hits) {
    const rel = normalizeSlashes(path.relative(repoRoot, h.file));
    console.log(`- ${rel}:${h.line} contains '${h.pattern}'`);
    console.log(`  ${h.text}`);
  }
  process.exitCode = 1;
}

await main();

