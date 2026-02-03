import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  formatErrorMessage,
  loadPackageJson,
  runCommand,
  runNpmCommand,
  runNpmPackJson
} from './utils.mjs';

const shouldSkipPackedImport = () => {
  const value = process.env.SKIP_PACKED_IMPORT;
  return Boolean(value && value.trim());
};

const isCi = () => Boolean(process.env.CI);

const preferredExportKeys = ['import', 'default', 'require', 'node', 'browser', 'development', 'production'];

const findEntrypoint = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const entrypoint = findEntrypoint(item);
      if (entrypoint) {
        return entrypoint;
      }
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const key of preferredExportKeys) {
      if (key in value) {
        const entrypoint = findEntrypoint(value[key]);
        if (entrypoint) {
          return entrypoint;
        }
      }
    }

    for (const [key, propertyValue] of Object.entries(value)) {
      if (preferredExportKeys.includes(key)) {
        continue;
      }

      const entrypoint = findEntrypoint(propertyValue);
      if (entrypoint) {
        return entrypoint;
      }
    }
  }

  return null;
};

const resolveExportsEntrypoint = (exportsField) => {
  if (exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)) {
    if (exportsField['.']) {
      return resolveExportsEntrypoint(exportsField['.']);
    }
  }

  return findEntrypoint(exportsField);
};

const resolveWorkspaceEntrypoint = (pkg) => {
  const exportsEntrypoint = resolveExportsEntrypoint(pkg.exports);
  if (exportsEntrypoint) {
    return exportsEntrypoint;
  }

  return typeof pkg.main === 'string' ? pkg.main : null;
};

let packedFilename = null;
let tempDir = null;
let skipPackedImport = false;

try {
  const pkg = await loadPackageJson();

  if (!pkg.name) {
    throw new Error('package.json is missing a package name');
  }

  const workspaceEntrypoint = resolveWorkspaceEntrypoint(pkg);
  if (!workspaceEntrypoint) {
    throw new Error('Unable to resolve a workspace entrypoint from package.json');
  }

  const workspaceUrl = pathToFileURL(path.resolve(process.cwd(), workspaceEntrypoint)).href;
  await import(workspaceUrl);

  if (isCi() && shouldSkipPackedImport()) {
    throw new Error('SKIP_PACKED_IMPORT is set in CI; packed import must not be skipped.');
  }

  if (!isCi() && shouldSkipPackedImport()) {
    console.log('Skipping packed tarball import because SKIP_PACKED_IMPORT is set.');
    skipPackedImport = true;
  }

  if (!skipPackedImport) {
    const { filename } = await runNpmPackJson();
    packedFilename = filename;

    if (!packedFilename) {
      throw new Error('npm pack --json did not return a tarball filename');
    }

    const tarballPath = path.join(process.cwd(), packedFilename);
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'eslint-config-pack-'));

    await runNpmCommand(['install', tarballPath], { cwd: tempDir });
    const importScript = `const pkgName = ${JSON.stringify(pkg.name)}; import(pkgName).catch(err => { console.error(err); process.exit(1); });`;
    await runCommand('node', ['-e', importScript], {
      cwd: tempDir
    });
  }
} catch (error) {
  console.error(formatErrorMessage('smoke import failed', error));
  process.exitCode = 1;
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }

  if (packedFilename) {
    const tarballPath = path.join(process.cwd(), packedFilename);
    await rm(tarballPath, { force: true });
  }
}
