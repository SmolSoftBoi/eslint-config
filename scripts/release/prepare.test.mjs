import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertTagDoesNotExist,
  restorePackageJson,
  rollbackReleaseCommitIfTagMissing
} from './prepare.mjs';

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

test('rollbackReleaseCommitIfTagMissing soft-resets the release commit before package restore', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-tag-failure-'));
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
    const originalHead = git(tempDir, ['rev-parse', 'HEAD']);

    await writeFile(packagePath, bumpedText);
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Release v1.1.0']);

    assert.equal(rollbackReleaseCommitIfTagMissing('v1.1.0', { cwd: tempDir }), true);
    assert.equal(git(tempDir, ['rev-parse', 'HEAD']), originalHead);

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

test('rollbackReleaseCommitIfTagMissing keeps the release commit when the tag exists', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-tag-present-'));
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
    git(tempDir, ['commit', '-m', 'Release v1.1.0']);
    const releaseHead = git(tempDir, ['rev-parse', 'HEAD']);
    git(tempDir, ['tag', 'v1.1.0']);

    assert.equal(rollbackReleaseCommitIfTagMissing('v1.1.0', { cwd: tempDir }), false);
    assert.equal(git(tempDir, ['rev-parse', 'HEAD']), releaseHead);
    assert.equal(git(tempDir, ['status', '--porcelain']), '');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('assertTagDoesNotExist rejects existing local tags', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-local-tag-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(path.join(tempDir, 'package.json'), '{}\n');
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.2.3']);

    assert.throws(
      () => assertTagDoesNotExist('v1.2.3', { cwd: tempDir }),
      /Tag v1\.2\.3 already exists\./u
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('assertTagDoesNotExist rejects existing origin tags', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-remote-tag-'));
  const remoteDir = path.join(tempDir, 'origin.git');
  const workDir = path.join(tempDir, 'work');

  try {
    await mkdir(workDir);
    git(tempDir, ['init', '--bare', remoteDir]);
    git(workDir, ['init']);
    git(workDir, ['config', 'user.email', 'test@example.com']);
    git(workDir, ['config', 'user.name', 'Release Test']);

    await writeFile(path.join(workDir, 'package.json'), '{}\n');
    git(workDir, ['add', 'package.json']);
    git(workDir, ['commit', '-m', 'Initial release']);
    git(workDir, ['tag', 'v1.2.3']);
    git(workDir, ['remote', 'add', 'origin', remoteDir]);
    git(workDir, ['push', 'origin', 'v1.2.3']);
    git(workDir, ['tag', '-d', 'v1.2.3']);

    assert.throws(
      () => assertTagDoesNotExist('v1.2.3', { cwd: workDir }),
      /Tag v1\.2\.3 already exists on origin\./u
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('assertTagDoesNotExist rejects unverifiable origin tags', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-prepare-missing-origin-'));

  try {
    git(tempDir, ['init']);

    assert.throws(
      () => assertTagDoesNotExist('v1.2.3', { cwd: tempDir }),
      /Unable to verify tags on origin\. Check remote access and try again\./u
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
