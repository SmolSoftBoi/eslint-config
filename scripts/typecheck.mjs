import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

process.exit(result.status ?? 1);
