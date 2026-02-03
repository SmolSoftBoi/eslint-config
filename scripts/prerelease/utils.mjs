// Shared utilities for prerelease scripts.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Read the raw text content of package.json from a given directory.
 * @param {string} cwd - Directory to read package.json from (defaults to process.cwd()).
 * @returns {string} The package.json file content as UTF-8 text.
 */
export async function readPackageJsonFile(cwd = process.cwd()) {
  const filePath = path.join(cwd, 'package.json');
  return readFile(filePath, 'utf8');
}

/**
 * Parse the contents of a package.json string into an object.
 * @param {string} text - Raw JSON text from a package.json file.
 * @returns {Object} The parsed package.json object.
 * @throws {Error} If `text` is empty or not a string, or if JSON parsing fails.
 */
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

/**
 * Load and parse the package.json file from a directory.
 * @param {string} cwd - Directory containing package.json; defaults to the current working directory.
 * @returns {Object} The parsed package.json object.
 */
export async function loadPackageJson(cwd = process.cwd()) {
  const text = await readPackageJsonFile(cwd);
  return parsePackageJsonString(text);
}

/**
 * Return the `scripts` map from a package object, or an empty object if none is present.
 * @param {object|null|undefined} pkg - Parsed package.json object to read scripts from.
 * @returns {object} The `scripts` object from the package, or an empty object when `pkg` is missing or has no `scripts`.
 */
export function getPackageScripts(pkg) {
  return (pkg && typeof pkg === 'object' ? pkg.scripts : undefined) ?? {};
}

/**
 * Determine whether a package's scripts contain the given script name.
 * @param {object} pkg - Parsed package.json object; may be null or non-object.
 * @param {string} scriptName - The script name to check for (e.g. "build").
 * @returns {boolean} `true` if the package defines `scriptName` in its `scripts`, `false` otherwise.
 */
export function hasScript(pkg, scriptName) {
  return Boolean(getPackageScripts(pkg)[scriptName]);
}

/**
 * Retrieve a named npm script from a parsed package.json object.
 * @param {Object} pkg - The parsed package.json object.
 * @param {string} scriptName - The script key to retrieve (e.g. "build").
 * @returns {string|undefined} The script command string if present, `undefined` otherwise.
 */
export function getScript(pkg, scriptName) {
  return getPackageScripts(pkg)[scriptName];
}

/**
 * Extracts core package.json metadata into a stable shape.
 *
 * @param {object|null|undefined} pkg - The parsed package.json object; may be null/undefined.
 * @returns {{name: string|null, main: string|null, exports: any|null, files: any|null}} An object containing `name`, `main`, `exports` and `files` from the package; each property is the original value if present or `null` if absent.
 */
export function getPackageMetadata(pkg) {
  return {
    name: pkg?.name ?? null,
    main: pkg?.main ?? null,
    exports: pkg?.exports ?? null,
    files: pkg?.files ?? null
  };
}

/**
 * Parse the JSON produced by `npm pack --json` and extract the pack items, files array and primary filename.
 * @param {string} stdout - The stdout from running `npm pack --json`.
 * @returns {{packItems: Array, files: Array, filename: string|null}} An object containing the full parsed pack items array (`packItems`), the `files` array from the first pack item (`files`), and the `filename` of the first pack item or `null` if not present (`filename`).
 * @throws {Error} If `stdout` is empty or only whitespace.
 * @throws {Error} If `stdout` is not valid JSON.
 * @throws {Error} If the parsed JSON is not a non-empty array of pack items.
 * @throws {Error} If the first pack item does not include a `files` array.
 */
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

/**
 * Execute `npm pack --json` in the specified directory and return the parsed pack metadata.
 *
 * @param {Object} [options] - Options object.
 * @param {string} [options.cwd=process.cwd()] - Working directory to run the command in.
 * @returns {{packItems: Array, files: Array, filename: string|null}} Parsed pack result: `packItems` is the full parsed JSON array from `npm pack --json`, `files` is the `files` array from the first pack item, and `filename` is the first pack item's `filename` or `null` if absent.
 * @throws {Error} If the command fails or the command output is missing or cannot be parsed.
 */
export async function runNpmPackJson({ cwd = process.cwd() } = {}) {
  try {
    const { command, prefixArgs, env } = resolveNpmCommand();
    const { stdout } = await execFileAsync(command, [...prefixArgs, 'pack', '--json'], { cwd, env });
    return parseNpmPackJson(stdout);
  } catch (error) {
    const stderr = error && typeof error === 'object' ? error.stderr : undefined;
    const message = stderr ? String(stderr).trim() : error instanceof Error ? error.message : String(error);
    throw new Error(`npm pack --json failed: ${message}`);
  }
}

/**
 * Execute a command with inherited stdio and resolve when it exits successfully.
 *
 * @param {string} command - Executable or command to run.
 * @param {string[]} [args=[]] - Command arguments.
 * @param {Object} [options] - Execution options.
 * @param {string} [options.cwd=process.cwd()] - Working directory for the spawned process.
 * @param {NodeJS.ProcessEnv} [options.env=process.env] - Environment variables for the spawned process.
 * @returns {Promise<void>} Resolves when the process exits with code 0, rejects with an `Error` if the process fails to spawn or exits with a non-zero code (the error message includes the exit code and command). 
 */
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

