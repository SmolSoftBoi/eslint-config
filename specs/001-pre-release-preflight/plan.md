# Implementation Plan: Pre-release Preflight

**Branch**: `001-pre-release-preflight` | **Date**: 2026-01-30 | **Spec**: [specs/001-pre-release-preflight/spec.md](specs/001-pre-release-preflight/spec.md)
**Input**: Feature specification from `/specs/001-pre-release-preflight/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. For local workflow helpers, see
`.specify/scripts/bash/`.

## Summary

Introduce pre-release validation scripts (`preflight`, `pack:check`, `smoke:import`, `prerelease`) that run linting, packaging checks, and import smoke tests using cross-platform Node helpers. Update CI and Release workflows to run `yarn prerelease` before publish. Add maintainer documentation for the new pre-release flow.

## Technical Context

**Language/Version**: Node.js (ESM), JavaScript  
**Primary Dependencies**: Yarn 4, ESLint, Prettier, TypeScript (dev)  
**Storage**: N/A  
**Testing**: No formal test runner; smoke tests via Node scripts  
**Target Platform**: Node.js (local + GitHub Actions runners)  
**Project Type**: single package  
**Performance Goals**: N/A  
**Constraints**: Cross-platform scripts, no new lockfiles, minimal dependencies  
**Scale/Scope**: Small library package with CI/release workflows

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Read `.specify/memory/constitution.md` and confirm the work aligns with ALL Core Principles.
- [x] Compatibility-first: ESLint flat config + TS/import tooling impact assessed.
- [x] Predictable/minimal: change is SemVer-appropriate; no surprise rule behavior changes.
- [x] Strong DX: docs/examples/upgrade notes updated if user-facing behavior changes.
- [x] Quality gates: lint passes; rule/config behavior changes have tests/fixtures.
- [x] Lean deps: new deps are justified; prefer peer deps for ecosystem tooling.
- [x] Publishing discipline: release notes/changelog plan exists for behavior changes.
- [x] Tooling consistency: no new lockfiles; avoid package manager drift.

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

### Source Code (repository root)

```text
.
├── eslint.config.mjs
├── index.mjs
├── package.json
├── README.md
├── scripts/
│   ├── lint.mjs
│   ├── lint-shell.mjs
│   ├── parse-npm-pack-filename.mjs
│   ├── smoke-import-packed.mjs
│   └── prerelease/
│       ├── pack-check.mjs
│       ├── smoke-import.mjs
│       └── utils.mjs
└── .github/workflows/
    ├── ci.yml
    └── release.yml
```

**Structure Decision**: Single-package repository with new `scripts/prerelease/` Node helpers for cross-platform pre-release checks.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
