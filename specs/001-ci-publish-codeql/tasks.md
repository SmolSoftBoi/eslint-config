---

description: "Task list for feature implementation"

---

# Tasks: Automated CI, Release & Security Checks

**Input**: Design documents from `/specs/001-ci-publish-codeql/`

**Available docs**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/github-actions.md`

**Tests**: No separate test framework is required for this feature. Validation is done via workflow runs plus local commands (`yarn eslint .`) and an import smoke-test.

**MVP scope suggestion**: **User Story 1 (CI)** only.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the design docs and repo scaffolding are aligned and ready for implementation.

- [ ] T001 Reconcile spec/plan/contracts to match desired triggers and matrices in `specs/001-ci-publish-codeql/spec.md`, `specs/001-ci-publish-codeql/plan.md`, `specs/001-ci-publish-codeql/contracts/github-actions.md`
- [ ] T002 Update maintainer instructions to match final workflow behavior in `specs/001-ci-publish-codeql/quickstart.md` and `README.md`
- [ ] T003 Ensure reusable workflow helper scripts directory exists and is documented in `scripts/` and `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared implementation pieces used by CI and release workflows.

**⚠️ CRITICAL**: No user story workflow work should begin until this phase is complete.

- [ ] T004 [P] Implement deterministic Yarn install helper with immutable+fallback+lockfile guard in `scripts/yarn-install-immutable.sh`
- [ ] T005 [P] Implement consumer-style packed import smoke-test helper in `scripts/smoke-import-packed.sh`
- [ ] T006 Standardize workflow conventions (permissions, concurrency, caching, Corepack) in `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/workflows/codeql.yml`

**Checkpoint**: Shared scripts and conventions exist; story work can proceed.

---

## Phase 3: User Story 1 - Validate changes with fast CI (Priority: P1) 🎯 MVP

**Goal**: CI runs on PRs/pushes, installs deterministically with Yarn, runs `yarn eslint .`, and performs a consumer-style import smoke-test.

**Independent Test**: Open a PR and ensure the CI workflow passes: immutable install (or guarded fallback), lint, and packed import smoke-test.

### Implementation for User Story 1

- [ ] T007 [US1] Update workflow triggers and concurrency in `.github/workflows/ci.yml` (run on `pull_request` and `push` to any branch, ignore version tags, cancel in-progress)
- [ ] T008 [US1] Add Node version matrix (LTS + current) and Yarn caching in `.github/workflows/ci.yml`
- [ ] T009 [US1] Use Corepack and deterministic install helper in `.github/workflows/ci.yml` (call `scripts/yarn-install-immutable.sh`)
- [ ] T010 [US1] Run lint step `yarn eslint .` in `.github/workflows/ci.yml`
- [ ] T011 [US1] Add packed import smoke-test step in `.github/workflows/ci.yml` (call `scripts/smoke-import-packed.sh`)
- [ ] T012 [US1] Verify least-privilege permissions in `.github/workflows/ci.yml` (default `contents: read` only)

**Checkpoint**: CI provides a clear pass/fail signal on PRs and branch pushes (excluding version tags).

---

## Phase 4: User Story 2 - Ongoing security scanning for the codebase (Priority: P2)

**Goal**: Add CodeQL scanning for JavaScript + TypeScript.

**Independent Test**: Create a PR and confirm CodeQL analysis runs and publishes results.

### Implementation for User Story 2

- [ ] T013 [US2] Update triggers and concurrency for CodeQL in `.github/workflows/codeql.yml` (PR + push main + scheduled)
- [ ] T014 [US2] Configure CodeQL init/analyze for JavaScript/TypeScript in `.github/workflows/codeql.yml`
- [ ] T015 [US2] Verify least-privilege permissions for CodeQL in `.github/workflows/codeql.yml` (`contents: read`, `security-events: write`)

**Checkpoint**: CodeQL runs on PRs and on schedule and reports findings.

---

## Phase 5: User Story 3 - Publish via GitHub Releases (semver tags) (Priority: P3)

**Goal**: Publish to npm via GitHub Releases for semver tags (per release tag policy) and via a gated manual workflow dispatch.

**Independent Test**: Publish a GitHub Release for a tag like `v1.2.3-rc.1` and confirm the release workflow runs checks and attempts publish; manually run workflow_dispatch with confirmation disabled and confirm publish is refused.

### Implementation for User Story 3

- [ ] T016 [US3] Create/update release workflow triggers and concurrency in `.github/workflows/release.yml` (on GitHub `release.published` for semver tags + `workflow_dispatch` with confirmation input)
- [ ] T017 [US3] Reuse CI checks in `.github/workflows/release.yml` (Corepack, deterministic install, `yarn eslint .`, packed import smoke-test)
- [ ] T018 [US3] Implement npm publish step using `NPM_TOKEN` secret in `.github/workflows/release.yml`
- [ ] T019 [US3] Implement scoped-package access logic (`--access public` only if `package.json#name` is scoped) in `.github/workflows/release.yml`
- [ ] T020 [US3] Enable npm provenance publishing in `.github/workflows/release.yml` (use `--provenance` and required permissions such as `id-token: write`)
- [ ] T021 [US3] Ensure publish never runs on PR events, manual publish is gated, and release notes are validated (non-empty GitHub Release body) before publishing in `.github/workflows/release.yml`

**Checkpoint**: Release workflow safely publishes when configured and refuses to publish without confirmation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Remove duplication, document the behavior, and validate end-to-end.

- [ ] T022 [P] Remove or disable any legacy/duplicate publishing workflows in `.github/workflows/` (e.g., deprecate or delete `.github/workflows/npm-publish.yml`)
- [ ] T023 Update documentation for CI and release process in `README.md` and `specs/001-ci-publish-codeql/quickstart.md`
- [ ] T024 Run local validation steps and ensure they match workflows: `corepack enable`, `yarn install --immutable`, `yarn eslint .`, and packed import smoke-test (document exact commands in `specs/001-ci-publish-codeql/quickstart.md`)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** → blocks Phase 2+
- **Phase 2 (Foundational)** → blocks all user story phases
- **US1 (CI)** can proceed after Phase 2
- **US2 (CodeQL)** can proceed after Phase 2
- **US3 (Release)** can proceed after Phase 2
- **Polish** after any desired user stories

### User story dependency graph

```text
Phase 1 (Setup)
  ↓
Phase 2 (Foundational)
  ↓
  ├─ US1 (CI)
  ├─ US2 (CodeQL)
  └─ US3 (Release)
        ↓
    Polish
```

## Parallel execution opportunities

- **[P] tasks** in Phase 2 can run in parallel:
  - `T004` and `T005`
- After Phase 2, US phases can be worked in parallel by different contributors:
  - US1 (`T007`–`T012`), US2 (`T013`–`T015`), US3 (`T016`–`T021`)

### Parallel example: US1

- Update matrix and caching in `.github/workflows/ci.yml` (T008)
- Implement smoke-test helper in `scripts/smoke-import-packed.sh` (T005)

(Once both are done, wire the smoke-test into the workflow in T011.)

## Format validation

All tasks in this document follow the required checklist format:

- `- [ ]` checkbox
- `T###` sequential IDs
- `[P]` only when parallelizable
- `[US#]` on user story tasks
- File paths included in every task description
