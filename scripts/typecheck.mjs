import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { constants as osConstants } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, '..');
const tsconfigPath = join(repoRoot, 'tsconfig.json');

if (!existsSync(tsconfigPath)) {
  console.log('✅ Typecheck skipped: no tsconfig.json found.');
  process.exit(0);
}

const result = spawnSync('yarn', ['tsc', '--noEmit'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error('❌ Failed to run "yarn tsc --noEmit".');
  console.error(result.error.message);
  if (result.error.code === 'ENOENT') {
    console.error('Hint: Ensure that "yarn" is installed and available on your PATH.');
  }
  process.exit(1);
}

if (result.signal) {
  const signalNumber = osConstants.signals[result.signal];
  console.error(`❌ "yarn tsc --noEmit" terminated by signal ${result.signal}.`);
  process.exit(typeof signalNumber === 'number' ? 128 + signalNumber : 1);
}

process.exit(result.status ?? 1);
