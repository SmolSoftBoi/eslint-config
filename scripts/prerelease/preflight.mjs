import {
  formatErrorMessage,
  hasScript,
  loadPackageJson,
  runOptionalScriptsInOrder,
  runScript
} from './utils.mjs';

const optionalScripts = ['lint:shell', 'typecheck', 'test'];

try {
  const pkg = await loadPackageJson();

  if (!hasScript(pkg, 'lint')) {
    console.error('Missing required "lint" script in package.json.');
    process.exit(1);
  }

  await runScript('lint');
  await runOptionalScriptsInOrder(pkg, optionalScripts);
} catch (error) {
  console.error(formatErrorMessage('preflight failed', error));
  process.exit(1);
}
