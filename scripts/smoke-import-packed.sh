#!/usr/bin/env bash
set -euo pipefail

# Consumer-style import smoke test.
# Packs the package, installs it into a temp directory, then imports by package name.
# This catches packaging/export issues that a repo-relative import would miss.

ROOT_DIR="$(pwd)"

PKG_NAME="$(node --input-type=module -e "import { readFileSync } from 'node:fs'; console.log(JSON.parse(readFileSync('./package.json', 'utf8')).name)")"
echo "[smoke-import-packed] Package: ${PKG_NAME}"

tmp="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "[smoke-import-packed] Temp dir: $tmp"

# Pack from repo root. Prefer npm pack because it reflects the npm publish artifact.
# (Yarn pack would also work, but npm pack is the closest representation of registry output.)

echo "[smoke-import-packed] Packing..."
TARBALL_FILE="$(npm pack --silent)"
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
