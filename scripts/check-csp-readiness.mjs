#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve(process.cwd(), 'test-results/csp-readiness');
const sourceRoots = [
  'App.tsx',
  'index.html',
  'public',
  'src',
  'components',
  'pages',
  'hooks',
  'services',
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.html']);
const stylePatterns = [
  { name: 'react-style-prop', pattern: 'style={{' },
  { name: 'dangerous-style-tag', pattern: '<style dangerouslySetInnerHTML' },
  { name: 'style-cssText', pattern: '.style.cssText' },
  { name: 'style-attribute-mutation', pattern: '.style.' },
  { name: 'inline-style-html', pattern: 'style="' },
];
const scriptPatterns = [
  { name: 'inline-script-tag', pattern: '<script>' },
  { name: 'script-importmap', pattern: 'type="importmap"' },
  { name: 'inline-event-handler', pattern: 'onclick="' },
  { name: 'inline-event-handler', pattern: 'onmouseover="' },
  { name: 'inline-event-handler', pattern: 'onmouseout="' },
];

function safeTimestamp(now = new Date()) {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-');
}

function walkFiles(entry) {
  const absolute = path.resolve(process.cwd(), entry);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    return sourceExtensions.has(path.extname(absolute)) ? [absolute] : [];
  }

  const files = [];
  for (const child of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (child.name === 'node_modules' || child.name === 'dist' || child.name === '.tmp') {
      continue;
    }
    const childPath = path.join(absolute, child.name);
    if (child.isDirectory()) {
      files.push(...walkFiles(childPath));
      continue;
    }
    if (child.isFile() && sourceExtensions.has(path.extname(child.name))) {
      files.push(childPath);
    }
  }
  return files;
}

function lineHits(filePath, patterns) {
  const text = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const hits = [];

  text.split(/\r?\n/).forEach((line, index) => {
    for (const item of patterns) {
      if (line.includes(item.pattern)) {
        hits.push({
          file: relativePath,
          line: index + 1,
          type: item.name,
          snippet: line.trim().slice(0, 180),
        });
      }
    }
  });

  return hits;
}

function parseCspDirectives() {
  const vercelPath = path.resolve(process.cwd(), 'vercel.json');
  const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const cspValues = [];

  for (const headerBlock of parsed.headers || []) {
    for (const header of headerBlock.headers || []) {
      if (String(header.key).toLowerCase() === 'content-security-policy') {
        cspValues.push(String(header.value || ''));
      }
    }
  }

  return cspValues.map((value) => {
    const directives = {};
    for (const part of value.split(';')) {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;
      const [name, ...sources] = tokens;
      directives[name] = sources;
    }
    return directives;
  });
}

function writeArtifact(output) {
  fs.mkdirSync(outputDir, { recursive: true });
  const runId = safeTimestamp();
  const jsonPath = path.join(outputDir, `${runId}.json`);
  const mdPath = path.join(outputDir, `${runId}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const lines = [
    '# CSP readiness evidence',
    '',
    `- status: ${output.status}`,
    `- scriptCspReady: ${output.scriptCspReady}`,
    `- styleCspReady: ${output.styleCspReady}`,
    `- scriptBlockers: ${output.scriptBlockers.length}`,
    `- styleBlockers: ${output.styleBlockers.length}`,
    '',
    '## Summary',
    '',
    ...output.summary.map((line) => `- ${line}`),
    '',
    '## Top Style Blockers',
    '',
    '| file | line | type | snippet |',
    '| --- | ---: | --- | --- |',
    ...output.styleBlockers.slice(0, 25).map((hit) => (
      `| ${hit.file} | ${hit.line} | ${hit.type} | ${hit.snippet.replace(/\|/g, '\\|')} |`
    )),
    '',
  ];

  fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');

  return {
    json: path.relative(process.cwd(), jsonPath),
    md: path.relative(process.cwd(), mdPath),
  };
}

function main() {
  const files = [...new Set(sourceRoots.flatMap(walkFiles))].sort();
  const styleBlockers = files.flatMap((file) => lineHits(file, stylePatterns));
  const scriptBlockers = files.flatMap((file) => lineHits(file, scriptPatterns));
  const cspDirectives = parseCspDirectives();
  const scriptCspReady = cspDirectives.length > 0 && cspDirectives.every((directives) => {
    const scriptSrc = directives['script-src'] || [];
    return scriptSrc.includes("'self'") && !scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes('https://esm.sh');
  });
  const styleCspReady = cspDirectives.length > 0 && cspDirectives.every((directives) => {
    const styleSrc = directives['style-src'] || [];
    return styleSrc.length > 0 && !styleSrc.includes("'unsafe-inline'");
  }) && styleBlockers.length === 0;

  const output = {
    status: scriptCspReady && styleCspReady && scriptBlockers.length === 0 ? 'PASS' : 'BLOCK',
    scriptCspReady,
    styleCspReady,
    scannedFiles: files.length,
    scriptBlockers,
    styleBlockers,
    cspDirectives,
    summary: [
      scriptCspReady
        ? 'Frontend script CSP is ready: script-src is self-only and does not allow unsafe-inline or esm.sh.'
        : 'Frontend script CSP is not ready.',
      styleCspReady
        ? 'Frontend style CSP is ready for removing unsafe-inline.'
        : 'Frontend style CSP is not ready: inline style surfaces or style-src unsafe-inline remain.',
    ],
  };

  output.artifact = writeArtifact(output);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(output.status === 'PASS' ? 0 : 1);
}

main();
