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

cleanup() {
  if [ -n "${PACK_DIR:-}" ]; then
    rm -rf "$PACK_DIR"
  fi

  if [ -n "${CONSUMER_DIR:-}" ]; then
    rm -rf "$CONSUMER_DIR"
  fi
}

detect_yarn_pack_output_flag() {
  local yarn_version
  local yarn_major

  if ! yarn_version="$(yarn --version 2>/dev/null)"; then
    annotate error "Failed to determine Yarn version"
    exit 1
  fi

  yarn_major="${yarn_version%%.*}"
  case "$yarn_major" in
    0|1)
      echo "--filename"
      ;;
    ''|*[!0-9]*)
      annotate error "Unsupported Yarn version: ${yarn_version}"
      exit 1
      ;;
    *)
      echo "--out"
      ;;
  esac
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
  const peerInstallSpecs = Object.entries(pkg.peerDependencies ?? {}).map(([peerName, peerRange]) => {
    const installRange =
      pkg.devDependencies?.[peerName] ??
      pkg.dependencies?.[peerName] ??
      peerRange;

    return `${peerName}@${installRange}`;
  });
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
  console.log(`${name}\n${entry}\n${JSON.stringify(peerInstallSpecs)}`);
} catch (e) {
  console.error('Failed to read package name from package.json:', e?.message ?? e);
  process.exit(1);
}
NODE
)"; then
  annotate error "Failed to read package name from package.json"
  exit 1
fi

PKG_NAME="$(printf '%s\n' "$PKG_META" | sed -n '1p')"
PKG_ENTRY="$(printf '%s\n' "$PKG_META" | sed -n '2p')"
PEER_INSTALL_SPECS_JSON="$(printf '%s\n' "$PKG_META" | sed -n '3p')"

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

CONSUMER_DIR=""
trap cleanup EXIT

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

echo "[smoke-import-packed] Temp dir: $CONSUMER_DIR"

# Pack from repo root using Yarn to reflect publish artifacts.
echo "[smoke-import-packed] Packing with Yarn..."
TARBALL_PATH="${PACK_DIR}/package.tgz"
PACK_OUTPUT_FLAG="$(detect_yarn_pack_output_flag)"
if ! yarn pack "$PACK_OUTPUT_FLAG" "$TARBALL_PATH"; then
  annotate error "yarn pack failed"
  exit 1
fi

echo "[smoke-import-packed] Tarball: $TARBALL_PATH"

ENTRY_TAR_PATH="package/${ENTRY_RELATIVE}"
if ! TARBALL_CONTENTS="$(tar -tf "$TARBALL_PATH")"; then
  annotate error "Failed to inspect tarball contents: ${TARBALL_PATH}"
  exit 1
fi

if ! printf '%s\n' "$TARBALL_CONTENTS" | grep -F -x -- "$ENTRY_TAR_PATH" >/dev/null; then
  annotate error "Expected entry point not found in tarball: ${ENTRY_TAR_PATH}"
  exit 1
fi

cd "$CONSUMER_DIR"

# Create a minimal consumer project and install the tarball.
# Silence audit/fund noise to keep CI logs clean.
# Install the repo's own peer package versions in the disposable consumer app so
# the import check reflects a compatible consumer environment.
npm init -y >/dev/null 2>&1

if ! PEER_INSTALL_OUTPUT="$(
  SMOKE_PEER_INSTALL_SPECS="$PEER_INSTALL_SPECS_JSON" node --input-type=module <<'NODE'
const specs = JSON.parse(process.env.SMOKE_PEER_INSTALL_SPECS ?? '[]');
for (const spec of specs) {
  console.log(spec);
}
NODE
)"; then
  annotate error "Failed to determine peer dependency install specs"
  exit 1
fi

PEER_INSTALL_ARGS=()
if [ -n "$PEER_INSTALL_OUTPUT" ]; then
  while IFS= read -r spec; do
    PEER_INSTALL_ARGS+=("$spec")
  done <<EOF
$PEER_INSTALL_OUTPUT
EOF
fi

INSTALL_ARGS=("$TARBALL_PATH")
if [ "${#PEER_INSTALL_ARGS[@]}" -gt 0 ]; then
  INSTALL_ARGS+=("${PEER_INSTALL_ARGS[@]}")
fi

if [ "${SMOKE_USE_LEGACY_PEER_DEPS:-}" = "1" ] || [ "${SMOKE_USE_LEGACY_PEER_DEPS:-}" = "true" ]; then
  npm install --silent --no-audit --no-fund --legacy-peer-deps "${INSTALL_ARGS[@]}"
else
  npm install --silent --no-audit --no-fund "${INSTALL_ARGS[@]}"
fi

# Run the import assertion from within the temp consumer project so Node resolves
# the package from its local node_modules.
cp "$ROOT_DIR/scripts/smoke-import-packed.mjs" ./smoke-import-packed.mjs

# Import by package name as consumers do.
# Also assert a default export exists, since the README implies default export usage.
echo "[smoke-import-packed] Importing ${PKG_NAME}..."
node ./smoke-import-packed.mjs "$PKG_NAME"

echo "[smoke-import-packed] OK"
