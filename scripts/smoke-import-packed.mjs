// Consumer-style import smoke test helper.
//
// Usage:
//   node scripts/smoke-import-packed.mjs '@scope/pkg'
//
// Exits non-zero on failure.

const pkgName = process.argv[2];

if (!pkgName) {
  console.error('Missing package name argument. Usage: node scripts/smoke-import-packed.mjs \'@scope/pkg\'');
  process.exit(2);
}

try {
  const mod = await import(pkgName);
  if (!('default' in mod)) {
    const exportNames = Object.keys(mod);
    throw new Error(
      `Expected package "${pkgName}" to provide a default export (as documented for \`import config from '${pkgName}'\`). ` +
      (exportNames.length
        ? `Found only named exports: ${exportNames.join(', ')}.`
        : 'No exports were found on the imported module.')
    );
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
