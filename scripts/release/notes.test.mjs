import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateReleaseNotes } from './notes.mjs';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

test('generateReleaseNotes uses the previous semver tag and commit subjects', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@smolpack/eslint-config',
        version: '1.1.0'
      })
    );
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'feature.txt'), 'feature\n');
    git(tempDir, ['add', 'feature.txt']);
    git(tempDir, ['commit', '-m', 'Improve release workflow']);

    const result = await generateReleaseNotes({
      cwd: tempDir,
      version: '1.1.0'
    });

    assert.equal(result.currentTag, 'v1.1.0');
    assert.equal(result.previousTag, 'v1.0.0');
    assert.match(result.notes, /# @smolpack\/eslint-config v1\.1\.0/u);
    assert.match(result.notes, /Changes since `v1\.0\.0`:/u);
    assert.match(result.notes, /- Improve release workflow/u);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
