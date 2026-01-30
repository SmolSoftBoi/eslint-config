---

description: "Task list for pre-release preflight implementation"
---

# Tasks: Pre-release Preflight

**Input**: Design documents from `/specs/001-pre-release-preflight/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/github-actions.md

**Tests**: No new test suite requested; validation is handled via pre-release scripts and CI workflows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared utilities needed by multiple scripts

- [ ] T001 Create shared pre-release utilities module in scripts/prerelease/utils.mjs with baseline helpers for reading package metadata and discovering available scripts
- [ ] T013 [P] Implement npm pack execution helpers in scripts/prerelease/utils.mjs, building on the baseline helpers from T001 (metadata reading and script discovery helpers)
- [ ] T014 [P] Implement actionable error formatting helpers in scripts/prerelease/utils.mjs, building on the baseline helpers from T001 (metadata reading and script discovery helpers)

**Notes**: T013 and T014 extend the shared utilities from T001 by adding pack execution and error formatting helpers.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wiring required to run pre-release checks

- [ ] T002 Update package scripts in package.json to add preflight, pack:check, smoke:import, and prerelease
- [ ] T012 [P] Add conditional runner helpers in scripts/prerelease/utils.mjs to execute optional scripts when present in package.json.
- [ ] T015 Implement preflight command runner in scripts/prerelease/preflight.mjs (validate that the mandatory base `lint` script exists, invoke optional scripts via T012 helpers, use utils helpers)

**Notes**: T012 only introduces conditional runner helpers for optional scripts such as `lint:shell`, `typecheck`, and `test` (skip if absent per FR-001d). T015 validates the mandatory base `lint` script (FR-001a) and uses T012 helpers to run optional scripts.

**Checkpoint**: Pre-release commands are wired and can be invoked locally

---

## Phase 3: User Story 1 - Run preflight before publish (Priority: P1) 🎯 MVP

**Goal**: Provide a single pre-release command that runs linting and packaging checks with clear failure messages.

**Independent Test**: Run `yarn prerelease` locally and confirm it runs linting, pack check, and import smoke tests, failing with actionable errors when a step breaks.

### Implementation for User Story 1
- [ ] T003 [US1] Implement pack validation in scripts/prerelease/pack-check.mjs.
- [ ] T004 [US1] Implement smoke import checks in scripts/prerelease/smoke-import.mjs.
- [ ] T005 [US1] Ensure new scripts emit actionable error messages and clean up temp artifacts.

**Notes**:
- T003: Use `npm pack --json` to list contents and fail on missing required files/entrypoints.
- T004: Perform both workspace import and packed tarball import; allow a local-only opt-out, but fail if skipped in CI.
- T005: Implement error messaging and temp artifact cleanup in `scripts/prerelease/*.mjs`.

**Checkpoint**: `yarn prerelease` completes all checks or fails with clear diagnostics

---

## Phase 4: User Story 2 - CI and release enforcement (Priority: P2)

**Goal**: CI and release workflows execute the same pre-release validation before publishing.

**Independent Test**: Trigger CI and Release workflows and confirm `yarn prerelease` runs and blocks publish on failure.

### Implementation for User Story 2
- [ ] T006 [US2] Update CI workflow to run yarn prerelease, replacing or consolidating any existing direct lint/smoke steps, in .github/workflows/ci.yml
- [ ] T007 [US2] Update Release workflow to run yarn prerelease before publish in .github/workflows/release.yml
- [ ] T010 [US2] Confirm CI matrix includes lts/* and node while Release remains lts/* only in .github/workflows/ci.yml and .github/workflows/release.yml

**Checkpoint**: CI and Release workflows enforce prerelease validation

---

## Phase 5: User Story 3 - Maintainership guidance (Priority: P3)

**Goal**: Document the pre-release flow for maintainers.

**Independent Test**: Read the release section and find the prerelease command and its purpose.

### Implementation for User Story 3

- [ ] T008 [US3] Add a maintainer note for prerelease validation in README.md (Releasing or equivalent section)

**Checkpoint**: Maintainers can follow the documented prerelease flow

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks and documentation alignment

- [ ] T009 [P] Verify quickstart commands align with updated scripts in specs/001-pre-release-preflight/quickstart.md (maps to FR-005)
- [ ] T011 [P] Verify release workflow still publishes via npm publish in .github/workflows/release.yml

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational and User Story 1 (pre-release scripts must be fully implemented and functional)
- **User Story 3 (Phase 5)**: Depends on Foundational (scripts must be documented)
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational
- **US2 (P2)**: Depends on US1 (pre-release scripts fully implemented and functional)
- **US3 (P3)**: Can start after Foundational

### Parallel Opportunities

- T003 and T004 can be implemented in parallel after T001/T002
- T006 and T007 can be implemented in parallel after US1
- T008 can be done in parallel with US2 after Phase 2

---

## Parallel Example: User Story 1

- Task: "Implement pack validation in scripts/prerelease/pack-check.mjs"
- Task: "Implement smoke import checks in scripts/prerelease/smoke-import.mjs"

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate `yarn prerelease` locally

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 (pre-release scripts)
3. User Story 2 (CI/Release enforcement)
4. User Story 3 (Docs)
5. Polish phase
