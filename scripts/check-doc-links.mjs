import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

const filesToScan = [
  path.join(repoRoot, 'docs'),
  path.join(repoRoot, 'obsidian-vault', 'Flow'),
];

function normalizeSlashes(p) {
  return p.replaceAll('\\', '/');
}

async function listMarkdownFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listMarkdownFiles(abs)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(abs);
  }
  return out;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function extractDocTargetsFromLine(line) {
  const targets = [];

  // Backticks: `docs/...`
  for (const m of line.matchAll(/`(docs\/[^`]+)`/g)) {
    targets.push(m[1]);
  }

  // Absolute Windows links used in markdown: (E:\...\docs\foo.md)
  // Keep it narrow: only the docs subtree, only inside parentheses.
  for (const m of line.matchAll(/\((E:\\[^)]+\\docs\\[^)]+)\)/g)) {
    targets.push(m[1]);
  }

  return targets;
}

function resolveTargetToFsPath(target) {
  if (target.startsWith('docs/')) {
    return path.join(repoRoot, target);
  }
  if (target.startsWith('E:\\')) {
    return target;
  }
  return null;
}

async function main() {
  const mdFiles = [];
  for (const base of filesToScan) {
    if (await pathExists(base)) mdFiles.push(...(await listMarkdownFiles(base)));
  }

  const broken = [];

  for (const file of mdFiles) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const targets = extractDocTargetsFromLine(line);
      for (const t of targets) {
        const resolved = resolveTargetToFsPath(t);
        if (!resolved) continue;
        // Strip trailing punctuation that sometimes sneaks inside backticks.
        const cleaned = resolved.replace(/[.,;:]+$/g, '');
        if (!(await pathExists(cleaned))) {
          broken.push({
            file,
            line: i + 1,
            target: t,
            resolved: cleaned,
            text: line.trim(),
          });
        }
      }
    }
  }

  if (broken.length === 0) {
    console.log('OK: no broken doc links found.');
    return;
  }

  console.log(`BROKEN: ${broken.length} doc link(s) are pointing to missing targets:\n`);
  for (const b of broken) {
    const rel = path.relative(repoRoot, b.file);
    console.log(`- ${normalizeSlashes(rel)}:${b.line} -> ${b.target}`);
    console.log(`  resolved: ${b.resolved}`);
    console.log(`  text: ${b.text}`);
  }
  process.exitCode = 1;
}

await main();

