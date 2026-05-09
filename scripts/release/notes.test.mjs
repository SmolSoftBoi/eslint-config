import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generateReleaseNotes, getPreviousReleaseTag } from './notes.mjs';

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

test('getPreviousReleaseTag uses the nearest lower tag when regenerating older release notes', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'older-release-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(path.join(tempDir, 'package.json'), '{}\n');
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'one-one.txt'), 'one-one\n');
    git(tempDir, ['add', 'one-one.txt']);
    git(tempDir, ['commit', '-m', 'Release 1.1.0']);
    git(tempDir, ['tag', 'v1.1.0']);

    await writeFile(path.join(tempDir, 'one-two.txt'), 'one-two\n');
    git(tempDir, ['add', 'one-two.txt']);
    git(tempDir, ['commit', '-m', 'Release 1.2.0']);
    git(tempDir, ['tag', 'v1.2.0']);

    assert.equal(
      getPreviousReleaseTag({
        currentTag: 'v1.1.0',
        cwd: tempDir
      }),
      'v1.0.0'
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getPreviousReleaseTag ignores prerelease tags for stable release baselines', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'stable-release-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(path.join(tempDir, 'package.json'), '{}\n');
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'rc.txt'), 'rc\n');
    git(tempDir, ['add', 'rc.txt']);
    git(tempDir, ['commit', '-m', 'Release candidate']);
    git(tempDir, ['tag', 'v1.1.0-rc.1']);

    assert.equal(
      getPreviousReleaseTag({
        currentTag: 'v1.1.0',
        cwd: tempDir
      }),
      'v1.0.0'
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getPreviousReleaseTag uses the nearest previous tag for prereleases', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'prerelease-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(path.join(tempDir, 'package.json'), '{}\n');
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'rc-one.txt'), 'rc-one\n');
    git(tempDir, ['add', 'rc-one.txt']);
    git(tempDir, ['commit', '-m', 'First release candidate']);
    git(tempDir, ['tag', 'v1.1.0-rc.1']);

    assert.equal(
      getPreviousReleaseTag({
        currentTag: 'v1.1.0-rc.2',
        cwd: tempDir
      }),
      'v1.1.0-rc.1'
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
