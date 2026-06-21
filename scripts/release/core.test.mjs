import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  getSemverReleaseTags,
  getNpmDistTagForVersion,
  parseReleaseTag,
  resolveReleaseContext,
  validateReleaseFields
} from './core.mjs';
import { parseArgs } from './validate.mjs';

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

test('getSemverReleaseTags filters and sorts release tags by semver precedence', () => {
  assert.deepEqual(
    getSemverReleaseTags({
      run: () =>
        [
          'v1.0.0',
          'not-a-release',
          'v1.0.2-rc.1',
          'v1.0.10',
          'v1.0.2',
          'v1.0.2-rc.2'
        ].join('\n')
    }),
    ['v1.0.10', 'v1.0.2', 'v1.0.2-rc.2', 'v1.0.2-rc.1', 'v1.0.0']
  );
});

test('parseArgs accepts both release validation tag forms', () => {
  assert.deepEqual(parseArgs(['--tag=v1.2.3', '--skip-release-notes']), {
    skipReleaseNotes: true,
    tag: 'v1.2.3'
  });

  assert.deepEqual(parseArgs(['--tag', 'v1.2.3-rc.1', '--skip-release-notes']), {
    skipReleaseNotes: true,
    tag: 'v1.2.3-rc.1'
  });
});

test('parseArgs rejects --tag without a value', () => {
  assert.throws(() => parseArgs(['--tag']), /--tag option requires a value/u);
  assert.throws(() => parseArgs(['--tag=']), /--tag option requires a value/u);
});

test('resolveReleaseContext fails fast for explicit tag validation without release-note skip', async () => {
  await assert.rejects(
    () =>
      resolveReleaseContext({
        eventName: 'workflow_dispatch',
        ref: 'refs/tags/v1.2.3',
        tag: 'v1.2.3'
      }),
    /Explicit --tag validation does not fetch GitHub Release notes/u
  );
});

test('resolveReleaseContext supports explicit tag validation when release notes are skipped', async () => {
  assert.deepEqual(
    await resolveReleaseContext({
      skipReleaseNotes: true,
      tag: 'v1.2.3'
    }),
    {
      releaseBody: '',
      releaseNotesStatus: 'skipped by explicit tag override',
      requireReleaseNotes: false,
      tag: 'v1.2.3'
    }
  );
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
  assert.equal(calls[0].options.headers['X-GitHub-Api-Version'], '2026-03-10');
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
