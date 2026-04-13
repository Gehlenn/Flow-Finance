import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { ensureDirectoryForFile } from '../../scripts/beta-testing-coordinator.mjs';

describe('beta-testing-coordinator', () => {
  it('creates nested directory for target file path', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-beta-'));
    const nestedFile = path.join(baseDir, '.planning', 'nested', 'beta.json');

    ensureDirectoryForFile(nestedFile);

    expect(fs.existsSync(path.dirname(nestedFile))).toBe(true);
  });
});
