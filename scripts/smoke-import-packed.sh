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

if ! PKG_META="$(node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';

try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  if (!pkg?.name || typeof pkg.name !== 'string') {
    throw new Error('package.json is missing a valid "name" field');
  }
  const name = pkg.name;
  let entry = 'index.mjs';
  if (typeof pkg.exports === 'string') {
    entry = pkg.exports;
  } else if (
    pkg.exports &&
    typeof pkg.exports === 'object' &&
    typeof pkg.exports['.'] === 'string'
  ) {
    entry = pkg.exports['.'];
  } else if (typeof pkg.main === 'string') {
    entry = pkg.main;
  }
  console.log(`${name}\n${entry}`);
} catch (e) {
  console.error('Failed to read package name from package.json:', e?.message ?? e);
  process.exit(1);
}
NODE
)"; then
  annotate error "Failed to read package name from package.json"
  exit 1
fi

IFS=$'\n' read -r PKG_NAME PKG_ENTRY <<< "$PKG_META"

if [[ -z "${PKG_NAME:-}" ]]; then
  annotate error "Package name is empty after reading package.json"
  exit 1
fi
echo "[smoke-import-packed] Package: ${PKG_NAME}"

PKG_ENTRY="${PKG_ENTRY:-index.mjs}"
ENTRY_RELATIVE="${PKG_ENTRY#./}"
if [[ -z "${ENTRY_RELATIVE:-}" ]]; then
  annotate error "Package entry point is empty after reading package.json"
  exit 1
fi
echo "[smoke-import-packed] Entry: ${ENTRY_RELATIVE}"

if ! PACK_DIR="$(mktemp -d -t smoke-pack-artifact.XXXXXX)"; then
  annotate error "Failed to create temporary directory for pack artifact"
  exit 1
fi

if ! CONSUMER_DIR="$(mktemp -d -t smoke-import-packed.XXXXXX)"; then
  annotate error "Failed to create temporary directory for smoke-import-packed test"
  exit 1
fi

if [ ! -d "$CONSUMER_DIR" ]; then
  annotate error "Temporary path is not a directory: $CONSUMER_DIR"
  exit 1
fi

if ! chmod 700 "$CONSUMER_DIR"; then
  annotate error "Failed to set permissions on temporary directory: $CONSUMER_DIR"
  exit 1
fi
cleanup() {
  rm -rf "$PACK_DIR"
  rm -rf "$CONSUMER_DIR"
}
trap cleanup EXIT

echo "[smoke-import-packed] Temp dir: $CONSUMER_DIR"

# Pack from repo root using Yarn to reflect publish artifacts.
echo "[smoke-import-packed] Packing with Yarn..."
TARBALL_PATH="${PACK_DIR}/package.tgz"
if ! yarn pack --out "$TARBALL_PATH"; then
  annotate error "yarn pack failed"
  exit 1
fi

echo "[smoke-import-packed] Tarball: $TARBALL_PATH"

ENTRY_TAR_PATH="package/${ENTRY_RELATIVE}"
if ! tar -tf "$TARBALL_PATH" | rg -F -x "$ENTRY_TAR_PATH" >/dev/null; then
  annotate error "Expected entry point not found in tarball: ${ENTRY_TAR_PATH}"
  exit 1
fi

cd "$CONSUMER_DIR"

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
