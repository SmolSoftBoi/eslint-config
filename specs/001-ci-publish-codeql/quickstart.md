# Quickstart: CI, Releases, and Security Scanning

## Local validation (what CI runs)

From the repo root:

- Install dependencies using the repo-pinned Yarn:
  - `corepack enable`
  - `yarn install --immutable`
- Run lint:
  - `yarn eslint .`
- Smoke-test import:
  - Pack and install the artifact (consumer-style import) and ensure `@smolpack/eslint-config` can be imported.

## Releasing / publishing

### Prerequisites

- Configure repository secret `NPM_TOKEN` with an npm automation token that has publish rights for `@smolpack/eslint-config`.

### Standard release flow (GitHub Release-driven)

1. Bump `package.json#version` and commit.
2. Create a tag `vX.Y.Z` (or prerelease like `vX.Y.Z-rc.1`) pointing at the version bump commit.
3. Create a GitHub Release for that tag with human-readable release notes.
4. The release workflow runs checks and publishes to npm.

### Manual publish (workflow_dispatch)

- Use the workflow dispatch UI.
- Provide the required confirmation input to allow publishing.

## CodeQL

- Runs on PRs and pushes to `main`, plus a scheduled run.
- Findings appear under the repository Security/Code scanning views.
