---

description: "Task list for feature implementation"

---

# Tasks: ShellCheck Linting

**Input**: Design documents from `/specs/002-shellcheck-ci/`

**Available docs**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/github-actions.md`

**Tests**: No separate test framework is required for this feature. Validation is done via workflow runs plus local commands (`yarn lint:shell`) and ensuring existing scripts still work.

**MVP scope suggestion**: **User Story 1 (CI)** only.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm scope and establish shared configuration used by CI and local runs.

- [ ] T001 Verify current shell script inventory and intended lint scope (tracked `*.sh`, `scripts/**/*.sh`, workflow `run:` blocks) and update `specs/002-shellcheck-ci/spec.md` if discrepancies are found
- [ ] T002 Confirm the pinned `actionlint` version and document it in `specs/002-shellcheck-ci/research.md` (include rationale for the chosen pin)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared configuration that MUST exist before CI/local linting is wired.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Create minimal ShellCheck config in `.shellcheckrc` (set `severity=warning`, set `shell=bash`, and avoid global `disable=`; require inline suppressions with justification)

**Checkpoint**: `.shellcheckrc` exists and defines the project’s default lint baseline.

---

## Phase 3: User Story 1 - Prevent shell bugs in CI (Priority: P1) 🎯 MVP

**Goal**: CI fails when ShellCheck finds warnings/errors in tracked scripts or lintable workflow `run:` blocks.

**Independent Test**: Open a PR that introduces a known ShellCheck warning (e.g., unquoted variable expansion) in a tracked script or in a workflow `run:` block and confirm the new `shellcheck` job fails.

### Implementation for User Story 1

- [ ] T004 [US1] Add a new `shellcheck` job skeleton to `.github/workflows/ci.yml` (ubuntu-latest, minimal permissions, consistent conventions)
- [ ] T005 [US1] Ensure the `shellcheck` job runs only on `pull_request` and `push` to `main` (use job-level `if:` guard if keeping broader workflow triggers) in `.github/workflows/ci.yml`
- [ ] T006 [US1] Install ShellCheck in CI via apt-get (no caching) in `.github/workflows/ci.yml`
- [ ] T007 [US1] Lint repository-tracked `*.sh` files (including `scripts/**/*.sh`) with ShellCheck, failing on warnings/errors (ignore info/style) in `.github/workflows/ci.yml` (use `git ls-files '*.sh'` so we only lint tracked scripts and avoid irrelevant paths like `node_modules/` or generated output)
- [ ] T008 [US1] Add pinned `actionlint` execution to lint workflow files and apply ShellCheck to `run:` blocks (best-effort extraction, blocking on warnings/errors when lintable) in `.github/workflows/ci.yml`

### Remediation for existing scripts (only as needed to make the new gate pass)

- [ ] T009 [P] [US1] Fix ShellCheck findings (or add narrow, justified suppressions) in `scripts/yarn-install-immutable.sh`
- [ ] T010 [P] [US1] Fix ShellCheck findings (or add narrow, justified suppressions) in `scripts/smoke-import-packed.sh`

**Checkpoint**: CI shows a distinct `shellcheck` job that passes on clean PRs and fails on introduced warnings/errors.

---

## Phase 4: User Story 2 - Run the same lint locally (Priority: P2)

**Goal**: Contributors can run the same shell lint locally with one command.

**Independent Test**: Run `yarn lint:shell` locally and confirm it returns exit code 0 when clean, and non-zero when a warning/error is introduced.

### Implementation for User Story 2

- [ ] T016 [US2] Add `lint:shell` script to `package.json` to run ShellCheck against repository-tracked `*.sh` files with the same severity threshold as CI
- [ ] T017 [US2] (Optional) Add a `lint` script aggregator to `package.json` to include `lint:shell` alongside existing lint behavior (if any)
- [ ] T018 [US2] Document local usage in `README.md` (prerequisite install note + command: `yarn lint:shell`)
- [ ] T021 [US2] Expand `README.md` with “What to do when ShellCheck fails” guidance (fixing findings, when/how to use inline `# shellcheck disable=SC####` with a justification comment, and reference `.shellcheckrc`)

**Checkpoint**: A contributor can follow README and run the lint check locally.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure docs and workflows are consistent and the feature is easy to maintain.

- [ ] T022 [P] Update `specs/002-shellcheck-ci/quickstart.md` to include the exact local validation commands and expected exit behavior
- [ ] T023 Ensure the CI `shellcheck` job output is actionable (clear file list, clear command output) by refining messages in `.github/workflows/ci.yml`

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** → blocks Phase 2+
- **Phase 2 (Foundational)** → blocks all user story phases
- **US1 (CI)** depends on Phase 2
- **US2 (Local)** depends on Phase 2 (should mirror the same rules)
- **Polish** after the desired user stories

### User story dependency graph

```text
Phase 1 (Setup)
  ↓
Phase 2 (Foundational)
  ↓
  ├─ US1 (CI)
  └─ US2 (Local)
        ↓
    Polish
```

## Parallel execution opportunities

- **[P] tasks** in Phase 2 can run in parallel (currently: `T003`)
- **[P] remediation tasks** in US1 can be split across different files (`T009`–`T010`)
- After Phase 2, US1 and US2 can be worked in parallel by different contributors, but US1 should land first to ensure the CI gate is correct

### Parallel example: US1 remediation

- `T009` Fix ShellCheck findings in `scripts/yarn-install-immutable.sh`
- `T010` Fix ShellCheck findings in `scripts/smoke-import-packed.sh`

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2
2. Implement US1 (T004–T010)
3. **STOP and VALIDATE**: Ensure CI fails on introduced warnings/errors and passes when clean

### Incremental Delivery

1. US1 (CI) → validate
2. US2 (Local command + docs) → validate
3. Polish (quickstart + output clarity)

## Format validation

All tasks in this document follow the required checklist format:

- `- [ ]` checkbox
- `T###` sequential IDs
- `[P]` only when parallelizable
- `[US#]` on user story tasks
- File paths included in every task description
