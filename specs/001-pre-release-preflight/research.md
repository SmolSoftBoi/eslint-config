# Research: Pre-release Preflight

## Decision 1: Source of packaged file list

**Decision**: Use `npm pack --json` output to obtain the packaged file list.

**Rationale**: `npm pack --json` already returns a `files` array and is cross-platform. This avoids adding a tar parsing dependency or relying on `tar` CLI availability.

**Alternatives considered**:
- Parse the tarball with a Node dependency (e.g., `tar`) → rejected due to added dependency and maintenance overhead.
- Shelling out to `tar -tf` → rejected due to non-portability on Windows.

## Decision 2: Packaging smoke-test implementation

**Decision**: Implement packaging and import checks as Node scripts under `scripts/prerelease/` and invoke them via npm/yarn scripts.

**Rationale**: Node scripts are cross-platform and allow consistent error messaging. This replaces bash-only smoke scripts in CI while keeping the same behavior.

**Alternatives considered**:
- Continue using bash scripts → rejected due to cross-platform constraint.
- Use a single monolithic Node script → rejected in favor of smaller, focused scripts (`pack:check`, `smoke:import`).

## Decision 3: Node version coverage for smoke tests

**Decision**: Run packaging and import checks on both current Node LTS and current Node in CI.

**Rationale**: Matches existing CI matrix and provides coverage for current and upcoming Node behavior changes.

**Alternatives considered**:
- LTS-only → rejected to keep parity with current CI coverage.

## Decision 4: Required files in release archive

**Decision**: Require `eslint.config.mjs`, `index.mjs`, `README.md`, and `LICENSE` in the package tarball.

**Rationale**: These files represent the public entry points and essential documentation/license artifacts.

**Alternatives considered**:
- Rely solely on `package.json#files` → rejected to ensure minimum critical files are always present.
