import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateReleaseNotes } from './notes.mjs';
import { isReleaseVersion, normalizeVersionInput, parseReleaseTag } from './core.mjs';
import {
  formatReleaseVersionRecommendation,
  getReleaseVersionRecommendation
} from './recommend.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '../..');

function runGit(args, { cwd = repoRoot } = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function runOptionalGit(args, options) {
  try {
    return runGit(args, options);
  } catch {
    return '';
  }
}

function runGitInherited(args, { cwd = repoRoot } = {}) {
  execFileSync('git', args, {
    cwd,
    stdio: 'inherit'
  });
}

function assertCleanWorkingTree({ cwd = repoRoot } = {}) {
  const status = runGit(['status', '--porcelain'], { cwd });
  if (status) {
    throw new Error('Working tree must be clean before preparing a release.');
  }
}

function assertGitIdentityConfigured({ cwd = repoRoot } = {}) {
  const name = runOptionalGit(['config', '--get', 'user.name'], { cwd });
  const email = runOptionalGit(['config', '--get', 'user.email'], { cwd });

  if (!name || !email) {
    throw new Error('Git user.name and user.email must be configured before creating a release commit.');
  }
}

export function assertTagDoesNotExist(tag, { cwd = repoRoot } = {}) {
  const localExisting = runGit(['tag', '--list', tag], { cwd });
  if (localExisting) {
    throw new Error(`Tag ${tag} already exists.`);
  }

  const remoteExisting = (() => {
    try {
      return runGit(['ls-remote', '--tags', '--refs', 'origin', `refs/tags/${tag}`], {
        cwd
      });
    } catch {
      throw new Error('Unable to verify tags on origin. Check remote access and try again.');
    }
  })();

  if (remoteExisting) {
    throw new Error(`Tag ${tag} already exists on origin.`);
  }
}

async function updatePackageVersion(version, { cwd = repoRoot } = {}) {
  const packagePath = path.join(cwd, 'package.json');
  const originalText = await readFile(packagePath, 'utf8');
  const pkg = JSON.parse(originalText);
  pkg.version = version;
  const updatedText = `${JSON.stringify(pkg, null, 2)}\n`;
  await writeFile(packagePath, updatedText);
  return { originalText, packagePath };
}

export async function restorePackageJson({
  cwd = repoRoot,
  originalText,
  packagePath = path.join(cwd, 'package.json')
}) {
  const absolutePackagePath = path.isAbsolute(packagePath)
    ? packagePath
    : path.join(cwd, packagePath);
  const packagePathspec = path.relative(cwd, absolutePackagePath) || path.basename(packagePath);

  runOptionalGit(['reset', '--', packagePathspec], { cwd });
  await writeFile(absolutePackagePath, originalText);
}

export function rollbackReleaseCommitIfTagMissing(tag, { cwd = repoRoot } = {}) {
  const existingTag = runGit(['tag', '--list', tag], { cwd });
  if (existingTag) {
    return false;
  }

  runGit(['reset', '--soft', 'HEAD~1'], { cwd });
  return true;
}

function runPrerelease({ cwd = repoRoot } = {}) {
  const env = {
    ...process.env,
    npm_config_cache:
      process.env.npm_config_cache ?? path.join(os.tmpdir(), 'eslint-config-npm-cache')
  };

  const result = spawnSync('yarn', ['prerelease'], {
    cwd,
    env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`yarn prerelease exited with code ${result.status ?? 1}.`);
  }
}

function printNextSteps({ log = console.log, notesPath, tag }) {
  log('');
  log(`Prepared ${tag}.`);
  log('');
  log('Next steps:');
  log('1. Push the release commit:');
  log('   git push origin HEAD');
  log('2. Push the release tag:');
  log(`   git push origin ${tag}`);
  log('3. Create the GitHub Release with the generated notes:');
  log(`   gh release create ${tag} --notes-file ${notesPath}`);
  log('');
  log('Rollback before pushing:');
  log(`   git tag -d ${tag}`);
  log('   git reset --soft HEAD~1');
}

export async function main(argv = process.argv.slice(2), { cwd = repoRoot, log = console.log } = {}) {
  if (typeof argv[0] !== 'string' || !argv[0].trim()) {
    const recommendation = await getReleaseVersionRecommendation({ cwd });
    log(formatReleaseVersionRecommendation(recommendation));
    return;
  }

  const version = normalizeVersionInput(argv[0]);
  if (!isReleaseVersion(version)) {
    throw new Error(
      `Release version '${version}' is invalid. Use MAJOR.MINOR.PATCH with optional prerelease, e.g. 1.2.3 or 1.2.3-rc.1.`
    );
  }

  const tag = `v${version}`;
  parseReleaseTag(tag);
  let committed = false;

  assertCleanWorkingTree({ cwd });
  assertGitIdentityConfigured({ cwd });
  assertTagDoesNotExist(tag, { cwd });

  const { originalText, packagePath } = await updatePackageVersion(version, { cwd });

  try {
    runPrerelease({ cwd });

    const notesDir = '.release-notes';
    const notesPath = `${notesDir}/${tag}.md`;
    await mkdir(path.join(cwd, notesDir), { recursive: true });
    await generateReleaseNotes({ cwd, outputPath: notesPath, version });

    runGitInherited(['add', 'package.json'], { cwd });
    runGitInherited(['commit', '-m', `Release ${tag}`], { cwd });
    committed = true;
    runGitInherited(['tag', '-a', tag, '-m', `Release ${tag}`], { cwd });

    printNextSteps({ log, notesPath, tag });
  } catch (error) {
    if (!committed || rollbackReleaseCommitIfTagMissing(tag, { cwd })) {
      await restorePackageJson({ cwd, originalText, packagePath });
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
