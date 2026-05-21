import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateReleaseNotes } from './notes.mjs';
import { isReleaseVersion, normalizeVersionInput, parseReleaseTag } from './core.mjs';

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

function runGitInherited(args) {
  execFileSync('git', args, {
    cwd: repoRoot,
    stdio: 'inherit'
  });
}

function assertCleanWorkingTree() {
  const status = runGit(['status', '--porcelain']);
  if (status) {
    throw new Error('Working tree must be clean before preparing a release.');
  }
}

function assertGitIdentityConfigured() {
  const name = runOptionalGit(['config', '--get', 'user.name']);
  const email = runOptionalGit(['config', '--get', 'user.email']);

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

async function updatePackageVersion(version) {
  const packagePath = path.join(repoRoot, 'package.json');
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

function runPrerelease() {
  const env = {
    ...process.env,
    npm_config_cache:
      process.env.npm_config_cache ?? path.join(os.tmpdir(), 'eslint-config-npm-cache')
  };

  const result = spawnSync('yarn', ['prerelease'], {
    cwd: repoRoot,
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

function printNextSteps({ notesPath, tag }) {
  console.log('');
  console.log(`Prepared ${tag}.`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Push the release commit:');
  console.log('   git push origin HEAD');
  console.log('2. Push the release tag:');
  console.log(`   git push origin ${tag}`);
  console.log('3. Create the GitHub Release with the generated notes:');
  console.log(`   gh release create ${tag} --notes-file ${notesPath}`);
  console.log('');
  console.log('Rollback before pushing:');
  console.log(`   git tag -d ${tag}`);
  console.log('   git reset --soft HEAD~1');
}

async function main(argv = process.argv.slice(2)) {
  const version = normalizeVersionInput(argv[0]);
  if (!isReleaseVersion(version)) {
    throw new Error(
      `Release version '${version}' is invalid. Use MAJOR.MINOR.PATCH with optional prerelease, e.g. 1.2.3 or 1.2.3-rc.1.`
    );
  }

  const tag = `v${version}`;
  parseReleaseTag(tag);
  let committed = false;

  assertCleanWorkingTree();
  assertGitIdentityConfigured();
  assertTagDoesNotExist(tag);

  const { originalText, packagePath } = await updatePackageVersion(version);

  try {
    runPrerelease();

    const notesDir = '.release-notes';
    const notesPath = `${notesDir}/${tag}.md`;
    await mkdir(path.join(repoRoot, notesDir), { recursive: true });
    await generateReleaseNotes({ cwd: repoRoot, outputPath: notesPath, version });

    runGitInherited(['add', 'package.json']);
    runGitInherited(['commit', '-m', `Release ${tag}`]);
    committed = true;
    runGitInherited(['tag', '-a', tag, '-m', `Release ${tag}`]);

    printNextSteps({ notesPath, tag });
  } catch (error) {
    if (!committed) {
      await restorePackageJson({ originalText, packagePath });
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