/**
 * Determine the command and any prefix arguments to invoke the given runner, preferring a Node-executable Yarn wrapper when available.
 * @param {string} runner - The runner name or command (e.g. `'yarn'` or `'npm'`). When `'yarn'` this may resolve to a Node-executable wrapper if present.
 * @returns {{ command: string, prefixArgs: string[] }} An object with `command` set to the executable to spawn and `prefixArgs` containing any leading arguments that must precede the runner's normal arguments.
function resolveRunner(runner) {
  if (runner !== 'yarn') {
    return { command: runner, prefixArgs: [] };
  }

  const execPath = process.env.npm_execpath;
  if (execPath && /\.(c?m?js)$/i.test(execPath)) {
    return { command: process.execPath, prefixArgs: [execPath] };
  }

  const nodeDir = path.dirname(process.execPath);
  const yarnCandidates = [
    path.join(nodeDir, 'node_modules', 'corepack', 'dist', 'yarn.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'corepack', 'dist', 'yarn.js')
  ];

  for (const candidate of yarnCandidates) {
    if (existsSync(candidate)) {
      return { command: process.execPath, prefixArgs: [candidate] };
    }
  }

  return { command: runner, prefixArgs: [] };
}

/**
 * Execute the named package script in the specified working directory using the chosen runner.
 *
 * @param {string} scriptName - The name of the script from package.json to run.
 * @param {Object} [options] - Optional settings.
 * @param {string} [options.cwd=process.cwd()] - Working directory in which to run the script.
 * @param {string} [options.runner='yarn'] - Runner to use for execution (for example `'yarn'` or a custom command).
 */
export async function runScript(scriptName, { cwd = process.cwd(), runner = 'yarn' } = {}) {
  const { command, prefixArgs } = resolveRunner(runner);
  await runCommand(command, [...prefixArgs, scriptName], { cwd });
}

/**
 * Resolve the command and invocation arguments to run npm, preferring a JS-based runner when available.
 *
 * Returns an object describing how to invoke npm: either the Node executable with a JS runner script
 * (when npm_execpath points to a JS file or a corepack-provided npm.js is found), or the plain `npm`
 * command. The returned `env` includes overrides to disable Corepack project/strict behaviours.
 *
 * @returns {{ command: string, prefixArgs: string[], env: NodeJS.ProcessEnv }} An object with:
 *   - `command`: the executable to run (e.g. `node` or `npm`).
 *   - `prefixArgs`: arguments to prefix before normal npm arguments (typically a JS runner path).
 *   - `env`: environment variables to use when spawning the process.
 */
function resolveNpmCommand() {
  const execPath = process.env.npm_execpath;
  const env = {
    ...process.env,
    COREPACK_ENABLE_PROJECT_SPEC: '0',
    COREPACK_ENABLE_STRICT: '0'
  };

  if (execPath && /\.(c?m?js)$/i.test(execPath)) {
    return { command: process.execPath, prefixArgs: [execPath], env };
  }

  const nodeDir = path.dirname(process.execPath);
  const npmCandidates = [
    path.join(nodeDir, 'node_modules', 'corepack', 'dist', 'npm.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'corepack', 'dist', 'npm.js')
  ];

  for (const candidate of npmCandidates) {
    if (existsSync(candidate)) {
      return { command: process.execPath, prefixArgs: [candidate], env };
    }
  }

  return { command: 'npm', prefixArgs: [], env };
}

/**
 * Execute an npm command constructed from `args` in the specified working directory using a resolved npm runner (preferring Corepack shims when available).
 *
 * @param {string[]} args - Arguments to pass to the npm command (for example `['install']` or `['pack', '--json']`).
 * @param {Object} [options] - Options.
 * @param {string} [options.cwd=process.cwd()] - Working directory to run the command in.
 */
export async function runNpmCommand(args, { cwd = process.cwd() } = {}) {
  const { command, prefixArgs, env } = resolveNpmCommand();
  await runCommand(command, [...prefixArgs, ...args], { cwd, env });
}

/**
 * Execute a sequence of package scripts in order if they exist in the package.
 *
 * For each name in `scriptNames`, runs the script only when it is present in `pkg.scripts`; scripts are executed sequentially and missing entries are skipped.
 * @param {object} pkg - The parsed package.json object to check for scripts.
 * @param {string[]} scriptNames - Ordered list of script names to attempt to run.
 * @param {object} [options] - Execution options.
 * @param {string} [options.cwd=process.cwd()] - Working directory in which to run each script.
 * @param {string} [options.runner='yarn'] - Runner command or executable to invoke scripts with (for example `'yarn'` or a Node/JS runner path).
 */
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

/**
 * Format an error into a single-line message prefixed by an action.
 *
 * Converts an Error or any other value into a message and prefixes it with the
 * provided action followed by a colon and a space.
 *
 * @param {string} action - Short label describing the operation or context.
 * @param {*} error - An Error instance or any value to be converted to a message.
 * @returns {string} A single-line string in the form '<action>: <message>'.
 */
export function formatErrorMessage(action, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${action}: ${message}`;
}