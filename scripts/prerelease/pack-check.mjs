import { rm } from 'node:fs/promises';
import path from 'node:path';
import {
  formatErrorMessage,
  loadPackageJson,
  runNpmPackJson
} from './utils.mjs';

const requiredFiles = ['eslint.config.mjs', 'index.mjs', 'README.md', 'LICENSE'];

const normalizePath = (filePath) =>
  filePath
    .replace(/^\.\/?/, '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');

const collectEntrypoints = (value, entrypoints) => {
  if (typeof value === 'string') {
    entrypoints.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEntrypoints(item, entrypoints);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const propertyValue of Object.values(value)) {
      collectEntrypoints(propertyValue, entrypoints);
    }
  }
};

const getEntrypoints = (pkg) => {
  const entrypoints = new Set();

  if (typeof pkg.main === 'string') {
    entrypoints.add(pkg.main);
  }

  if (pkg.exports) {
    collectEntrypoints(pkg.exports, entrypoints);
  }

  return [...entrypoints];
};

let packedFilename = null;

try {
  const pkg = await loadPackageJson();
  const { files, filename } = await runNpmPackJson();

  packedFilename = filename;

  const packedPaths = files
    .map((file) => (typeof file === 'string' ? file : file?.path))
    .filter((file) => typeof file === 'string')
    .map((file) => normalizePath(file));

  const packedPathSet = new Set(packedPaths);

  const missingRequired = requiredFiles.filter((file) => !packedPathSet.has(file));
  if (missingRequired.length > 0) {
    throw new Error(`Missing required files in pack output: ${missingRequired.join(', ')}`);
  }

  const entrypoints = getEntrypoints(pkg).map((entrypoint) => normalizePath(entrypoint));
  const missingEntrypoints = entrypoints.filter((entrypoint) => !packedPathSet.has(entrypoint));

  if (missingEntrypoints.length > 0) {
    throw new Error(`Missing entrypoints in pack output: ${missingEntrypoints.join(', ')}`);
  }
} catch (error) {
  console.error(formatErrorMessage('pack check failed', error));
  process.exit(1);
} finally {
  if (packedFilename) {
    const tarballPath = path.join(process.cwd(), packedFilename);
    await rm(tarballPath, { force: true });
  }
}
