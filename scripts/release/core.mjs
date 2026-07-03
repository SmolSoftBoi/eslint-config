import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const numericIdentifierPattern = /^[0-9]+$/u;

export const releaseTagPattern =
  /^v(?<version>[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;

export const versionPattern =
  /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function isReleaseVersion(version) {
  return typeof version === 'string' && versionPattern.test(version);
}

export function normalizeVersionInput(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Release version is required.');
  }

  const trimmed = value.trim();
  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed;
}

export function parseReleaseTag(tag) {
  if (typeof tag !== 'string' || !tag.trim()) {
    throw new Error('Release tag is required.');
  }

  const match = releaseTagPattern.exec(tag.trim());
  if (!match?.groups?.version) {
    throw new Error(
      `Release tag '${tag}' does not match semver policy (expected vMAJOR.MINOR.PATCH with optional prerelease, e.g. v1.2.3 or v1.2.3-rc.1).`
    );
  }

  return {
    tag: tag.trim(),
    version: match.groups.version
  };
}

function compareNumbers(left, right) {
  return Math.sign(left - right);
}

function compareAscii(left, right) {
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const characterComparison = compareNumbers(left.charCodeAt(index), right.charCodeAt(index));

    if (characterComparison !== 0) {
      return characterComparison;
    }
  }

  return compareNumbers(left.length, right.length);
}

export function parseComparableReleaseVersion(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Release version is required.');
  }

  const trimmed = value.trim();
  const normalizedVersion = trimmed.startsWith('v') ? parseReleaseTag(trimmed).version : trimmed;

  if (!isReleaseVersion(normalizedVersion)) {
    throw new Error(`Release version '${value}' is invalid.`);
  }

  const prereleaseStartIndex = normalizedVersion.indexOf('-');
  const coreVersion =
    prereleaseStartIndex === -1
      ? normalizedVersion
      : normalizedVersion.slice(0, prereleaseStartIndex);
  const prereleaseVersion =
    prereleaseStartIndex === -1 ? '' : normalizedVersion.slice(prereleaseStartIndex + 1);
  const [major, minor, patch] = coreVersion.split('.').map(Number);

  return {
    coreVersion,
    major,
    minor,
    patch,
    prerelease: prereleaseVersion ? prereleaseVersion.split('.') : [],
    version: normalizedVersion
  };
}

export function parseComparableReleaseTag(tag) {
  const parsedTag = parseReleaseTag(tag);
  return {
    ...parseComparableReleaseVersion(parsedTag.version),
    tag: parsedTag.tag
  };
}

function comparePrereleaseIdentifiers(left, right) {
  const leftIsNumeric = numericIdentifierPattern.test(left);
  const rightIsNumeric = numericIdentifierPattern.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return compareNumbers(Number(left), Number(right));
  }

  if (leftIsNumeric) {
    return -1;
  }

  if (rightIsNumeric) {
    return 1;
  }

  return compareAscii(left, right);
}

export function compareParsedReleaseVersions(left, right) {
  const coreComparison =
    compareNumbers(left.major, right.major) ||
    compareNumbers(left.minor, right.minor) ||
    compareNumbers(left.patch, right.patch);

  if (coreComparison !== 0) {
    return coreComparison;
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }

    if (rightIdentifier === undefined) {
      return 1;
    }

    const identifierComparison = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (identifierComparison !== 0) {
      return identifierComparison;
    }
  }

  return 0;
}

export function isStableReleaseVersion(parsedVersion) {
  return parsedVersion.prerelease.length === 0;
}

export function getSemverReleaseTags({ cwd = process.cwd(), run } = {}) {
  if (typeof run !== 'function') {
    throw new Error('A git runner is required to list release tags.');
  }

  const output = run(['tag', '--list', 'v*'], cwd);
  return output
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      try {
        return parseComparableReleaseTag(tag);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => compareParsedReleaseVersions(right, left))
    .map(({ tag }) => tag);
}

export function getNpmDistTagForVersion(version) {
  if (!isReleaseVersion(version)) {
    throw new Error(`Package version '${version}' is not a valid release version.`);
  }

  return version.includes('-') ? 'next' : 'latest';
}

export function getNpmAccessForPackage(packageName) {
  return typeof packageName === 'string' && packageName.startsWith('@') ? 'public' : '';
}

export function validateReleaseFields({
  packageName,
  packageVersion,
  releaseBody,
  requireReleaseNotes = true,
  tag
}) {
  const parsedTag = parseReleaseTag(tag);

  if (packageVersion !== parsedTag.version) {
    throw new Error(
      `Version mismatch: package.json has ${packageVersion} but release tag is ${parsedTag.tag} (expected v${packageVersion}).`
    );
  }

  if (requireReleaseNotes && !String(releaseBody ?? '').trim()) {
    throw new Error('Release notes are required (GitHub Release body is empty/whitespace).');
  }

  const npmDistTag = getNpmDistTagForVersion(packageVersion);
  const npmAccess = getNpmAccessForPackage(packageName);

  return {
    packageName,
    tag: parsedTag.tag,
    version: packageVersion,
    npmDistTag,
    npmAccess,
    releaseNotesStatus: requireReleaseNotes ? 'validated' : 'skipped'
  };
}

