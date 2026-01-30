import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

function run(label, cmd, args) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    windowsHide: true,
  });

  return child;
}

const eslintBinPath = fileURLToPath(new URL('../node_modules/eslint/bin/eslint.js', import.meta.url));
const eslintCmd = process.execPath;
const eslintArgs = existsSync(eslintBinPath)
  ? [eslintBinPath, '.']
  : null;

// Run both linters concurrently without relying on shell operators like `&&` or `&`.
const jobs = [
  eslintArgs
    ? { label: 'eslint', cmd: eslintCmd, args: eslintArgs }
    : { label: 'eslint', cmd: 'node', args: ['-e', "console.error('[lint] Missing required command for eslint: eslint'); process.exit(1)"] },
  { label: 'shellcheck', cmd: 'node', args: ['./scripts/lint-shell.mjs'] },
].map(({ label, cmd, args }) => ({ label, child: run(label, cmd, args) }));

let remaining = jobs.length;
let failed = false;
let exiting = false;
const finished = new Set();

function finalize(label, { code = 0, signal = null, error = null } = {}) {
  if (finished.has(label)) return;
  finished.add(label);

  if (error) {
    failed = true;
    // Surface missing binaries cleanly.
    if (error.code === 'ENOENT') {
      console.error(`[lint] Missing required command for ${label}: ${error.path ?? '<unknown>'}`);
    } else {
      console.error(`[lint] Failed to start ${label}:`, error);
    }
  } else if (signal) {
    failed = true;
    console.error(`[lint] ${label} exited via signal ${signal}`);
  } else if (code !== 0) {
    failed = true;
    console.error(`[lint] ${label} exited with code ${code}`);
  }

  remaining -= 1;

  // Design note:
  // - Spawn/start failures (e.g. missing `yarn` / `node`) mean the overall lint run can't be trusted
  //   to make progress, and the sibling process may keep running and waste time.
  //   In that case we fail fast: stop the other jobs and exit non-zero immediately.
  // - Normal non-zero exit codes are treated as *lint failures* (not infrastructure failures), so
  //   we let both linters finish to show full diagnostics before exiting.
  if (error && !exiting) {
    exiting = true;
    for (const j of jobs) {
      if (j.label === label) continue;
      try {
        j.child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    process.exit(1);
  }

  if (remaining === 0) {
    process.exit(failed ? 1 : 0);
  }
}

for (const { label, child } of jobs) {
  child.on('error', (err) => {
    // When spawn fails, 'close' will never fire; treat this as completion.
    finalize(label, { error: err, code: 1 });
  });

  child.on('close', (code, signal) => {
    finalize(label, { code, signal });
  });
}

// Forward SIGINT/SIGTERM to children so Ctrl+C behaves as expected.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const { child } of jobs) {
      try {
        child.kill(sig);
      } catch {
        // ignore
      }
    }
  });
}
