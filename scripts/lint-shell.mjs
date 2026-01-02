import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
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

  return res;
}

// Only lint repository-tracked scripts to avoid scanning generated content.
// Treat `.specify/scripts/**` as dependency tooling (out of scope for lint gate).
const list = run('git', ['ls-files', '-z', '--', '**/*.sh', ':(exclude).specify/scripts/**']);
const tracked = list.stdout.split('\0').filter(Boolean);

if (tracked.length === 0) {
  console.log('No tracked *.sh files; skipping.');
  process.exit(0);
}

console.log('ShellCheck (tracked *.sh):');
for (const file of tracked) console.log(`- ${file}`);

const shellcheckArgs = ['-S', 'warning', '--rcfile', '.shellcheckrc', ...tracked];
const lint = spawnSync('shellcheck', shellcheckArgs, { stdio: 'inherit' });

if (lint.error) {
  if (lint.error.code === 'ENOENT') {
    console.error('Missing required command: shellcheck');
    console.error('Install ShellCheck (https://www.shellcheck.net/) and try again.');
  } else {
    console.error(lint.error);
  }
  process.exit(lint.status ?? 1);
}

process.exit(lint.status ?? 0);
