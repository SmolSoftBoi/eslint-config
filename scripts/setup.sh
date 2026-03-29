#!/usr/bin/env bash
set -euo pipefail

echo "✅ Running setup for eslint-config"

run_apt_get() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    apt-get "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get "$@"
    return
  fi

  echo "[setup] ShellCheck installation requires elevated privileges. Install it manually or rerun the script with sudo." >&2
  exit 1
}

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
    if [ -f "$GIT_ROOT/package.json" ] && [ -f "$GIT_ROOT/scripts/yarn-install-immutable.sh" ]; then
      REPO_ROOT="$GIT_ROOT"
    fi
  fi
fi

if [ -z "$REPO_ROOT" ]; then
  echo "[setup] Failed to locate repo root; run from the repository directory." >&2
  exit 1
fi

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "[setup] Installing ShellCheck"
  if command -v apt-get >/dev/null 2>&1; then
    run_apt_get update
    run_apt_get install -y shellcheck
  else
    echo "[setup] Missing package manager to install ShellCheck." >&2
    exit 1
  fi
fi

if command -v corepack >/dev/null 2>&1; then
  echo "[setup] Enabling Corepack"
  corepack enable
fi

echo "[setup] Installing dependencies (immutable)"
(
  cd "$REPO_ROOT"
  ./scripts/yarn-install-immutable.sh
)

echo "✅ Setup complete"