export async function loadPackageJson(cwd = process.cwd()) {
  const filePath = path.join(cwd, 'package.json');
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function readReleaseEvent(eventPath) {
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is required for release event validation.');
  }

  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  return {
    tag: event.release?.tag_name ?? '',
    body: event.release?.body ?? ''
  };
}

export async function fetchGitHubReleaseBody({
  fetchImpl = globalThis.fetch,
  repository,
  tag,
  token
}) {
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required to fetch release notes for manual publish.');
  }

  if (!token) {
    throw new Error('GITHUB_TOKEN is required to fetch release notes for manual publish.');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to fetch GitHub release notes.');
  }

  const apiUrl = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  const response = await fetchImpl(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2026-03-10'
    }
  });

  if (response.status === 404) {
    throw new Error(
      `No GitHub Release was found for tag '${tag}'. Create a release for this tag before publishing.`
    );
  }

  if (!response.ok) {
    const responseText = typeof response.text === 'function' ? await response.text() : '';
    throw new Error(
      `Failed to fetch GitHub Release for tag '${tag}'. HTTP status: ${response.status}${
        responseText ? `; response: ${responseText}` : ''
      }`
    );
  }

  const release = await response.json();
  return release.body ?? '';
}

export async function resolveReleaseContext({
  eventName = process.env.GITHUB_EVENT_NAME,
  eventPath = process.env.GITHUB_EVENT_PATH,
  fetchImpl = globalThis.fetch,
  ref = process.env.GITHUB_REF,
  repository = process.env.GITHUB_REPOSITORY,
  skipReleaseNotes = false,
  tag,
  token = process.env.GITHUB_TOKEN
} = {}) {
  if (tag) {
    if (!skipReleaseNotes) {
      throw new Error(
        'Explicit --tag validation does not fetch GitHub Release notes. Re-run with --skip-release-notes after manually verifying release notes, or validate from a release/workflow_dispatch event.'
      );
    }

    return {
      tag,
      releaseBody: '',
      requireReleaseNotes: false,
      releaseNotesStatus: 'skipped by explicit tag override'
    };
  }

  if (eventName === 'release') {
    const release = await readReleaseEvent(eventPath);
    return {
      tag: release.tag,
      releaseBody: release.body,
      requireReleaseNotes: true,
      releaseNotesStatus: 'event payload'
    };
  }

  if (eventName === 'workflow_dispatch') {
    if (!ref?.startsWith('refs/tags/')) {
      throw new Error(
        'Manual publish must run on a semver tag ref. In GitHub Actions, use the workflow selector to choose the desired tag before running the workflow.'
      );
    }

    const manualTag = ref.slice('refs/tags/'.length);
    if (skipReleaseNotes) {
      return {
        tag: manualTag,
        releaseBody: '',
        requireReleaseNotes: false,
        releaseNotesStatus: 'skipped by manual override'
      };
    }

    return {
      tag: manualTag,
      releaseBody: await fetchGitHubReleaseBody({
        fetchImpl,
        repository,
        tag: manualTag,
        token
      }),
      requireReleaseNotes: true,
      releaseNotesStatus: 'fetched from GitHub Release'
    };
  }

  throw new Error(`Unsupported release validation event '${eventName ?? '<unset>'}'.`);
}

export function formatPublishCommand({ npmAccess, npmDistTag, dryRun = false }) {
  const args = ['npm publish'];

  if (npmAccess) {
    args.push(`--access ${npmAccess}`);
  }

  args.push(`--tag ${npmDistTag}`, '--provenance');

  if (dryRun) {
    args.push('--dry-run');
  }

  return args.join(' ');
}

export function formatValidationSummary(result) {
  const dryRunCommand = formatPublishCommand({ ...result, dryRun: true });
  const publishCommand = formatPublishCommand(result);

  return [
    '## Release validation',
    '',
    `- Package: \`${result.packageName}\``,
    `- Version: \`${result.version}\``,
    `- Tag: \`${result.tag}\``,
    `- npm dist-tag: \`${result.npmDistTag}\``,
    `- Release notes: ${result.releaseNotesStatus}`,
    `- Validation: ${result.validationStatus ?? 'passed'}`,
    `- Dry-run command: \`${dryRunCommand}\``,
    `- Publish command: \`${publishCommand}\``,
    ''
  ].join('\n');
}

export async function appendGitHubOutput(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) {
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value ?? ''}`);
  await appendFile(outputPath, `${lines.join('\n')}\n`);
}

export async function appendGitHubSummary(summary, summaryPath = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryPath) {
    return;
  }

  await appendFile(summaryPath, summary);
}
