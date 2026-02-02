# Feature Specification: Pre-release Preflight

**Feature Branch**: `001-pre-release-preflight`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: User description: "Add a pre-release script for this npm package so we can validate quality and packaging before publishing. Deliverables: (1) package.json scripts for preflight and prerelease (or equivalent) that run formatting/linting, type checks (if applicable), tests (if any), and a packaging smoke-test using npm pack to ensure the tarball contains the right files and the entry points import correctly, (2) update CI/release workflows to call the pre-release script, and (3) brief docs note for maintainers."

## Clarifications

### Session 2026-01-30

- Q: How should the packaging smoke test determine expected files and entry points? → A: Derive expected files/entry points from package.json (files, main, exports) and require a minimum set of critical files.
- Q: Which scripts should be added? → A: Add `preflight`, `pack:check`, `smoke:import`, and `prerelease` scripts.
- Q: Should `prerelease` run `preflight`? → A: Yes, `prerelease` should run `preflight` plus packaging checks.
- Q: Should formatting/linting checks be check-only or allow autofix? → A: Allow autofix formatting/linting.
- Q: Which publish command is used? → A: `npm publish`.
- Q: Should a `prepublishOnly` hook be used? → A: Optional; if added, it must run `prerelease`.
- Q: Which Node versions should the smoke test validate? → A: Validate both current Node LTS and current.
- Q: Which files must be guaranteed in the release archive? → A: `eslint.config.mjs`, `index.mjs`, `README.md`, `LICENSE`.
- Q: What is the local opt-out mechanism for packed tarball import? → A: Set `SKIP_PACKED_IMPORT=1` locally; CI must fail if this is set.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run preflight before publish (Priority: P1)

As a maintainer, I want a single pre-release command that checks formatting/linting, type checks (if applicable), tests (if any), and packaging smoke tests so I can confidently publish without breaking quality or packaging.

**Why this priority**: Publishing broken or incomplete packages is the highest-risk failure; a single pre-release command reduces mistakes.

**Independent Test**: Can be fully tested by running the pre-release command locally and confirming it completes with all expected checks.

**Acceptance Scenarios**:

1. **Given** a clean working tree, **When** I run the pre-release command, **Then** it executes formatting/linting, type checks (if applicable), tests (if any), and packaging smoke tests in a single run.
2. **Given** a failure in any step, **When** I run the pre-release command, **Then** it fails fast and reports the failing step clearly.

---

### User Story 2 - CI and release enforcement (Priority: P2)

As a maintainer, I want CI/release workflows to run the same pre-release command so that automation blocks broken releases.

**Why this priority**: Automated enforcement prevents human error and keeps release quality consistent.

**Independent Test**: Can be fully tested by triggering CI/release workflows and verifying the pre-release command runs.

**Acceptance Scenarios**:

1. **Given** a CI run, **When** the workflow executes, **Then** it calls the pre-release command and fails on errors.

---

### User Story 3 - Maintainership guidance (Priority: P3)

As a maintainer, I want brief documentation on the pre-release process so I know which command to run and why.

**Why this priority**: Clear guidance reduces onboarding time and prevents skipped steps.

**Independent Test**: Can be tested by reading the maintainer docs and verifying they mention the pre-release command and purpose.

**Acceptance Scenarios**:

1. **Given** the maintainer docs, **When** I review the release steps, **Then** the pre-release command and its purpose are documented.

---

### Edge Cases

- Pre-release command should handle missing optional checks (no type checks or tests configured) without failing.
- Packaging smoke test should fail if the release archive is missing expected files or entry points cannot be imported.
- CI should not proceed to publish when pre-release command fails.
- Packed tarball import may be skipped only when explicitly requested for local debugging and must never be skipped in CI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The package scripts MUST include `preflight`, `pack:check`, `smoke:import`, and `prerelease` commands.
- **FR-001a**: `preflight` MUST run the repository's `lint` script unconditionally; if `lint` is missing from package.json, the preflight MUST fail.
- **FR-001d-i**: When `lint:shell`, `typecheck`, or `test` scripts are present in package.json, `preflight` MUST invoke each of them in this order: `lint:shell`, `typecheck`, `test`.
- **FR-001d-ii**: If any of these scripts fail, `preflight` MUST fail immediately and skip remaining optional scripts.
- *Note (non-normative)*: Because **FR-001b** requires `prerelease` to run `preflight`, `pack:check`, and `smoke:import` in sequence, any `preflight` failure will cause `prerelease` to fail before running `pack:check` or `smoke:import`.
- **FR-001d-iii**: When any of these scripts are absent, their corresponding steps MUST be skipped and MUST NOT cause the preflight to fail.
- **FR-001b**: `prerelease` MUST run `preflight`, `pack:check`, and `smoke:import` in sequence.
- **FR-002**: The pre-release command MUST fail the overall run if any step fails.
- **FR-003**: The packaging smoke test MUST verify that the release archive contains the expected files and that published entry points import successfully.
- **FR-003a**: Expected files and entry points MUST be derived from package.json fields (files, main, exports).
- **FR-003b**: The release archive MUST contain `eslint.config.mjs`, `index.mjs`, `README.md`, and `LICENSE`.
- **FR-003c**: Packed tarball import may be skipped only for local (non-CI) runs when `SKIP_PACKED_IMPORT=1` is set.
- **FR-003d**: In CI, workflows MUST treat `SKIP_PACKED_IMPORT=1` as an error and fail the job, and MUST always execute the packed tarball import step (no skipping based on this variable).
- **FR-004**: CI/release workflows MUST invoke the pre-release command before any publish step.
- **FR-005**: Maintainer documentation MUST describe the pre-release command and when to use it.
- **FR-006**: Formatting/linting steps MAY apply autofixes when running the pre-release command.
- **FR-007**: Publishing MUST use `npm publish`.
- **FR-008**: If a `prepublishOnly` hook is added, it MUST run `prerelease`.
- **FR-009**: CI packaging smoke tests MUST run on both current Node LTS and current Node releases. Release workflow may remain LTS-only.
- **FR-010**: Packaging and import checks SHOULD be implemented with cross-platform Node scripts rather than shell scripts.
- **FR-011**: Failure messages MUST be actionable (clearly indicate the missing file, failed import, or missing command).

### Assumptions

- If type checks or tests are not configured, the pre-release command will skip those steps without failing.
- Optional script execution is intended to allow repositories that rely on other tooling or CI orchestration for these checks to pass without defining all of these scripts explicitly in `package.json`.
- Formatting/linting is already defined by existing scripts and can be invoked as part of the pre-release command.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of release runs execute the pre-release command before publish.
- **SC-002**: Packaging smoke tests detect missing files or broken entry points in the release archive in 100% of simulated failures.
- **SC-003**: Maintainers can complete the documented pre-release process in under 5 minutes.
- **SC-004**: Zero releases are published when any pre-release check fails.
