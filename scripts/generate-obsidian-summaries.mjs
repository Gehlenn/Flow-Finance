import fs from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'obsidian-vault', 'imports.manifest.json');
const summariesRoot = path.join(repoRoot, 'obsidian-vault', 'Flow', 'Planning', 'Historical', 'Summaries');
const decoder = new TextDecoder('windows-1252');
const manualKeyPoints = {
  'GDD.md': [
    'Technical audit for v0.8.0 with critical flows validated.',
    'Scanner, dashboard, integrations, and UX were reviewed together.',
    'Hardening, security, and release readiness are the core themes.',
  ],
  'CONTRIBUTING.md': [
    'Code changes that affect architecture, data flow, or UI must update docs.',
    'docs:update keeps the README structure synchronized.',
    'Docs are treated as part of the change surface, not an afterthought.',
  ],
  'DEPLOYMENT.md': [
    'Covers quick start plus AWS, Render, and Railway deployment paths.',
    'Useful when you need environment setup or service-specific deployment steps.',
  ],
  'DEPLOYMENT_STATUS.md': [
    'Tracks the current deployment state and readiness of the environments.',
    'Good place to record whether a target is healthy, pending, or blocked.',
  ],
  'BUGLOG.md': [
    'Bug tracker for release-specific incidents and transition checkpoints.',
    'Useful for root cause notes, status, and fix evidence.',
  ],
  'PR_SUMMARY_0.9.6.md': [
    'Documents the UI simplification cycle and its validation evidence.',
    'Records the navigation, dashboard, and assistant changes shipped in 0.9.6.',
  ],
  'PR_CHECKLIST_SPRINT2_D1_D2.md': [
    'Release hygiene checklist for sprint validation.',
    'Keeps PR readiness and verification steps explicit.',
  ],
  'RELEASE_SUMMARY_v0.5.2v.md': [
    'Historical release summary for the v0.5.2v checkpoint.',
    'Useful as a traceable release reference.',
  ],
  'UI_SIMPLIFICACAO_CICLO_1.md': [
    'Navigation was simplified around the product core.',
    'Dashboard metrics and consultative AI copy were aligned with cash flow.',
    'Validation covered build, lint, unit tests, and targeted E2E checks.',
  ],
};

function resolvePath(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function titleize(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\.md$/i, '')
    .replace(/\b([a-z])/gi, (match) => match.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(text) {
  return text.replace(/^\uFEFF/, '');
}

function stripFrontmatter(text) {
  const normalized = normalizeText(text);
  if (!normalized.startsWith('---')) {
    return normalized;
  }
  const end = normalized.indexOf('\n---', 3);
  if (end === -1) {
    return normalized;
  }
  return normalized.slice(end + 4).trimStart();
}

function extractKeyPoints(text) {
  return [];
}

function deriveKeyPoints(entry, text) {
  const manual = manualKeyPoints[path.basename(entry.source)];
  if (manual) {
    return manual;
  }

  const lines = normalizeText(stripFrontmatter(text)).split(/\r?\n/);
  const bullets = [];
  let inBullets = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF|^ï»¿/, '').trim();
    if (!line) {
      if (inBullets && bullets.length >= 4) break;
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      inBullets = true;
      bullets.push(line.replace(/^[-*]\s+/, ''));
      if (bullets.length >= 4) break;
      continue;
    }
    if (!inBullets) {
      bullets.push(line);
      break;
    }
  }

  return bullets.length ? bullets : ['See the raw mirror for the full source note.'];
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeIfChanged(filePath, content) {
  try {
    const existing = await fs.readFile(filePath, 'utf8');
    if (existing === content) {
      return false;
    }
  } catch {
    // file does not exist yet
  }
  await ensureDir(filePath);
  await fs.writeFile(filePath, content, 'utf8');
  return true;
}

async function generateSummary(entry) {
  if (entry.mode !== 'copy') {
    return null;
  }

  const sourcePath = resolvePath(entry.source);
  try {
    await fs.access(sourcePath);
  } catch {
    return { targetPath: null, changed: false, status: 'missing', sourcePath };
  }

  const importedMirror = `[[Imported/${entry.target.replace(/^obsidian-vault\/Flow\/Imported\//, '').replace(/\\/g, '/')}|raw mirror]]`;
  const raw = decoder.decode(await fs.readFile(sourcePath));
  const keyPoints = deriveKeyPoints(entry, raw);
  const title = titleize(path.basename(entry.source));
  const targetPath = path.join(summariesRoot, `${path.basename(entry.source)}`);

  const content = `---
title: ${title}
tags:
  - flow-finance
  - planning
  - historical
  - summary
---

# ${title}

## Source

- ${importedMirror}

## Key Points

${keyPoints.map((point) => `- ${point}`).join('\n')}

## Decision

- Keep this note as historical reference material unless the topic is promoted back into active planning.

## Follow-up

- Review only when the related planning area changes.
`;

  const changed = await writeIfChanged(targetPath, content);
  return { targetPath, changed, status: changed ? 'wrote' : 'skipped' };
}

async function main() {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const results = [];

  for (const entry of manifest) {
    const result = await generateSummary(entry);
    if (result) {
      results.push(result);
    }
  }

  const indexLines = [
    '---',
    'title: Historical Summaries',
    'tags:',
    '  - flow-finance',
    '  - planning',
    '  - historical',
    '  - summary',
    '---',
    '',
    '# Historical Summaries',
    '',
    'Generated summaries for imported docs.',
    '',
  ];

  for (const result of results) {
    if (!result.targetPath) {
      continue;
    }
    const relative = path.relative(path.join(repoRoot, 'obsidian-vault', 'Flow'), result.targetPath).replace(/\\/g, '/');
    indexLines.push(`- [[${relative.replace(/\.md$/i, '')}]]`);
  }

  await writeIfChanged(path.join(summariesRoot, 'README.md'), `${indexLines.join('\n')}\n`);

  for (const result of results) {
    if (!result.targetPath) {
      console.log(`MISSING: ${path.relative(repoRoot, result.sourcePath)}`);
      continue;
    }
    console.log(`${result.changed ? 'WROTE' : 'SKIPPED'}: ${path.relative(repoRoot, result.targetPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
