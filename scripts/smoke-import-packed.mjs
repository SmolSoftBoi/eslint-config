// Consumer-style import smoke test helper.
//
// Usage:
//   node scripts/smoke-import-packed.mjs "@scope/pkg"
//
// Exits non-zero on failure.

const pkgName = process.argv[2];

if (!pkgName) {
  console.error('Missing package name argument. Usage: node scripts/smoke-import-packed.mjs "@scope/pkg"');
  process.exit(2);
}

try {
  const mod = await import(pkgName);
  if (!('default' in mod)) {
    throw new Error('Expected default export');
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
