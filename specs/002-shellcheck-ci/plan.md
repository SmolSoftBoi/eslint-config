# Implementation Plan: ShellCheck Linting

**Branch**: `002-shellcheck-ci` | **Date**: 2026-01-02 | **Spec**: `specs/002-shellcheck-ci/spec.md`  
**Input**: Feature specification from `specs/002-shellcheck-ci/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. For local workflow helpers, see
`.specify/scripts/bash/`.

## Summary

Add a ShellCheck quality gate that:

- Lints shell scripts in-repo (at minimum `scripts/**/*.sh`, plus all repository-tracked `*.sh` files)
- Lints GitHub Actions workflow `run:` scripts (best-effort extraction) using `actionlint` + ShellCheck
- Fails CI on ShellCheck warnings/errors (but not on info/style)
- Provides a local command (`yarn lint:shell`) and brief docs

## Technical Context

**Language/Version**: Node.js (ESM) + Bash scripts; CI on Ubuntu runners  
**Primary Dependencies**: Yarn (Corepack), ESLint flat config; no new runtime deps  
**Storage**: N/A  
**Testing**: CI smoke-test via `scripts/smoke-import-packed.sh`; lint via ESLint; no dedicated unit test framework  
**Target Platform**: GitHub Actions (`ubuntu-latest`)  
**Project Type**: Single package (shareable ESLint flat-config)  
**Performance Goals**: Keep added CI lint step lightweight (target: typically <2 minutes on a clean PR; occasional variance is acceptable and not, by itself, a merge blocker)  
**Constraints**: Minimal permissions; avoid new lockfiles or package-manager drift; avoid adding unnecessary dependencies  
**Scale/Scope**: Lint a small number of repo scripts and workflow `run:` blocks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Read `.specify/memory/constitution.md` and confirm the work aligns with ALL Core Principles.
- [x] Compatibility-first: No impact on exported ESLint config API; CI-only changes.
- [x] Predictable/minimal: Adds a new CI gate and optional local script; no behavior changes to lint rules shipped by the package.
- [x] Strong DX: Add a short README note documenting `yarn lint:shell`.
- [x] Quality gates: Adds an additional lint gate; does not remove/relax existing gates.
- [x] Lean deps: No new npm deps; adds a pinned CI tool (`actionlint`) with justification.
- [x] Publishing discipline: No release behavior change beyond CI/doc; no special release notes required.
- [x] Tooling consistency: No new lockfiles; respects existing Yarn/Corepack patterns.

## Project Structure

### Documentation (this feature)

```text
specs/002-shellcheck-ci/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
.
├── .github/workflows/
│   ├── ci.yml
│   ├── codeql.yml
│   └── release.yml
├── .specify/                 # planning/spec tooling (bash scripts)
├── scripts/                  # repo-owned automation scripts
│   ├── smoke-import-packed.sh
│   └── yarn-install-immutable.sh
├── eslint.config.mjs
├── index.mjs
├── package.json
└── README.md
```

**Structure Decision**: Single-package repository; changes apply at repo root (CI workflow + config + docs + package scripts).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Implementation Plan (code changes)

### 1) Add ShellCheck configuration

- Add `.shellcheckrc` at repo root.
- Keep it minimal and opinionated only about correctness:
  - Enforce minimum severity in CI/local runs with `-S warning` (fail on warnings+errors, not info/style)
  - Set `shell=bash` (current scripts use bash)
  - Avoid global `disable=` entries; if a rule must be suppressed, require an inline disable with a justification comment in the script.

### 2) Add CI job: `shellcheck`

Update `.github/workflows/ci.yml`:

- Add a new job `shellcheck` that runs on `pull_request` and `push` (including `main`) and uses `ubuntu-latest`.
- Permissions must remain minimal (inherit existing `contents: read`).
- Steps (reusing existing style):
  1. Checkout
  2. Install ShellCheck via apt-get
  3. Run ShellCheck on repository-tracked `*.sh` files (ensuring `scripts/**/*.sh` are included), excluding dependency tooling under `.specify/scripts/**`. Prefer `git ls-files` to lint only tracked scripts and avoid scanning irrelevant paths (e.g., `node_modules/`, generated output).
  4. Run `actionlint` to lint workflow files and apply ShellCheck to `run:` scripts (best-effort detection, blocking when lintable and warnings/errors are found).

Notes:

- `actionlint` should be pinned (tag or commit SHA) to reduce supply-chain drift.
- No caching required.

### 3) Add local developer scripts

Update `package.json` scripts:

- Add `lint:shell` to run ShellCheck locally against the same set of repo-tracked `*.sh` files.
- Optionally add/extend `lint` to include `lint:shell` (only if the repo already has a `lint` script convention; otherwise keep `lint:shell` standalone).

### 4) Documentation

- Add a short README (or CONTRIBUTING) note describing:
  - Prerequisite: ShellCheck installed locally
  - Run command: `yarn lint:shell`
  - CI behavior: also lints workflow `run:` blocks (best-effort) to catch workflow shell bugs

## Validation

- CI: PR should show a distinct `shellcheck` job status.
- Local: `yarn lint:shell` returns exit code 0 when clean; non-zero when warnings/errors exist.

## Rollout / Backwards Compatibility

- This is a CI + tooling change only; no impact to package runtime consumers.
- If existing scripts fail ShellCheck, fix them or add targeted suppressions with justification.

## Constitution Re-check (post-design)

- Compatibility-first: unchanged.
- Predictable/minimal: `.shellcheckrc` stays minimal; no broad suppressions (especially avoid blanket disabling of common-footgun checks like SC2086/SC2155).
- Strong DX: README includes a single command (`yarn lint:shell`) and brief guidance.
- Quality gates: adds an additional CI job; does not weaken existing gates.
- Lean deps: no runtime deps; CI uses a pinned workflow action/tool (`actionlint`) with clear purpose.
- Tooling consistency: no lockfiles introduced; no package-manager changes.
