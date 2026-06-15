import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildClaimsPayload,
  buildMarkdown,
  evaluateClaimLine,
  evaluateClaimText,
  hasCaveatBoundary,
} from '../../scripts/check-audit-claims.mjs';

describe('check-audit-claims', () => {
  it('blocks uncaveated retention, AI, conversion, production and investment claims', () => {
    const lines = [
      'A retencao comprovada prova o produto.',
      'IA validada por usuarios reais.',
      'Conversao comprovada no funil pago.',
      'SaaS pronto para escala comercial ampla.',
      'Eu investiria nesse SaaS.',
    ];

    const ids = lines.flatMap((line) => evaluateClaimLine(line).map((violation) => violation.id));

    expect(ids).toEqual([
      'retention_proven',
      'ai_user_validated',
      'paid_conversion_proven',
      'commercial_scale_ready',
      'investment_claim',
    ]);
  });

  it('allows honest caveats and pilot-only language', () => {
    const lines = [
      'SEM EVIDENCIA SUFICIENTE para retencao comprovada.',
      'O gate tecnico fechado nao prova retencao comercial.',
      'IA quality offline nao prova qualidade percebida.',
      'Pronto para piloto privado controlado; nao pronto para escala comercial ampla.',
      'Eu nao investiria como SaaS pronto para escala agora.',
    ];

    expect(lines.flatMap((line) => evaluateClaimLine(line))).toEqual([]);
    expect(hasCaveatBoundary(lines[0])).toBe(true);
  });

  it('returns file and line evidence for violations', () => {
    const violations = evaluateClaimText([
      '# Test',
      '',
      'Retencao comprovada e conversao comprovada.',
    ].join('\n'), 'docs/test.md');

    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatchObject({
      file: 'docs/test.md',
      line: 3,
      severity: 'P1',
    });
  });

  it('scans active docs and ignores docs/archive', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-claims-'));
    const docsDir = path.join(tempDir, 'docs');
    await fs.mkdir(path.join(docsDir, 'archive'), { recursive: true });
    await fs.writeFile(path.join(docsDir, 'active.md'), 'Retencao comprovada.\n', 'utf8');
    await fs.writeFile(path.join(docsDir, 'archive', 'old.md'), 'SaaS pronto para escala comercial ampla.\n', 'utf8');

    const previousCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const payload = await buildClaimsPayload({ docsDir });
      expect(payload.result.status).toBe('BLOCK');
      expect(payload.result.scannedFiles).toBe(1);
      expect(payload.result.violationCount).toBe(1);
      expect(payload.result.violations[0].file).toBe('docs/active.md');
    } finally {
      process.chdir(previousCwd);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('renders markdown with non-proof caveats', () => {
    const markdown = buildMarkdown({
      runnerName: 'test',
      timestamp: '2026-06-15T00:00:00.000Z',
      scannedRoot: 'docs',
      result: {
        status: 'PASS',
        summary: 'PASS',
        scannedFiles: 1,
        violationCount: 0,
        violations: [],
      },
      policy: {
        blockedClaimIds: ['retention_proven'],
        allowedBoundaries: ['SEM EVIDENCIA SUFICIENTE'],
      },
    });

    expect(markdown).toContain('What this report does not prove');
    expect(markdown).toContain('It only prevents active audit documentation from overstating the current evidence.');
  });
});
