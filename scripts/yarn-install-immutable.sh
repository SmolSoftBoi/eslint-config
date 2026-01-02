#!/usr/bin/env bash
set -euo pipefail

# Deterministic Yarn install helper.
# - Prefer an immutable install.
# - If immutable fails, fall back to a normal install BUT fail if yarn.lock changed.
#
# Intended for CI, but also usable locally.

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

annotate warning "yarn install --immutable failed. Showing captured stderr (first and last 200 lines, or all if shorter) for debugging:"
if [ -s "$immutable_log" ]; then
  total_lines=$(wc -l < "$immutable_log" || echo 0)
  if [ "$total_lines" -le 400 ]; then
    cat "$immutable_log" || true
  else
    echo "[yarn-install-immutable] --- BEGIN stderr (first 200 lines) ---"
    head -n 200 "$immutable_log" || true
    echo "[yarn-install-immutable] --- ... truncated middle of stderr ... ---"
    echo "[yarn-install-immutable] --- END stderr (last 200 lines) ---"
    tail -n 200 "$immutable_log" || true
  fi
else
  echo "[yarn-install-immutable] No stderr captured."
fi

annotate warning "Falling back to yarn install. The lockfile may be out of sync. Run yarn install locally and commit the updated yarn.lock if it changes."

echo "[yarn-install-immutable] Running: yarn install"
yarn install

# Guard against lockfile drift.
if command -v git >/dev/null 2>&1; then
  echo "[yarn-install-immutable] Verifying yarn.lock did not change"
  if ! git diff --exit-code yarn.lock; then
    annotate error "yarn.lock changed after fallback yarn install. Run 'yarn install' locally and commit the updated yarn.lock."
    exit 1
  fi
else
  if is_github_actions; then
    annotate error "git not found in CI; failing yarn.lock drift check"
    exit 1
  else
    annotate warning "git not found; skipping yarn.lock drift check"
  fi
fi
