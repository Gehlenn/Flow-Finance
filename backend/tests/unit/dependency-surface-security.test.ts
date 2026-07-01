import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(currentFile), '../..');
const packageJsonPath = path.join(backendRoot, 'package.json');
const runtimeRoots = [
  path.join(backendRoot, 'src'),
  path.join(backendRoot, 'scripts'),
];

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const uploadRuntimePattern =
  /\b(from\s+['"]multer['"]|require\(['"]multer['"]\)|multer\s*\(|upload\.(single|array|fields)\s*\(|busboy|multipart\/form-data)\b/i;

function readPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
}

function collectRuntimeFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRuntimeFiles(absolutePath);
    }

    if (!/\.(cjs|mjs|js|ts|tsx)$/.test(entry.name)) {
      return [];
    }

    return [absolutePath];
  });
}

describe('backend upload dependency surface', () => {
  it('does not ship multer while no backend route consumes multipart uploads', () => {
    const packageJson = readPackageJson();

    expect(packageJson.dependencies?.multer).toBeUndefined();
    expect(packageJson.devDependencies?.['@types/multer']).toBeUndefined();

    const uploadParserReferences = runtimeRoots
      .flatMap(collectRuntimeFiles)
      .filter((filePath) => uploadRuntimePattern.test(fs.readFileSync(filePath, 'utf8')))
      .map((filePath) => path.relative(backendRoot, filePath));

    expect(uploadParserReferences).toEqual([]);
  });
});
