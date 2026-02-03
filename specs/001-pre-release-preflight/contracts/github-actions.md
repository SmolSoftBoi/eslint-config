# Contracts: GitHub Actions Workflows (Pre-release Preflight)

This document describes required workflow behavior for pre-release validation.

## CI Workflow (`.github/workflows/ci.yml`)

### Triggers
- `pull_request`
- `push` on any branch; MUST NOT trigger on tag push events.

### Concurrency
- One active run per ref; in-progress runs canceled on new commits.

### Permissions
- `contents: read`

### Required Steps
- Install dependencies via Yarn (immutable install behavior preserved).
- Run pre-release validation via `yarn prerelease`.
- Validate on both the latest Node LTS release and the latest stable Node release.

## Release Workflow (`.github/workflows/release.yml`)

### Triggers
- GitHub Release event (`published`)
- `workflow_dispatch` (manual)

### Permissions
- `contents: read`
- `id-token: write`

### Required Steps
- Validate release tag, release notes, and version match (existing behavior).
- Install dependencies via Yarn (immutable install behavior preserved).
- Run pre-release validation via `yarn prerelease` before publish.
- Publish with `npm publish` and provenance enabled.

## CodeQL Workflow (`.github/workflows/codeql.yml`)

### No changes required
- CodeQL triggers and configuration remain unchanged.
