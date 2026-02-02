#!/usr/bin/env bash
set -euo pipefail

echo "✅ Running maintenance for eslint-config"

RUN_DIR="$(pwd)"
REPO_ROOT=""

while [ -n "$RUN_DIR" ] && [ "$RUN_DIR" != "/" ]; do
  if [ -f "$RUN_DIR/package.json" ] && [ -f "$RUN_DIR/scripts/yarn-install-immutable.sh" ]; then
    REPO_ROOT="$RUN_DIR"
    break
  fi
  RUN_DIR="$(dirname "$RUN_DIR")"
done

if [ -z "$REPO_ROOT" ] && command -v git >/dev/null 2>&1; then
  if GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    REPO_ROOT="$GIT_ROOT"
  fi
fi

if [ -z "$REPO_ROOT" ]; then
  echo "[maintenance] Failed to locate repo root; run from the repository directory." >&2
  exit 1
fi

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "[maintenance] Installing ShellCheck"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y shellcheck
  else
    echo "[maintenance] Missing package manager to install ShellCheck." >&2
    exit 1
  fi
fi

if command -v corepack >/dev/null 2>&1; then
  echo "[maintenance] Enabling Corepack"
  corepack enable
fi

echo "[maintenance] Installing dependencies (immutable)"
"$REPO_ROOT/scripts/yarn-install-immutable.sh"

echo "✅ Maintenance complete"
