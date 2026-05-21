import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { generateReleaseNotes, getPreviousReleaseTag, parseArgs } from './notes.mjs';

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

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@smolpack/eslint-config',
        version: '1.2.0'
      })
    );
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

    const result = await generateReleaseNotes({
      cwd: tempDir,
      version: '1.1.0'
    });

    assert.match(result.notes, /- Release 1\.1\.0/u);
    assert.doesNotMatch(result.notes, /- Release 1\.2\.0/u);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('parseArgs requires values for release notes options', () => {
  assert.throws(() => parseArgs(['--version']), /--version option requires a value/u);
  assert.throws(
    () => parseArgs(['--version', '--output', 'notes.md']),
    /--version option requires a value/u
  );
  assert.throws(() => parseArgs(['--output']), /--output option requires a value/u);
  assert.throws(
    () => parseArgs(['--output', '--version', '1.2.3']),
    /--output option requires a value/u
  );
});

test('parseArgs accepts supported release notes options', () => {
  assert.deepEqual(parseArgs(['1.2.3']), {
    outputPath: null,
    version: '1.2.3'
  });
  assert.deepEqual(parseArgs(['--version', '1.2.3']), {
    outputPath: null,
    version: '1.2.3'
  });
  assert.deepEqual(parseArgs(['--output', 'notes.md']), {
    outputPath: 'notes.md',
    version: null
  });
  assert.deepEqual(parseArgs(['1.2.3', '--output', 'notes.md']), {
    outputPath: 'notes.md',
    version: '1.2.3'
  });
});

test('parseArgs rejects unknown options and unexpected extra arguments', () => {
  assert.throws(() => parseArgs(['--outpu', 'notes.md']), /Unknown option --outpu\./u);
  assert.throws(() => parseArgs(['1.2.3', 'extra']), /Unexpected argument extra\./u);
});

test('notes module import is safe when process argv script path is unset', () => {
  const moduleUrl = pathToFileURL(path.resolve('scripts/release/notes.mjs')).href;

  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `process.argv[1] = undefined; await import(${JSON.stringify(moduleUrl)});`
    ],
    {
      encoding: 'utf8'
    }
  );
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

test('getPreviousReleaseTag preserves hyphenated prerelease identifiers', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'hyphenated-prerelease-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@smolpack/eslint-config',
        version: '1.1.0-alpha-b.3'
      })
    );
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'alpha-one.txt'), 'alpha-one\n');
    git(tempDir, ['add', 'alpha-one.txt']);
    git(tempDir, ['commit', '-m', 'First alpha-b prerelease']);
    git(tempDir, ['tag', 'v1.1.0-alpha-b.1']);

    await writeFile(path.join(tempDir, 'alpha-two.txt'), 'alpha-two\n');
    git(tempDir, ['add', 'alpha-two.txt']);
    git(tempDir, ['commit', '-m', 'Second alpha-b prerelease']);
    git(tempDir, ['tag', 'v1.1.0-alpha-b.2']);

    await writeFile(path.join(tempDir, 'alpha-three.txt'), 'alpha-three\n');
    git(tempDir, ['add', 'alpha-three.txt']);
    git(tempDir, ['commit', '-m', 'Third alpha-b prerelease']);

    const result = await generateReleaseNotes({
      cwd: tempDir,
      version: '1.1.0-alpha-b.3'
    });

    assert.equal(result.previousTag, 'v1.1.0-alpha-b.2');
    assert.match(result.notes, /- Third alpha-b prerelease/u);
    assert.doesNotMatch(result.notes, /- First alpha-b prerelease/u);
    assert.doesNotMatch(result.notes, /- Second alpha-b prerelease/u);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('generateReleaseNotes compares prerelease identifiers with ASCII ordering', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ascii-prerelease-notes-'));

  try {
    git(tempDir, ['init']);
    git(tempDir, ['config', 'user.email', 'test@example.com']);
    git(tempDir, ['config', 'user.name', 'Release Test']);

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@smolpack/eslint-config',
        version: '1.2.3-rc.2'
      })
    );
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Initial release']);
    git(tempDir, ['tag', 'v1.0.0']);

    await writeFile(path.join(tempDir, 'upper-prerelease.txt'), 'upper-prerelease\n');
    git(tempDir, ['add', 'upper-prerelease.txt']);
    git(tempDir, ['commit', '-m', 'Uppercase prerelease baseline']);
    git(tempDir, ['tag', 'v1.2.3-Z.1']);

    await writeFile(path.join(tempDir, 'next-rc.txt'), 'next-rc\n');
    git(tempDir, ['add', 'next-rc.txt']);
    git(tempDir, ['commit', '-m', 'Next release candidate']);

    const result = await generateReleaseNotes({
      cwd: tempDir,
      version: '1.2.3-rc.1'
    });

    assert.equal(result.previousTag, 'v1.2.3-Z.1');
    assert.match(result.notes, /- Next release candidate/u);
    assert.doesNotMatch(result.notes, /- Uppercase prerelease baseline/u);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
