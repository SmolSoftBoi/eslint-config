# Feature Specification: Automated CI, Release & Security Checks

**Feature Branch**: `001-ci-publish-codeql`  
**Created**: 2025-12-23  
**Status**: Draft  
**Input**: User description: "Add GitHub Actions workflows to this repo to: (1) run CI on PRs/pushes that installs with Yarn and runs `yarn eslint .` plus an import smoke-test of the published config entry, (2) optionally publish to npm on version tags (v*), and (3) add CodeQL scanning for JavaScript. Keep workflows fast, deterministic, and least-privilege."

## Clarifications

### Session 2025-12-23

- Q: What should the import smoke-test actually import? → A: Import the package as consumers do (pack + install from tarball, then import by package name).
- Q: What tag format is allowed for releases? → A: vMAJOR.MINOR.PATCH plus prereleases (e.g., v1.2.3-rc.1).
- Q: Which pushes should run CI? → A: Run CI on pushes to any branch (excluding version tags), plus PRs.
- Q: What credential method should publishing use? → A: Publish uses `NPM_TOKEN`. OIDC is a nice-to-have used only to support provenance when available.
- Q: CodeQL should analyze which language set? → A: JavaScript + TypeScript.
- Q: Supported Node versions for CI? → A: LTS + current.
- Q: Release trigger model (tag-driven vs GitHub Release-driven)? → A: GitHub Release-driven.
- Q: Should publishing use npm provenance? → A: Yes.
- Q: Should there be a manual publish path? → A: Yes, via workflow_dispatch in the same workflow.

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

### User Story 1 - Validate changes with fast CI (Priority: P1)

As a maintainer or contributor, I want automated checks to run on pull requests and relevant pushes so that changes to the ESLint config are validated consistently before merge.

**Why this priority**: Prevents broken configs and regressions from being released; provides quick feedback for contributors.

**Independent Test**: Open a PR that changes the config. The automated check run should report success only if the repository installs successfully, linting passes, and the config entry can be imported.

**Acceptance Scenarios**:

1. **Given** a pull request is opened or updated, **When** the CI pipeline runs, **Then** it installs dependencies using the repository’s lockfile and fails if dependency resolution is not reproducible.
2. **Given** the CI pipeline has installed dependencies successfully, **When** it runs the lint step, **Then** it executes the repository’s linting command over the repo and reports pass/fail.
3. **Given** the lint step succeeds, **When** the pipeline runs a config import smoke-test, **Then** the package entry point can be imported without throwing errors.

  - Clarified: the smoke-test must validate the *packaged* artifact by packing the package and importing it by its package name (consumer-style import), not by importing repository files via relative paths.

---

### User Story 2 - Ongoing security scanning for the codebase (Priority: P2)

As a maintainer, I want automated security analysis on this repository’s code so that common vulnerability patterns are surfaced early.

**Why this priority**: Improves security posture with minimal ongoing effort and provides visibility into risky patterns.

**Independent Test**: Push a change to the default branch and confirm a security scan run is created and completes; confirm scans are also scheduled periodically.

**Acceptance Scenarios**:

1. **Given** changes are pushed to the default branch, **When** the security scan runs, **Then** it analyzes the repository’s JavaScript/TypeScript code and reports findings in the repository’s security reporting UI.
2. **Given** no code changes occur for a period of time, **When** the scheduled scan time occurs, **Then** a scan run still executes so results remain current.

---

### User Story 3 - Publish via GitHub Releases (semver tags) (Priority: P3)

As a maintainer, I want releases to be publishable via GitHub Releases (semver tags) so that releasing the ESLint config is repeatable and less error-prone.

**Why this priority**: Reduces manual release steps and ensures published artifacts align with tagged source.

**Independent Test**: Publish a GitHub Release for a tag matching the agreed semver tag format and confirm a publishing run starts and attempts to publish exactly once.

**Acceptance Scenarios**:

