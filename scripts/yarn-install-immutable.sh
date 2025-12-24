#!/usr/bin/env bash
set -euo pipefail

# Deterministic Yarn install helper.
# - Prefer an immutable install.
# - If immutable fails, fall back to a normal install BUT fail if yarn.lock changed.
#
# Intended for CI, but also usable locally.

echo "[yarn-install-immutable] yarn --version: $(yarn --version 2>/dev/null || true)"

echo "[yarn-install-immutable] Running: yarn install --immutable"
if yarn install --immutable; then
  echo "[yarn-install-immutable] Immutable install succeeded"
  exit 0
fi

echo "::warning::yarn install --immutable failed; falling back to yarn install. If this changes yarn.lock, commit the lockfile."

echo "[yarn-install-immutable] Running: yarn install"
yarn install

# Guard against lockfile drift.
if command -v git >/dev/null 2>&1; then
  echo "[yarn-install-immutable] Verifying yarn.lock did not change"
  git diff --exit-code yarn.lock
else
  echo "::warning::git not found; skipping yarn.lock drift check"
fi
