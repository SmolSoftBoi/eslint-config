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

export function getSemverTags({ cwd = process.cwd(), run = runGit } = {}) {
  const output = run(['tag', '--list', 'v*', '--sort=-v:refname'], cwd);
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
    });
}

export function getPreviousReleaseTag({ currentTag, cwd = process.cwd(), run = runGit } = {}) {
  return getSemverTags({ cwd, run }).find((tag) => tag !== currentTag) ?? null;
}

export function getCommitSubjects({ cwd = process.cwd(), fromTag = null, run = runGit } = {}) {
  const range = fromTag ? `${fromTag}..HEAD` : 'HEAD';
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
  const commits = getCommitSubjects({ cwd, fromTag: previousTag, run });
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

function parseArgs(argv) {
  const args = {
    outputPath: null,
    version: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      args.outputPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--version') {
      args.version = argv[index + 1];
      index += 1;
      continue;
    }

    if (!args.version) {
      args.version = arg;
    }
  }

  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { outputPath, version } = parseArgs(process.argv.slice(2));
    const { notes } = await generateReleaseNotes({ outputPath, version });
    process.stdout.write(notes);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
