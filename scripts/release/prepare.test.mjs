import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { restorePackageJson } from './prepare.mjs';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

test('restorePackageJson unstages and restores package.json', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-'));
  const packagePath = path.join(tempDir, 'package.json');
  const originalText = `${JSON.stringify({ name: 'test-package', version: '1.0.0' }, null, 2)}\n`;
  const bumpedText = `${JSON.stringify({ name: 'test-package', version: '1.1.0' }, null, 2)}\n`;

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(packagePath, originalText);
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);

    await writeFile(packagePath, bumpedText);
    git(tempDir, ['add', 'package.json']);

    await restorePackageJson({
      cwd: tempDir,
      originalText,
      packagePath
    });

    assert.equal(await readFile(packagePath, 'utf8'), originalText);
    assert.equal(git(tempDir, ['status', '--porcelain']), '');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
