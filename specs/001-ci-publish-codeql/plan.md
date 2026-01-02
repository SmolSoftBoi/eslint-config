# Implementation Plan: Automated CI, Release & Security Checks

**Branch**: `001-ci-publish-codeql` | **Date**: 2025-12-23 | **Spec**: [`spec.md`](./spec.md)  
**Input**: Feature specification from `/specs/001-ci-publish-codeql/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. For local workflow helpers, see
`.specify/scripts/bash/`.

## Summary

Add three GitHub Actions workflows:

- CI workflow that runs on PRs and pushes, installs deterministically with Yarn, runs `yarn eslint .`, and performs an import smoke-test of the config (consumer-style import from a packed artifact).
- Release workflow that runs for semver GitHub Releases (and supports a gated manual run) and publishes to npm using `NPM_TOKEN` with provenance enabled.
- CodeQL workflow for JavaScript/TypeScript with least-privilege permissions.

Key non-functional requirements: fast feedback, deterministic installs, concurrency to avoid duplicates, and least-privilege permissions.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Node.js (ESM package); CI targets Node LTS + Node current  
**Primary Dependencies**: ESLint 9 (flat config), TypeScript tooling, `typescript-eslint`, `eslint-plugin-import`  
**Storage**: N/A  
**Testing**: Lint (`yarn eslint .`) + import smoke-test (pack/install/import); no separate test runner currently  
**Target Platform**: GitHub Actions `ubuntu-latest` runners  
**Project Type**: Single package repository (ESLint flat-config preset)  
**Performance Goals**: CI feedback in <5 minutes for typical PRs (SC-001)  
**Constraints**: Deterministic installs (lockfile authoritative); least-privilege workflow permissions; avoid duplicate runs via concurrency  
**Scale/Scope**: Small config library; workflows must be simple and maintainable

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Read `.specify/memory/constitution.md` and confirm the work aligns with ALL Core Principles.
- [x] Compatibility-first: ESLint flat config + TS/import tooling impact assessed.
- [x] Predictable/minimal: this change is workflow-only; does not change exported rule behavior.
- [x] Strong DX: quickstart + release notes expectations documented.
- [x] Quality gates: CI enforces `yarn eslint .` and smoke-test.
- [x] Lean deps: no new runtime dependencies required.
- [x] Publishing discipline: GitHub Release-driven publish supports release notes.
- [x] Tooling consistency: uses repo-pinned Yarn via Corepack; no new lockfiles.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

Concrete docs for this feature:

```text
specs/001-ci-publish-codeql/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
  └── github-actions.md
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
.github/
└── workflows/
  ├── ci.yml
  ├── release.yml
  └── codeql.yml

eslint.config.mjs
index.mjs
package.json
yarn.lock
README.md
```

**Structure Decision**: Single-package repository; workflows live in `.github/workflows/` and validate the root package.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Phase 0: Research (output: `research.md`)

Completed in [`research.md`](./research.md). Key conclusions:

- Use Corepack + Yarn `--immutable` for deterministic installs.
- Use Node LTS + current in CI.
- Use GitHub Release-driven publishing with `NPM_TOKEN` and provenance enabled.
- Use concurrency + least-privilege permissions.

## Phase 1: Design & Contracts (outputs: `data-model.md`, `contracts/*`, `quickstart.md`)

Completed:

- [`data-model.md`](./data-model.md) documents workflow/job/secret “entities”.
- [`contracts/github-actions.md`](./contracts/github-actions.md) documents workflow triggers, permissions, secrets, and invariants.
- [`quickstart.md`](./quickstart.md) documents how to run checks locally and how to release.

## Phase 2: Implementation Outline (input to `/speckit.tasks`)

### Workflow: CI (`.github/workflows/ci.yml`)

- Trigger on `pull_request` and `push` to any branch, ignoring version tag pushes.
- Concurrency group per ref; cancel in-progress on new commits.
- Node matrix: LTS + current.
- Steps: checkout → setup-node (cache yarn) → corepack enable → install (immutable + guarded fallback) → `yarn eslint .` → smoke-test.

Smoke-test implementation requirements:

- Pack the package (e.g., `yarn pack` or `npm pack`).
- Install the packed artifact into a temp directory.
- `node --input-type=module -e "import('@smolpack/eslint-config')"` (must succeed).

### Workflow: Release (`.github/workflows/release.yml`)

- Trigger on GitHub Release creation for semver tags and manual dispatch.
- Run the same checks job as CI.
- Publish job:
  - Gate manual dispatch via explicit confirmation input.
  - Validate release notes exist (non-empty GitHub Release body) before publishing.
  - Use `NPM_TOKEN`.
  - Publish with provenance.
  - If scoped package, ensure `--access public`.

### Workflow: CodeQL (`.github/workflows/codeql.yml`)

- Use standard CodeQL for JavaScript/TypeScript.
- Trigger on PRs, pushes to `main`, and scheduled.
- Least privilege permissions.
- Concurrency to avoid duplicate analysis.

### Documentation updates

- Ensure README documents:
  - supported Node versions for CI (LTS + current)
  - release flow (GitHub Release-driven)
  - required secret (`NPM_TOKEN`)

### Validation steps

- Locally: `corepack enable && yarn install --immutable && yarn eslint .`.
- Smoke-test path: verify packed import works.
- In GitHub: verify CI runs on PRs and branch pushes (excluding version tags); verify CodeQL runs; verify release workflow gates manual publish.

Release validation additionally: confirm publish fails before publishing if release notes are missing/empty.
