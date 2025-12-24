#!/usr/bin/env bash
set -euo pipefail

# Consumer-style import smoke test.
# Packs the package, installs it into a temp directory, then imports by package name.
# This catches packaging/export issues that a repo-relative import would miss.

is_github_actions() {
  [ "${GITHUB_ACTIONS:-}" = "true" ]
}

annotate() {
  local level="$1"; shift
  local msg="$*"

  if is_github_actions; then
    echo "::${level}::${msg}"
  else
    echo "${level}: ${msg}" >&2
  fi
}

ROOT_DIR="$(pwd)"

if ! PKG_NAME="$(node --input-type=module -e "import { readFileSync } from 'node:fs';
try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  if (!pkg?.name || typeof pkg.name !== 'string') {
    throw new Error('package.json is missing a valid \"name\" field');
  }
  console.log(pkg.name);
} catch (e) {
  console.error('Failed to read package name from package.json:', e?.message ?? e);
  process.exit(1);
}")"; then
  annotate error "Failed to read package name from package.json"
  exit 1
fi

if [[ -z "${PKG_NAME:-}" ]]; then
  annotate error "Package name is empty after reading package.json"
  exit 1
fi
echo "[smoke-import-packed] Package: ${PKG_NAME}"

tmp="$(mktemp -d -t smoke-import-packed.XXXXXX)"
cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "[smoke-import-packed] Temp dir: $tmp"

# Pack from repo root. Prefer npm pack because it reflects the npm publish artifact.
# (Yarn pack would also work, but npm pack is the closest representation of registry output.)

echo "[smoke-import-packed] Packing..."
if ! PACK_OUTPUT="$(npm pack --json)"; then
  annotate error "npm pack failed"
  exit 1
fi
if ! TARBALL_FILE="$(printf '%s\n' "$PACK_OUTPUT" | node "$ROOT_DIR/scripts/parse-npm-pack-filename.mjs")"; then
  annotate error "Failed to parse npm pack output"
  exit 1
fi

if [[ -z "${TARBALL_FILE}" ]]; then
  annotate error "Failed to parse npm pack output: empty tarball filename"
  exit 1
fi

# Be conservative about the expected tarball filename format: a basename with safe
# characters ending in .tgz, with no path separators.
if ! [[ "${TARBALL_FILE}" =~ ^[A-Za-z0-9._-]+\.tgz$ ]]; then
  annotate error "Unexpected tarball filename from npm pack: '${TARBALL_FILE}'"
  exit 1
fi
TARBALL_PATH="$ROOT_DIR/$TARBALL_FILE"

echo "[smoke-import-packed] Tarball: $TARBALL_PATH"

cd "$tmp"

# Create a minimal consumer project and install the tarball.
# Silence audit/fund noise to keep CI logs clean.
npm init -y >/dev/null 2>&1
npm install --silent --no-audit --no-fund "$TARBALL_PATH"

# Run the import assertion from within the temp consumer project so Node resolves
# the package from its local node_modules.
cp "$ROOT_DIR/scripts/smoke-import-packed.mjs" ./smoke-import-packed.mjs

# Import by package name as consumers do.
# Also assert a default export exists, since the README implies default export usage.
echo "[smoke-import-packed] Importing ${PKG_NAME}..."
node ./smoke-import-packed.mjs "$PKG_NAME"

echo "[smoke-import-packed] OK"
