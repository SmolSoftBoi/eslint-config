# Contracts: GitHub Actions Workflows

This document describes the expected interface and invariants for the workflows.

## CI Workflow (`.github/workflows/ci.yml`)

### Triggers
- `pull_request`
- `push` (any branch; ignore version tag pushes)

### Concurrency
- One active run per ref; in-progress runs should be canceled on new commits.

### Permissions
- `contents: read`

### Required steps
- Enable Corepack
- Install dependencies (immutable; lockfile must remain unchanged)
- `yarn eslint .`
- Smoke-test import of the packaged config (consumer-style)

## Release Workflow (`.github/workflows/release.yml`)

### Triggers
- GitHub Release event for tags matching semver policy
- `workflow_dispatch` (manual)

### Inputs
- `confirm_publish` (boolean): must be true to publish on workflow dispatch

### Permissions
- `contents: read`
- `id-token: write` (for npm provenance)

### Secrets
- `NPM_TOKEN`: required to publish

### Publishing
- Workflow MUST validate release notes exist (non-empty GitHub Release body) before publishing.
- Workflow MUST only publish for GitHub Releases where the `tag_name` matches the semver tag policy.
- Must publish with npm provenance enabled
- Must use `--access public` when publishing a scoped package

## CodeQL (`.github/workflows/codeql.yml`)

### Triggers
- `pull_request`
- `push` to `main`
- scheduled (weekly)

### Permissions
- `contents: read`
- `security-events: write`

### Language scope
- Analyze JavaScript + TypeScript (CodeQL `javascript-typescript`)
