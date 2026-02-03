// Shared utilities for prerelease scripts.

import { readFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export async function readPackageJsonFile(cwd = process.cwd()) {
  const filePath = path.join(cwd, 'package.json');
  return readFile(filePath, 'utf8');
}

export function parsePackageJsonString(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('package.json content is empty or not a string');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse package.json: ${message}`);
  }
}

export async function loadPackageJson(cwd = process.cwd()) {
  const text = await readPackageJsonFile(cwd);
  return parsePackageJsonString(text);
}

export function getPackageScripts(pkg) {
  return (pkg && typeof pkg === 'object' ? pkg.scripts : undefined) ?? {};
}

export function hasScript(pkg, scriptName) {
  return Boolean(getPackageScripts(pkg)[scriptName]);
}

export function getScript(pkg, scriptName) {
  return getPackageScripts(pkg)[scriptName];
}

export function getPackageMetadata(pkg) {
  return {
    name: pkg?.name ?? null,
    main: pkg?.main ?? null,
    exports: pkg?.exports ?? null,
    files: pkg?.files ?? null
  };
}

export function parseNpmPackJson(stdout) {
  if (!stdout || !stdout.trim()) {
    throw new Error('npm pack --json produced no output');
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`npm pack --json output was not valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('npm pack --json output did not include a file list');
  }

  const first = parsed[0];
  const files = first?.files;

  if (!Array.isArray(files)) {
    throw new Error('npm pack --json output did not include a files array');
  }

  return {
    packItems: parsed,
    files,
    filename: typeof first?.filename === 'string' ? first.filename : null
  };
}

export async function runNpmPackJson({ cwd = process.cwd() } = {}) {
  try {
    const { stdout } = await execFileAsync('npm', ['pack', '--json'], { cwd });
    return parseNpmPackJson(stdout);
  } catch (error) {
    const stderr = error && typeof error === 'object' ? error.stderr : undefined;
    const message = stderr ? String(stderr).trim() : error instanceof Error ? error.message : String(error);
    throw new Error(`npm pack --json failed: ${message}`);
  }
}

export function runCommand(command, args = [], { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

export async function runScript(scriptName, { cwd = process.cwd(), runner = 'yarn' } = {}) {
  await runCommand(runner, [scriptName], { cwd });
}

export async function runOptionalScriptsInOrder(
  pkg,
  scriptNames,
  { cwd = process.cwd(), runner = 'yarn' } = {}
) {
  for (const scriptName of scriptNames) {
    if (!hasScript(pkg, scriptName)) {
      continue;
    }

    await runScript(scriptName, { cwd, runner });
  }
}

export function formatErrorMessage(action, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${action}: ${message}`;
}
