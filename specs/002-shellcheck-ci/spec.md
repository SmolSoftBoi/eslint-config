# Feature Specification: ShellCheck Linting

**Feature Branch**: `002-shellcheck-ci`  
**Created**: 2026-01-02  
**Status**: Approved  
**Input**: User description: "Add ShellCheck to this repo to lint Bash/shell scripts (e.g., scripts/**/*.sh), ensure CI automation doesn’t introduce obvious shell bugs, provide a minimal repository config, optionally support a one-command local run, and document how to use it."

## Clarifications

### Session 2026-01-02

- Q: What counts as “in scope” for shell linting? → A: Lint `scripts/**/*.sh` plus any repository-tracked `*.sh` files, and attempt to lint shell snippets embedded in GitHub Actions workflow `run:` blocks.
- Q: Should lint findings in GitHub Actions workflow `run:` blocks fail CI? → A: Yes—when a `run:` block can be linted, findings are blocking (CI fails).
- Q: Which ShellCheck severity level should fail CI? → A: Fail CI on warnings+errors (ignore info/style).

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Prevent shell bugs in CI (Priority: P1)

As a maintainer, I want the continuous integration checks to flag common shell scripting issues early, so that obvious bugs don’t get merged and later break automation.

**Why this priority**: Shell scripts are often used for automation; catching common mistakes early reduces failures and review time.

**Independent Test**: Can be fully tested by opening a pull request that introduces a known shell lint issue in a tracked script and confirming the check fails with actionable feedback.

**Acceptance Scenarios**:

1. **Given** a pull request changes one or more tracked shell script files, **When** the CI workflow runs, **Then** the lint job reports findings and fails the workflow when issues are detected.
2. **Given** a pull request does not change any tracked shell script files, **When** the CI workflow runs, **Then** the lint job completes successfully (and does not fail due to “no files” conditions).

---

### User Story 2 - Run the same lint locally (Priority: P2)

As a contributor, I want an easy way to run the same shell lint check locally, so I can catch issues before pushing changes.

**Why this priority**: Fast local feedback reduces CI churn and makes it easier to keep contributions clean.

**Independent Test**: Can be fully tested by running a documented local command that produces the same pass/fail outcome as CI for a given script change.

**Acceptance Scenarios**:

1. **Given** a working copy of the repository, **When** I run the documented lint command, **Then** it reports issues for tracked shell script files and exits non-zero when issues are found.

---

### Edge Cases

- Repository contains no tracked `*.sh` files (job should still pass; avoid “no files” failures).
- Shell scripts use different shells or shebangs (lint should apply consistent defaults and allow explicit overrides per file when required).
- Irrelevant paths (dependencies, generated output) must not be linted; prefer selecting tracked files (e.g., `git ls-files '*.sh'`) rather than scanning the filesystem.
- GitHub Actions workflows contain `run:` blocks that are not shell (or are ambiguous); linting should be best-effort and avoid false failures when a shell cannot be confidently determined.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST include a dedicated CI check that lints tracked shell script files and fails when issues are detected.
- **FR-002**: The CI check MUST use a repository-stored configuration file so lint behavior is consistent across CI and local runs.
- **FR-003**: The lint check MUST target `scripts/**/*.sh` and MUST exclude irrelevant paths (e.g., dependencies and generated content) to keep results actionable.
- **FR-003a**: The lint check MUST also target all repository-tracked `*.sh` files outside of `scripts/`.
- **FR-004**: The CI check MUST attempt to lint shell snippets embedded in GitHub Actions workflow `run:` blocks.
- **FR-005**: The workflow `run:` block linting MUST be best-effort for detection/extraction: it SHOULD lint when a shell can be reasonably determined, and it MUST avoid failing solely due to ambiguous/non-shell `run:` blocks.
- **FR-006**: When a workflow `run:` block is successfully linted and ShellCheck reports issues, the CI check MUST fail.
- **FR-007**: The repository SHOULD provide a simple local run entry point (via existing developer tooling conventions) that runs the same lint rules as CI.
- **FR-008**: The repository MUST document how to run the lint check locally and what contributors should do when lint issues are reported.
- **FR-009**: The CI check MUST enforce a consistent severity threshold: it MUST fail on ShellCheck warnings and errors, and it MUST NOT fail solely on info/style findings.

### Assumptions & Dependencies

- Contributors and CI runners have access to a standard ShellCheck runtime (directly or via a common CI-provided mechanism).
- Only repository-owned shell scripts are in scope; third-party or generated scripts are excluded.
- The CI system supports adding an additional job/check that can fail the workflow on lint findings.
- GitHub Actions workflows may include inline shell snippets in `run:` blocks that are desirable to lint.

### Out of Scope

- Rewriting existing scripts for style beyond addressing lint findings.
- Linting non-shell languages or validating GitHub Actions workflow YAML beyond what is necessary to find and lint relevant `run:` blocks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests that change tracked shell script files receive a pass/fail lint signal as part of CI.
- **SC-001a**: 100% of pull requests that change GitHub Actions workflow files receive a pass/fail lint signal for any `run:` blocks that can be linted.
- **SC-002**: Contributors can follow documentation to run the lint check locally in one step and see a clear pass/fail result.
- **SC-003**: Lint findings presented in CI are specific enough that a contributor can identify the failing file(s) and rule(s) without additional guidance.
- **SC-004 (Target)**: The lint job should typically complete within 2 minutes for a clean pull request run; occasional variance is acceptable and is not, by itself, a merge blocker.
- **SC-005**: A change that introduces a ShellCheck warning or error reliably fails CI; a change that introduces only info/style findings does not.
