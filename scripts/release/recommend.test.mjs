import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getReleaseVersionRecommendation } from './recommend.mjs';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

async function createReleaseRepo({ packageVersion = '1.0.2', tag = 'v1.0.2' } = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-recommend-'));

  git(tempDir, ['init']);
  git(tempDir, ['config', 'user.email', 'test@example.com']);
  git(tempDir, ['config', 'user.name', 'Release Test']);

  await writeFile(
    path.join(tempDir, 'package.json'),
    `${JSON.stringify({ name: '@smolpack/eslint-config', version: packageVersion }, null, 2)}\n`
  );
  git(tempDir, ['add', 'package.json']);
  git(tempDir, ['commit', '-m', 'Initial release']);

  if (tag) {
    git(tempDir, ['tag', tag]);
  }

  return tempDir;
}

async function writePackageJson(cwd, version) {
  await writeFile(
    path.join(cwd, 'package.json'),
    `${JSON.stringify({ name: '@smolpack/eslint-config', version }, null, 2)}\n`
  );
}

async function commitChange(cwd, { body = null, filename, subject }) {
  await writeFile(path.join(cwd, filename), `${subject}\n`);
  git(cwd, ['add', filename]);

  if (body) {
    git(cwd, ['commit', '-m', subject, '-m', body]);
    return;
  }

  git(cwd, ['commit', '-m', subject]);
}

test('getReleaseVersionRecommendation falls back to patch for non-conventional commits', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await commitChange(tempDir, {
      filename: 'release-workflow.txt',
      subject: 'Improve release workflow'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'patch');
    assert.equal(recommendation.recommendedVersion, '1.0.3');
    assert.equal(recommendation.sourceRange, 'v1.0.2..HEAD');
    assert.equal(recommendation.alternatives.patch, '1.0.3');
    assert.equal(recommendation.alternatives.minor, '1.1.0');
    assert.equal(recommendation.alternatives.major, '2.0.0');
    assert.equal(recommendation.alternatives.releaseCandidate, '1.0.3-rc.1');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation recommends minor for feat commits', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await commitChange(tempDir, {
      filename: 'feature.txt',
      subject: 'feat: add shared config'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'minor');
    assert.equal(recommendation.recommendedVersion, '1.1.0');
    assert.equal(recommendation.alternatives.releaseCandidate, '1.1.0-rc.1');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation describes no-tag history clearly', async () => {
  const tempDir = await createReleaseRepo({ packageVersion: '1.0.0', tag: null });

  try {
    await commitChange(tempDir, {
      filename: 'first-feature.txt',
      subject: 'feat: add first feature'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'minor');
    assert.equal(recommendation.recommendedVersion, '1.1.0');
    assert.equal(recommendation.sourceRange, 'HEAD');
    assert.match(recommendation.reason, /since the start of the repository history/u);
    assert.doesNotMatch(recommendation.reason, /current repository state/u);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation recommends major for bang breaking-change subjects', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await commitChange(tempDir, {
      filename: 'breaking-subject.txt',
      subject: 'feat!: remove legacy config'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'major');
    assert.equal(recommendation.recommendedVersion, '2.0.0');
    assert.equal(recommendation.alternatives.releaseCandidate, '2.0.0-rc.1');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation recommends major for BREAKING CHANGE messages', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await commitChange(tempDir, {
      body: 'BREAKING CHANGE: consumers must update their imports.',
      filename: 'breaking-body.txt',
      subject: 'refactor: simplify exports'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'major');
    assert.equal(recommendation.recommendedVersion, '2.0.0');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation increments existing release-candidate tags', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await commitChange(tempDir, {
      filename: 'rc-one.txt',
      subject: 'Prepare release candidate'
    });
    git(tempDir, ['tag', 'v1.0.3-rc.1']);

    await commitChange(tempDir, {
      filename: 'rc-two.txt',
      subject: 'Polish release candidate'
    });

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedVersion, '1.0.3');
    assert.equal(recommendation.sourceRange, 'v1.0.3-rc.1..HEAD');
    assert.equal(recommendation.alternatives.releaseCandidate, '1.0.3-rc.2');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('getReleaseVersionRecommendation finalises the latest release candidate before bumping patch', async () => {
  const tempDir = await createReleaseRepo();

  try {
    await writePackageJson(tempDir, '1.1.0-rc.1');
    git(tempDir, ['add', 'package.json']);
    git(tempDir, ['commit', '-m', 'Release v1.1.0-rc.1']);
    git(tempDir, ['tag', 'v1.1.0-rc.1']);

    const recommendation = await getReleaseVersionRecommendation({ cwd: tempDir });

    assert.equal(recommendation.recommendedBump, 'stable');
    assert.equal(recommendation.recommendedVersion, '1.1.0');
    assert.equal(recommendation.sourceRange, 'v1.1.0-rc.1..HEAD');
    assert.equal(recommendation.alternatives.patch, '1.1.1');
    assert.equal(recommendation.alternatives.releaseCandidate, '1.1.0-rc.2');
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
