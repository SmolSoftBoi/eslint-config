import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  // This helper is used in two modes:
  // 1) "interactive" commands (default): stdio is inherited so output streams directly to the
  //    terminal (e.g. running shellcheck). In this mode, res.stdout will be null.
  // 2) "capture" commands: override stdio to pipe stdout so the caller can read res.stdout
  //    (e.g. git ls-files). In this mode, encoding ensures res.stdout is a string.
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    encoding: 'utf8',
    ...opts,
  });

  if (res.error) {
    if (res.error.code === 'ENOENT') {
      // Friendly message when a required binary is missing.
      console.error(`Missing required command: ${cmd}`);
      if (cmd === 'shellcheck') {
        console.error('Install ShellCheck (https://www.shellcheck.net/) and try again.');
      }
    } else {
      console.error(res.error);
    }
    process.exit(res.status ?? 1);
  }

  if (typeof res.status === 'number' && res.status !== 0) {
    process.exit(res.status);
  }

  if (res.signal) {
    process.exit(1);
  }

  return res;
}

// Only lint repository-tracked scripts to avoid scanning generated content.
// Treat `.specify/scripts/**` as dependency tooling (out of scope for lint gate).
// Capture stdout so we can parse the NUL-delimited file list.
const list = run(
  'git',
  ['ls-files', '-z', '--', '*.sh', '**/*.sh', ':(exclude).specify/scripts/**'],
  { stdio: ['ignore', 'pipe', 'inherit'] }
);
const tracked = list.stdout.split('\0').filter(Boolean);

if (tracked.length === 0) {
  console.log('No tracked *.sh files; skipping.');
  process.exit(0);
}

console.log('ShellCheck (tracked *.sh):');
for (const file of tracked) console.log(`- ${file}`);

const shellcheckArgs = ['-S', 'warning', ...tracked];
// Inherit stdio so ShellCheck prints directly to the terminal.
run('shellcheck', shellcheckArgs);
