import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPackageJson, normalizeVersionInput, parseReleaseTag } from './core.mjs';

function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

const numericIdentifierPattern = /^[0-9]+$/u;

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

function parseComparableTag(tag) {
  const { version } = parseReleaseTag(tag);
  const prereleaseStartIndex = version.indexOf('-');
  const coreVersion =
    prereleaseStartIndex === -1 ? version : version.slice(0, prereleaseStartIndex);
  const prereleaseVersion =
    prereleaseStartIndex === -1 ? '' : version.slice(prereleaseStartIndex + 1);
  const [major, minor, patch] = coreVersion.split('.').map(Number);

  return {
    major,
    minor,
    patch,
    prerelease: prereleaseVersion ? prereleaseVersion.split('.') : [],
    tag
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

function compareParsedTags(left, right) {
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

function isStableTag(parsedTag) {
  return parsedTag.prerelease.length === 0;
}

export function getSemverTags({ cwd = process.cwd(), run = runGit } = {}) {
  const output = run(['tag', '--list', 'v*'], cwd);
  return output
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      try {
        parseReleaseTag(tag);
        return true;
      } catch {
        return false;
      }
    })
    .sort((left, right) => compareParsedTags(parseComparableTag(right), parseComparableTag(left)));
}

export function getPreviousReleaseTag({ currentTag, cwd = process.cwd(), run = runGit } = {}) {
  const current = parseComparableTag(currentTag);
  const candidates = getSemverTags({ cwd, run })
    .filter((tag) => tag !== currentTag)
    .map((tag) => parseComparableTag(tag))
    .filter((candidate) => compareParsedTags(candidate, current) < 0)
    .filter((candidate) => !isStableTag(current) || isStableTag(candidate))
    .sort((left, right) => compareParsedTags(right, left));

  return candidates[0]?.tag ?? null;
}

export function getCommitSubjects({
  cwd = process.cwd(),
  fromTag = null,
  run = runGit,
  toRef = null
} = {}) {
  const range = fromTag ? `${fromTag}..${toRef ?? 'HEAD'}` : (toRef ?? 'HEAD');
  const output = run(['log', '--format=%s', range], cwd);

  return output
    .split('\n')
    .map((subject) => subject.trim())
    .filter(Boolean);
}

export function formatReleaseNotes({
  commits,
  currentTag,
  packageName,
  previousTag,
  version
}) {
  const lines = [`# ${packageName} ${currentTag}`, '', `Version: \`${version}\``, ''];

  if (previousTag) {
    lines.push(`Changes since \`${previousTag}\`:`, '');
  } else {
    lines.push('Changes in this release:', '');
  }

  lines.push('## Changes', '');

  if (commits.length > 0) {
    for (const subject of commits) {
      lines.push(`- ${subject}`);
    }
  } else if (previousTag) {
    lines.push(`- No committed changes since ${previousTag}.`);
  } else {
    lines.push('- Initial release notes generated from the current repository state.');
  }

  lines.push('');
  return lines.join('\n');
}

export async function generateReleaseNotes({
  cwd = process.cwd(),
  outputPath = null,
  run = runGit,
  version
} = {}) {
  const pkg = await loadPackageJson(cwd);
  const releaseVersion = normalizeVersionInput(version ?? pkg.version);
  const currentTag = `v${releaseVersion}`;
  const previousTag = getPreviousReleaseTag({ currentTag, cwd, run });
  const currentTagExists = getSemverTags({ cwd, run }).includes(currentTag);
  const commits = getCommitSubjects({
    cwd,
    fromTag: previousTag,
    run,
    toRef: currentTagExists ? currentTag : null
  });
  const notes = formatReleaseNotes({
    commits,
    currentTag,
    packageName: pkg.name,
    previousTag,
    version: releaseVersion
  });

  if (outputPath) {
    const resolvedOutputPath = path.resolve(cwd, outputPath);
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, notes);
  }

  return {
    currentTag,
    notes,
    outputPath,
    previousTag
  };
}

function readRequiredOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${optionName} option requires a value.`);
  }

  return value;
}

export function parseArgs(argv) {
  const args = {
    outputPath: null,
    version: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      args.outputPath = readRequiredOptionValue(argv, index, '--output');
      index += 1;
      continue;
    }

    if (arg === '--version') {
      args.version = readRequiredOptionValue(argv, index, '--version');
      index += 1;
      continue;
    }

    if (!args.version) {
      args.version = arg;
    }
  }

  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { outputPath, version } = parseArgs(process.argv.slice(2));
    const { notes } = await generateReleaseNotes({ outputPath, version });
    process.stdout.write(notes);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
