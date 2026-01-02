# Research: ShellCheck Linting

**Feature**: `002-shellcheck-ci`  
**Date**: 2026-01-02

## Decision 1: How to lint GitHub Actions `run:` blocks

**Decision**: Use `actionlint` to lint GitHub Actions workflow files and to run ShellCheck against inline `run:` scripts (best-effort extraction).

**Rationale**:

- ShellCheck itself does not parse workflow YAML; `actionlint` is purpose-built to analyze workflows and (when ShellCheck is available) apply ShellCheck to `run:` blocks.
- Matches the requirement that `run:` block linting is best-effort for detection/extraction, but blocking when a `run:` block can be linted and has warnings/errors.
- Keeps the CI implementation simple and uses an established tool rather than writing a custom YAML parser.

**Alternatives considered**:

- Parse workflow YAML ourselves and extract `run:` blocks: higher maintenance and easy to get wrong.
- Lint only `*.sh` files: does not satisfy the “workflows don’t introduce obvious shell bugs” requirement.

## Decision 2: How to install ShellCheck in CI

**Decision**: Install ShellCheck on `ubuntu-latest` via `apt-get`.

**Rationale**:

- Simple and transparent; no caching required.
- Avoids adding npm dependencies.
- Compatible with both direct ShellCheck invocation (for `*.sh` files) and `actionlint` integration (for workflow `run:` blocks).

**Alternatives considered**:

- Pinned container/action providing ShellCheck: workable, but increases moving parts and can complicate reuse of the repo’s existing CI patterns.

## Decision 3: Which files to lint

**Decision**:

- Lint all repository-tracked `*.sh` files.
- Additionally ensure `scripts/**/*.sh` is always included (even if scripts are added later).
- Lint GitHub Actions workflow `run:` blocks (best-effort via `actionlint`).

**Rationale**:

- Using `git ls-files '*.sh'` ensures we lint only repo-owned scripts and avoid scanning generated content.
- Explicitly including `scripts/**/*.sh` documents intent and keeps the workflow aligned with repository conventions.

**Alternatives considered**:

- `find . -name '*.sh'`: risks scanning vendored/generated content.

## Decision 4: Severity threshold

**Decision**: Fail CI on ShellCheck warnings + errors; do not fail on info/style.

**Rationale**:

- Balances correctness with low-noise CI.
- Aligns with the clarified requirement.

**Alternatives considered**:

- Fail on all findings: tends to be noisy.
- Fail only on errors: misses meaningful bug signals.

## Decision 5: Configuration defaults (.shellcheckrc)

**Decision**: Add a minimal `.shellcheckrc` in repo root with:

- Minimum severity enforced in CI/local runs via `-S warning`
- `shell=bash` since all current scripts are bash
- No global excludes; allow per-line/per-file disables only with an explanatory comment

**Rationale**:

- Keeps config predictable and easy to review.
- Encourages fixing issues rather than blanket suppression.

**Alternatives considered**:

- Disabling noisy rules globally (e.g. SC2086/SC2155): conflicts with the goal of catching obvious bugs.

## Decision 6: Pin an actionlint version

**Decision**: Pin `actionlint` to **v1.7.7** in CI.

**Rationale**:

- Keeps workflow linting behavior stable and reviewable (avoid supply-chain drift).
- `actionlint` is only used in CI, so pinning avoids accidental changes in diagnostics.

**How it’s installed in CI**:

- Download the release artifact from GitHub Releases for the pinned version and install the binary on the runner.
- Example (Linux x86_64):
	- `https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz`

**Alternatives considered**:

- Use `rhysd/actionlint@v1` without pinning: simpler, but introduces drift.
