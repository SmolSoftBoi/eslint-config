# eslint-config Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-23

## Active Technologies

- Node.js (ESM package); CI targets Node 20 and Node 22 + ESLint 9 (flat config), TypeScript tooling, `typescript-eslint`, `eslint-plugin-import` (001-ci-publish-codeql)

## Project Structure

```text
.github/workflows/
eslint.config.mjs
index.mjs
package.json
yarn.lock
README.md
```

## Commands

# Add commands for Node.js (ESM package); CI targets Node 20 and Node 22

## Code Style

Node.js (ESM package); CI targets Node 20 and Node 22: Follow standard conventions

## Recent Changes

- 001-ci-publish-codeql: Added Node.js (ESM package); CI targets Node 20 and Node 22 + ESLint 9 (flat config), TypeScript tooling, `typescript-eslint`, `eslint-plugin-import`

<!-- MANUAL ADDITIONS START -->
## Notes for this repo

Actual repository layout is flat (not `src/` / `tests/`). Key paths:

```text
.github/workflows/
eslint.config.mjs
index.mjs
package.json
yarn.lock
README.md
```

Common commands:

- Install (deterministic): `corepack enable && yarn install --immutable`
- Lint: `yarn eslint .`

Release/publish expectations (per spec `001-ci-publish-codeql`): GitHub Release-driven publishing for semver tags `vX.Y.Z` (including prereleases like `vX.Y.Z-rc.1`), with npm provenance enabled.
<!-- MANUAL ADDITIONS END -->
