import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  getNpmDistTagForVersion,
  parseReleaseTag,
  resolveReleaseContext,
  validateReleaseFields
} from './core.mjs';

test('parseReleaseTag accepts stable and prerelease tags', () => {
  assert.deepEqual(parseReleaseTag('v1.2.3'), {
    tag: 'v1.2.3',
    version: '1.2.3'
  });

  assert.deepEqual(parseReleaseTag('v1.2.3-rc.1'), {
    tag: 'v1.2.3-rc.1',
    version: '1.2.3-rc.1'
  });
});

test('parseReleaseTag rejects non-semver tags', () => {
  assert.throws(() => parseReleaseTag('v1'), /does not match semver policy/u);
  assert.throws(() => parseReleaseTag('release-1.2.3'), /does not match semver policy/u);
});

test('validateReleaseFields rejects a package version mismatch', () => {
  assert.throws(
    () =>
      validateReleaseFields({
        packageName: '@smolpack/eslint-config',
        packageVersion: '1.2.3',
        releaseBody: 'Release notes',
        tag: 'v1.2.4'
      }),
    /Version mismatch/u
  );
});

test('validateReleaseFields rejects empty release notes when required', () => {
  assert.throws(
    () =>
      validateReleaseFields({
        packageName: '@smolpack/eslint-config',
        packageVersion: '1.2.3',
        releaseBody: '   ',
        tag: 'v1.2.3'
      }),
    /Release notes are required/u
  );
});

test('getNpmDistTagForVersion maps stable releases to latest and prereleases to next', () => {
  assert.equal(getNpmDistTagForVersion('1.2.3'), 'latest');
  assert.equal(getNpmDistTagForVersion('1.2.3-rc.1'), 'next');
});

test('resolveReleaseContext reads release event tag and body', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-event-'));
  const eventPath = path.join(tempDir, 'event.json');

  try {
    await writeFile(
      eventPath,
      JSON.stringify({
        release: {
          body: 'Human release notes',
          tag_name: 'v1.2.3'
        }
      })
    );

    assert.deepEqual(
      await resolveReleaseContext({
        eventName: 'release',
        eventPath
      }),
      {
        releaseBody: 'Human release notes',
        releaseNotesStatus: 'event payload',
        requireReleaseNotes: true,
        tag: 'v1.2.3'
      }
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test('resolveReleaseContext fetches GitHub Release notes for manual dispatch', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ options, url });
    return {
      ok: true,
      status: 200,
      async json() {
        return { body: 'Fetched release notes' };
      }
    };
  };

  const context = await resolveReleaseContext({
    eventName: 'workflow_dispatch',
    fetchImpl,
    ref: 'refs/tags/v1.2.3',
    repository: 'SmolSoftBoi/eslint-config',
    token: 'token'
  });

  assert.equal(context.tag, 'v1.2.3');
  assert.equal(context.releaseBody, 'Fetched release notes');
  assert.equal(context.requireReleaseNotes, true);
  assert.equal(context.releaseNotesStatus, 'fetched from GitHub Release');
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/SmolSoftBoi/eslint-config/releases/tags/v1.2.3'
  );
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
});

test('resolveReleaseContext only skips release-note lookup for manual override', async () => {
  const context = await resolveReleaseContext({
    eventName: 'workflow_dispatch',
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
    ref: 'refs/tags/v1.2.3-rc.1',
    repository: 'SmolSoftBoi/eslint-config',
    skipReleaseNotes: true,
    token: 'token'
  });

  assert.deepEqual(context, {
    releaseBody: '',
    releaseNotesStatus: 'skipped by manual override',
    requireReleaseNotes: false,
    tag: 'v1.2.3-rc.1'
  });
});
