import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ignoredDirectories = new Set(['.git', '.yarn', 'node_modules']);

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await findTestFiles(path.join(directory, entry.name))));
      }
      continue;
    }

    if (entry.isFile() && /\.(test|spec)\.mjs$/u.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
}

const testFiles = (await findTestFiles(process.cwd())).sort();

if (testFiles.length === 0) {
  console.log('✅ Tests skipped: no matching *.test.mjs or *.spec.mjs files found.');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit'
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
