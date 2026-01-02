import { spawn } from 'node:child_process';

function run(label, cmd, args) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (err) => {
    // Surface missing binaries cleanly.
    if (err && err.code === 'ENOENT') {
      console.error(`[lint] Missing required command for ${label}: ${cmd}`);
    } else {
      console.error(`[lint] Failed to start ${label}:`, err);
    }
  });

  return child;
}

// Run both linters concurrently without relying on shell operators like `&&` or `&`.
const jobs = [
  { label: 'eslint', cmd: 'yarn', args: ['eslint', '.'] },
  { label: 'shellcheck', cmd: 'node', args: ['./scripts/lint-shell.mjs'] },
].map(({ label, cmd, args }) => ({ label, child: run(label, cmd, args) }));

let remaining = jobs.length;
let failed = false;

for (const { label, child } of jobs) {
  child.on('close', (code, signal) => {
    if (signal) {
      failed = true;
      console.error(`[lint] ${label} exited via signal ${signal}`);
    } else if (code !== 0) {
      failed = true;
      console.error(`[lint] ${label} exited with code ${code}`);
    }

    remaining -= 1;
    if (remaining === 0) {
      process.exit(failed ? 1 : 0);
    }
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
