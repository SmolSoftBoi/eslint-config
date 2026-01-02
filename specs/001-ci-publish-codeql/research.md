# Research: GitHub Actions CI + Release + CodeQL

**Feature**: `001-ci-publish-codeql`  
**Date**: 2025-12-23

This feature is primarily workflow/configuration work. Research focuses on best-practice workflow patterns for speed, determinism, least-privilege permissions, and safe publishing.

## Decisions

### Deterministic installs with Yarn

- **Decision**: Use `corepack enable` and `yarn install --immutable`.
- **Rationale**: Ensures the CI environment uses the repo-pinned Yarn version (`package.json#packageManager`) and that the lockfile is authoritative.
- **Alternatives considered**:
  - `yarn install` without `--immutable`: faster to get unblocked but can hide lockfile drift.
  - `npm ci`: not aligned with repository package manager.

### Immutable install fallback

- **Decision**: Allow an *explicit* fallback path when `--immutable` fails, but guard it with a lockfile diff check.
- **Rationale**: Provides a clearer failure mode when the repo’s lockfile is out of date while still keeping the run deterministic (the lockfile must remain unchanged).
- **Alternatives considered**:
  - Hard fail immediately: simplest and most deterministic but yields poorer diagnostics.

### CI runtime versions

- **Decision**: Run CI on Node.js 20 and 22.
- **Rationale**: Covers current LTS lines used by most consumers while keeping the matrix small.
- **Alternatives considered**:
  - Single Node version: faster but less coverage.
  - Wider matrix: more confidence but slower.

### Smoke-test definition (published entry)

- **Decision**: The smoke-test should import the package **as consumers do**, from a packed artifact.
- **Rationale**: Catches packaging/exports mistakes that a relative-file import would miss.
- **Alternatives considered**:
  - Importing `./index.mjs` directly: faster but not representative of published usage.

### Release trigger model

- **Decision**: Release/publish automation is **GitHub Release-driven**, and constrained to semantic version tags (`vMAJOR.MINOR.PATCH` including prereleases like `-rc.1`).
- **Rationale**: Fits “publishing discipline”: releases have human-readable release notes; GitHub Releases are a clear gate.
- **Alternatives considered**:
  - Tag-driven publish on `push tags v*`: simpler but easier to accidentally publish.

### npm publishing auth + provenance

- **Decision**: Publish using `NPM_TOKEN` and enable npm provenance.
- **Rationale**: Tokens are the most widely supported auth path; provenance improves supply-chain integrity.
- **Alternatives considered**:
  - Token-only without provenance: simpler but less secure.
  - OIDC-only: clean security model but more brittle depending on registry setup.

### Least privilege + concurrency

- **Decision**: Default workflow permissions to `contents: read`; grant write permissions only where necessary (e.g., CodeQL `security-events: write`, publish `id-token: write`). Add concurrency groups for CI and CodeQL.
- **Rationale**: Minimizes blast radius and avoids duplicate runs.
- **Alternatives considered**:
  - Default permissions: quicker to write but violates least-privilege.

## Notes / Follow-ups

- If the repo’s own lint rules cause false positives for internal devDependencies, address that in the repo ESLint config without changing the *published* config API.
