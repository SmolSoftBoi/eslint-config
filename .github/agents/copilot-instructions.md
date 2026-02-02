# eslint-config Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-23

## Active Technologies
- Node.js (ESM) + Bash scripts; CI on Ubuntu runners + Yarn (Corepack), ESLint flat config; no new runtime deps (002-shellcheck-ci)
- Node.js (ESM), JavaScript + Yarn 4, ESLint, Prettier, TypeScript (dev) (001-pre-release-preflight)

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

### Notes
Command references are maintained in the Manual Additions section below under the "Common commands" heading (install, lint) and the "Release/publish expectations" note.


## Code Style

Node.js (ESM package); CI targets Node 20 and Node 22: Follow standard conventions

## Recent Changes
- 001-pre-release-preflight: Added Node.js (ESM), JavaScript + Yarn 4, ESLint, Prettier, TypeScript (dev)
- 002-shellcheck-ci: Added Node.js (ESM) + Bash scripts; CI on Ubuntu runners + Yarn (Corepack), ESLint flat config; no new runtime deps


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

### Common commands

- Install (deterministic): `corepack enable && yarn install --immutable`
- Lint: `yarn eslint .`

### Release/publish expectations

GitHub Release-driven publishing for semver tags `vX.Y.Z` (including prereleases like `vX.Y.Z-rc.1`), with npm provenance enabled (per spec `001-ci-publish-codeql`).
<!-- MANUAL ADDITIONS END -->
