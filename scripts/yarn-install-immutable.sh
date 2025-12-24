#!/usr/bin/env bash
set -euo pipefail

# Deterministic Yarn install helper.
# - Prefer an immutable install.
# - If immutable fails, fall back to a normal install BUT fail if yarn.lock changed.
#
# Intended for CI, but also usable locally.

echo "[yarn-install-immutable] yarn --version: $(yarn --version 2>/dev/null || true)"

echo "[yarn-install-immutable] Running: yarn install --immutable"
immutable_log="$(mktemp "${TMPDIR:-/tmp}/yarn-install-immutable.XXXXXX.log")"
cleanup() {
  rm -f "$immutable_log"
}
trap cleanup EXIT

if yarn install --immutable 2>"$immutable_log"; then
  echo "[yarn-install-immutable] Immutable install succeeded"
  exit 0
fi

echo "::warning::yarn install --immutable failed. Showing stderr (last 200 lines, or fewer) for debugging:"
if [ -s "$immutable_log" ]; then
  tail -n 200 "$immutable_log" || true
else
  echo "[yarn-install-immutable] No stderr captured."
fi

echo "::warning::Falling back to yarn install. The lockfile may be out of sync. Run yarn install locally and commit the updated yarn.lock if it changes."

echo "[yarn-install-immutable] Running: yarn install"
yarn install

# Guard against lockfile drift.
if command -v git >/dev/null 2>&1; then
  echo "[yarn-install-immutable] Verifying yarn.lock did not change"
  git diff --exit-code yarn.lock
else
  echo "::warning::git not found; skipping yarn.lock drift check"
fi
