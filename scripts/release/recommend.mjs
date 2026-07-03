import { execFileSync } from 'node:child_process';
import {
  compareParsedReleaseVersions,
  getSemverReleaseTags as getCoreSemverReleaseTags,
  isStableReleaseVersion,
  loadPackageJson,
  parseComparableReleaseTag,
  parseComparableReleaseVersion
} from './core.mjs';

const rcNumberPattern = /^[0-9]+$/u;
const breakingChangeFooterPattern = /^BREAKING[ -]CHANGE:/mu;
const conventionalBreakingSubjectPattern = /^[a-z][a-z0-9-]*(?:\([^)]+\))?!:/iu;
const conventionalFeatureSubjectPattern = /^feat(?:\([^)]+\))?!?:/u;

function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function formatCoreVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function incrementVersion(version, bump) {
  const parsedVersion = parseComparableReleaseVersion(version);

  if (bump === 'major') {
    return `${parsedVersion.major + 1}.0.0`;
  }

  if (bump === 'minor') {
    return `${parsedVersion.major}.${parsedVersion.minor + 1}.0`;
  }

  return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch + 1}`;
}

function getLatestStableTag(tags) {
  return tags
    .map((tag) => parseComparableReleaseTag(tag))
    .filter((parsedTag) => isStableReleaseVersion(parsedTag))
    .sort((left, right) => compareParsedReleaseVersions(right, left))[0]?.tag;
}

function getLatestSemverTag(tags) {
  return tags
    .map((tag) => parseComparableReleaseTag(tag))
    .sort((left, right) => compareParsedReleaseVersions(right, left))[0]?.tag;
}

function getBaseVersion({ latestStableTag, packageVersion }) {
  const parsedPackageVersion = parseComparableReleaseVersion(packageVersion);
  const packageCoreVersion = formatCoreVersion(parsedPackageVersion);

  if (!latestStableTag) {
    return packageCoreVersion;
  }

  const latestStableVersion = parseComparableReleaseTag(latestStableTag).version;
  return compareParsedReleaseVersions(
    parseComparableReleaseVersion(packageCoreVersion),
    parseComparableReleaseVersion(latestStableVersion)
  ) >= 0
    ? packageCoreVersion
    : latestStableVersion;
}

function getStableVersionForLatestPrerelease({ baseVersion, latestSemverTag }) {
  if (!latestSemverTag) {
    return null;
  }

  const latestSemverVersion = parseComparableReleaseTag(latestSemverTag);
  if (isStableReleaseVersion(latestSemverVersion)) {
    return null;
  }

  const stableCandidate = parseComparableReleaseVersion(latestSemverVersion.coreVersion);
  const base = parseComparableReleaseVersion(baseVersion);
  return compareParsedReleaseVersions(stableCandidate, base) >= 0 ? stableCandidate.version : null;
}

function parseReleaseCommitRecord(record) {
  const [hash, subject, message] = record.split('\0');

  return {
    hash,
    message: message ?? subject ?? '',
    subject: subject ?? ''
  };
}

function getReleaseCommits({ cwd, fromTag, run = runGit } = {}) {
  const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
  const output = run(['log', '--no-merges', '--format=%H%x00%s%x00%B%x1e', range], cwd);

  return output
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map(parseReleaseCommitRecord);
}

function deriveRecommendedBump({ commits, sourceLabel }) {
  const breakingCommits = commits.filter(
    ({ message, subject }) =>
      conventionalBreakingSubjectPattern.test(subject) || breakingChangeFooterPattern.test(message)
  );

  if (breakingCommits.length > 0) {
    return {
      bump: 'major',
      reason: `Found ${breakingCommits.length} breaking-change signal(s) since ${sourceLabel}.`
    };
  }

  const featureCommits = commits.filter(({ subject }) =>
    conventionalFeatureSubjectPattern.test(subject)
  );

  if (featureCommits.length > 0) {
    return {
      bump: 'minor',
      reason: `Found ${featureCommits.length} feature commit(s) since ${sourceLabel}.`
    };
  }

  if (commits.length > 0) {
    return {
      bump: 'patch',
      reason: `Found ${commits.length} non-merge commit(s) since ${sourceLabel} without a stronger semver signal.`
    };
  }

  return {
    bump: 'patch',
    reason: `No non-merge commits found since ${sourceLabel}; patch is the safest explicit default.`
  };
}

function getNextRcVersion({ stableVersion, tags }) {
  const target = parseComparableReleaseVersion(stableVersion);
  const nextRcNumber =
    tags
      .map((tag) => parseComparableReleaseTag(tag))
      .filter(
        (version) =>
          version.major === target.major &&
          version.minor === target.minor &&
          version.patch === target.patch &&
          version.prerelease.length === 2 &&
          version.prerelease[0] === 'rc' &&
          rcNumberPattern.test(version.prerelease[1])
      )
      .map((version) => Number(version.prerelease[1]))
      .sort((left, right) => right - left)[0] ?? 0;

  return `${stableVersion}-rc.${nextRcNumber + 1}`;
}

export function getSemverReleaseTags({ cwd = process.cwd(), run = runGit } = {}) {
  return getCoreSemverReleaseTags({ cwd, run });
}

export async function getReleaseVersionRecommendation({
  cwd = process.cwd(),
  run = runGit
} = {}) {
  const pkg = await loadPackageJson(cwd);
  const tags = getSemverReleaseTags({ cwd, run });
  const latestSemverTag = getLatestSemverTag(tags) ?? null;
  const latestStableTag = getLatestStableTag(tags) ?? null;
  const baseVersion = getBaseVersion({
    latestStableTag,
    packageVersion: pkg.version
  });
  const sourceLabel = latestSemverTag ?? 'the start of the repository history';
  const sourceRange = latestSemverTag ? `${latestSemverTag}..HEAD` : 'HEAD';
  const commits = getReleaseCommits({ cwd, fromTag: latestSemverTag, run });
  const { bump, reason } = deriveRecommendedBump({ commits, sourceLabel });
  const stableVersionForLatestPrerelease = getStableVersionForLatestPrerelease({
    baseVersion,
    latestSemverTag
  });
  const shouldFinaliseLatestPrerelease = bump === 'patch' && stableVersionForLatestPrerelease;
  const recommendedVersion = shouldFinaliseLatestPrerelease
    ? stableVersionForLatestPrerelease
    : incrementVersion(baseVersion, bump);
  const recommendedBump = shouldFinaliseLatestPrerelease ? 'stable' : bump;
  const recommendationReason = shouldFinaliseLatestPrerelease
    ? `Latest release tag ${latestSemverTag} is a prerelease for ${stableVersionForLatestPrerelease}; recommend finalising that stable version before bumping patch.`
    : reason;
  const alternatives = {
    patch: incrementVersion(baseVersion, 'patch'),
    minor: incrementVersion(baseVersion, 'minor'),
    major: incrementVersion(baseVersion, 'major'),
    releaseCandidate: getNextRcVersion({ stableVersion: recommendedVersion, tags })
  };

  return {
    alternatives,
    baseVersion,
    commitCount: commits.length,
    latestSemverTag,
    latestStableTag,
    packageName: pkg.name,
    reason: recommendationReason,
    recommendedBump,
    recommendedVersion,
    sourceRange
  };
}

export function formatReleaseVersionRecommendation(recommendation) {
  return [
    'No release version supplied.',
    '',
    `Recommended next version: ${recommendation.recommendedVersion}`,
    `Reason: ${recommendation.reason}`,
    `Source: ${recommendation.sourceRange}`,
    '',
    'Alternatives:',
    `- patch: ${recommendation.alternatives.patch}`,
    `- minor: ${recommendation.alternatives.minor}`,
    `- major: ${recommendation.alternatives.major}`,
    `- release candidate: ${recommendation.alternatives.releaseCandidate}`,
    '',
    'Run:',
    `  yarn release:prepare ${recommendation.recommendedVersion}`,
    ''
  ].join('\n');
}