1. **Given** a GitHub Release is created for a semantic version tag (including prerelease variants) matching the release tag policy (e.g., `v1.2.3` or `v1.2.3-rc.1`), **When** the publish automation runs, **Then** it performs a clean install and publishes the package.
2. **Given** a GitHub Release is created, **When** it has no release notes (empty body), **Then** the workflow MUST fail before publishing with an actionable error.
3. **Given** a publish run is triggered, **When** publishing credentials are not configured, **Then** the run fails with a clear, actionable error message and does not publish.
4. **Given** a pull request is opened, **When** publish automation is evaluated, **Then** no publish step is executed for PR events.
5. **Given** a maintainer triggers a manual publish run, **When** the required confirmation input is not provided, **Then** the workflow must refuse to publish.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- The lockfile and/or package manager metadata is modified incorrectly; CI must fail deterministically with an actionable error.
- The config entry imports successfully but has side effects that crash ESLint at runtime; CI should catch import-time errors and lint failures.
- Publishing is triggered from an unexpected tag (e.g., non-semver); publish automation should avoid accidental publishes by requiring a clear tag pattern.
- Workflows should not require elevated permissions by default; accidental write permissions to repository contents should be avoided.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Automated checks MUST run for pull requests to the default branch.
- **FR-002**: Automated checks MUST run for pushes to any branch and MUST ignore pushes of version tags.
- **FR-003**: CI MUST perform a reproducible dependency install based on the repository’s committed lockfile and MUST fail if reproducibility cannot be guaranteed.
- **FR-004**: CI MUST run the repository’s linting command over the repository content and report pass/fail.
- **FR-005**: CI MUST run an import smoke-test that verifies the package’s primary config entry can be imported without errors, using a consumer-style import from the packed/publishable artifact (pack + install, then import by package name).
- **FR-006**: Security scanning MUST analyze the repository’s JavaScript/TypeScript code and publish results to the repository’s security reporting UI.
- **FR-007**: Security scanning MUST run on a regular schedule in addition to running on relevant code changes.
- **FR-008**: Publishing automation MUST trigger only from GitHub Release events associated with semantic version tags matching the release tag policy and MUST never publish on pull request events.
- **FR-008a**: Publishing automation MUST validate that the GitHub Release contains human-readable release notes (non-empty body) before attempting to publish.
- **FR-009**: Publishing automation MUST perform a clean, reproducible install before publishing.
- **FR-009a**: Publishing automation MUST publish using `NPM_TOKEN`. When provenance is enabled, workflows MUST request `id-token: write` and publish with `--provenance`.
- **FR-010**: Workflows MUST use the minimum permissions necessary for their purpose (least privilege), and write permissions MUST only be granted to jobs that require them.
- **FR-011**: Workflows MUST be deterministic (same inputs produce same results) and fast enough to provide timely feedback.
- **FR-012**: CI MUST run only on the supported Node.js versions defined in **CI Runtime Support Policy**, and the supported range MUST be explicitly documented in the workflow.
- **FR-013**: If a manual publish path exists, it MUST be gated to prevent accidental releases (e.g., explicit confirmation input and/or environment protections).

### CI Runtime Support Policy

- CI MUST run on Node **LTS** and Node **Current**.

### Release Tag Policy

- Publish triggers MUST match: `vMAJOR.MINOR.PATCH` and may include semver prerelease suffixes (e.g., `v1.2.3-rc.1`).
- Tags that do not follow semver (e.g., `vnext`, `v1`) MUST NOT trigger publishing.

Publishing MUST be GitHub Release-driven: the publish automation MUST only run when the GitHub Release `tag_name` matches the semver policy above.

### Assumptions

- The repository uses a package manager with a committed lockfile to keep dependency state pinned.
- The “published config entry” refers to the package’s primary entry point (the import target documented for consumers).
- Publishing requires credentials stored as repository secrets; without credentials publishing is expected to fail loudly rather than silently skipping.
- If publishing uses provenance, it is assumed the registry and repository settings support it; otherwise the workflow should fall back to token-based publish without provenance.

### Key Entities *(include if feature involves data)*

- **CI Run**: An automated validation run associated with a push or pull request, with pass/fail status and logs.
- **Release Tag**: A source control tag that signals a release candidate/versioned release.
- **Published Package**: The package artifact made available via the package registry.
- **Security Scan Result**: Findings produced by automated analysis and surfaced in the repository’s security reporting UI.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: For typical PRs, CI provides a clear pass/fail signal within 5 minutes.
- **SC-002**: CI results are reproducible: rerunning checks on the same commit yields the same outcome (pass/fail) absent external outages.
- **SC-003**: The import smoke-test catches import-time breakages before merge (0 releases with a broken import of the primary config entry).
- **SC-004**: Security scanning executes at least weekly and after default-branch changes, with results visible to maintainers.
- **SC-005**: Publishing from an eligible GitHub Release results in exactly one publish attempt per release and does not run for PRs.
