import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readText(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relPath));
}

describe('E2E matrix gate', () => {
  it('provides a stable validate:e2e:matrix script (with dry-run support)', () => {
    expect(exists('scripts/validate-e2e-matrix.mjs')).toBe(true);

    const pkg = JSON.parse(readText('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['validate:e2e:matrix']).toBe('node scripts/validate-e2e-matrix.mjs');
    expect(pkg.scripts?.['validate:e2e:matrix:dry']).toBe('node scripts/validate-e2e-matrix.mjs --dry-run');
  });

  it('keeps Playwright project names aligned with the validated matrix', () => {
    const config = readText('playwright.config.ts');

    expect(config).toContain("name: 'chromium'");
    expect(config).toContain("name: 'firefox'");
    expect(config).toContain("name: 'webkit'");
    expect(config).toContain("name: 'Mobile Chrome'");
    expect(config).toContain("name: 'Mobile Safari'");
  });

  it('wires the matrix into CI (GitHub Actions)', () => {
    const workflow = readText('.github/workflows/tests.yml');

    expect(workflow).toContain('e2e-matrix:');
    expect(workflow).toContain('matrix:');
    expect(workflow).toContain('- chromium');
    expect(workflow).toContain('- firefox');
    expect(workflow).toContain('- webkit');
    expect(workflow).toContain('- Mobile Chrome');
    expect(workflow).toContain('- Mobile Safari');
    expect(workflow).toContain('npm run validate:e2e:matrix');
  });
});

