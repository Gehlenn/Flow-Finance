import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();

const ignoredFiles = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

const secretPatterns = [
  { name: 'OpenAI key', regex: /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/g },
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: 'JWT-like token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
];

const allowedSnippets = [
  'your_openai_api_key_here',
  'your_gemini_api_key_here',
  'sk_test_xxx',
  'whsec_xxx',
  'price_xxx',
  'your-super-secret-jwt-key',
  'your_jwt_secret',
  'your_firebase',
  'VERCEL_OIDC_TOKEN=""',
  '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----',
  'YOUR_PRIVATE_KEY_CONTENT',
  '<GENERATE_STRONG_SECRET>',
  '<webhook_secret>',
  '<segredo_compartilhado>',
];

function shouldIgnoreFile(relPath) {
  const base = path.basename(relPath);
  if (ignoredFiles.has(base)) {
    return true;
  }

  const normalized = relPath.replace(/\\/g, '/');

  if (
    normalized.startsWith('docs/')
    || normalized.startsWith('tests/')
    || normalized.endsWith('.example')
    || normalized.includes('/dist/')
    || normalized.includes('/coverage/')
  ) {
    return true;
  }

  return false;
}

function listTrackedFiles() {
  const result = spawnSync('git', ['ls-files'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    console.error('Nao foi possivel listar arquivos rastreados pelo git.');
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((relPath) => !shouldIgnoreFile(relPath));
}

function isAllowedMatch(line) {
  return allowedSnippets.some((snippet) => line.includes(snippet));
}

const files = listTrackedFiles();
const findings = [];

for (const relPath of files) {
  const fullPath = path.resolve(rootDir, relPath);
  let content;

  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isAllowedMatch(line)) {
      continue;
    }

    if (line.includes('-----BEGIN PRIVATE KEY-----') && (line.includes('...') || line.includes('YOUR_PRIVATE_KEY'))) {
      continue;
    }

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: relPath,
          line: index + 1,
          pattern: pattern.name,
          sample: line.trim().slice(0, 140),
        });
      }
      pattern.regex.lastIndex = 0;
    }
  }
}

if (findings.length === 0) {
  console.log('Secret scan passed: no suspicious values found.');
  process.exit(0);
}

console.error(`Secret scan failed: ${findings.length} potential secret(s) found.`);
for (const finding of findings) {
  console.error(`- ${finding.file}:${finding.line} [${finding.pattern}] ${finding.sample}`);
}

process.exit(1);
