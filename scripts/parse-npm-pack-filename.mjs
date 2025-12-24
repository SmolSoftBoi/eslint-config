// Parse `npm pack --json` output from stdin and print the first tarball filename.
//
// Usage:
//   npm pack --json | node scripts/parse-npm-pack-filename.mjs

let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const parsed = JSON.parse(input);
    const filename = parsed?.[0]?.filename;

    if (!filename || typeof filename !== 'string') {
      throw new Error('npm pack --json output did not include a filename');
    }

    process.stdout.write(filename);
  } catch (e) {
    console.error('Failed to parse npm pack --json output:', e?.message ?? e);
    process.exit(1);
  }
});
