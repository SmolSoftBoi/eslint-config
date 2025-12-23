<!--
Sync Impact Report

- Version change: 1.0.1 → 1.0.2
- Modified principles: none (metadata/report correction)
- Added sections: none
- Removed sections: none
- Templates requiring updates: ✅ none (already aligned)
- Follow-up TODOs: none
-->

# SmolSoftBoi/eslint-config Constitution

This constitution governs **@smolpack/eslint-config**: a shareable ESLint **flat-config** package
(ESM) for JS/TS projects.

## Core Principles

### I. Compatibility-first (Flat Config + TS + Imports)
The package MUST remain compatible with ESLint **flat config** and the supported ecosystem around it
(TypeScript + import tooling).

- The exported config MUST work with ESLint flat config (no legacy `extends`-only design).
- Changes MUST consider TypeScript parsing/type-checking implications and import resolution.
- Peer dependency ranges MUST reflect what is actually supported (not aspirational).
- When upstream tools introduce breaking changes, this repo SHOULD provide clear upgrade guidance or
	compatibility shims where reasonable.

### II. Predictable + Minimal Rules (No Surprises)
This config MUST be boring in the best way.

- Rules MUST be minimal and justified: prefer fewer, clearer rules over large opinionated bundles.
- Breaking changes MUST be avoided unless truly necessary and MUST follow strict SemVer.
- The default export(s) MUST remain stable; if API surface changes, provide migration notes.
- If a rule is contentious, default to OFF unless there is strong, documented rationale.

### III. Strong DX (Examples + Upgrade Notes)
Developers must be able to adopt and upgrade this package quickly and confidently.

- The README MUST include copy/pasteable examples for common JS/TS setups using flat config.
- Any behavior-changing release MUST include upgrade notes (README, changelog, or release notes).
- Error messages and docs SHOULD prefer concrete steps over vague advice.

### IV. Quality Gates (Lint Must Pass; Tests for Rule Changes)
Quality gates are non-negotiable.

- CI (or local equivalent) linting MUST pass before merge.
- Any change that adds/changes a rule, parser option, or config behavior MUST include tests and/or
	fixtures that demonstrate the intended behavior.
- Tests SHOULD exercise real-world usage (fixtures that simulate consumer projects) rather than only
	unit-testing internal helpers.

### V. Lean Dependencies (Justified + Prefer Peer Deps)
Dependencies MUST stay lean and justified.

- Add a dependency only when it materially improves correctness or maintainability.
- Prefer `peerDependencies` for ecosystem tools (ESLint, TypeScript, plugins) when consumers already
	have them.
- Every added dependency MUST include a short justification in the PR description.

### VI. Publishing Discipline (Changelog/Release Notes Required)
Releases are part of the product.

- Every release MUST have human-readable release notes (GitHub release notes and/or changelog).
- Version bumps MUST match the change scope (patch/minor/major) and reference the rationale.
- Deprecations MUST be announced before removal when possible.

### VII. Modern ESM + Node Tooling Consistency (No Lockfile Drift)
This repo MUST embrace modern ESM and stay consistent in tooling.

- The package MUST remain ESM-first (`"type": "module"`) with consistent import/export style.
- The repo MUST use a single package manager and avoid lockfile drift.
	- PRs MUST NOT introduce additional lockfiles.
	- If a lockfile mismatch is discovered, it MUST be resolved as part of the change or as a
		dedicated follow-up.

## Scope & Compatibility

**Supported ecosystem policy**:

- Support is defined by `peerDependencies` ranges and documented notes; anything else is
	best-effort.
- When bumping peer dependency minimums, treat it as a behavior/compatibility change and document
	it prominently.

**Public API surface**:

- The entrypoint(s) (e.g., `index.mjs`) and exported config shape constitute the public API.
- Renaming exports, changing default exports, or reorganizing exposed presets counts as a breaking
	change unless a compatibility layer is provided.

**Non-goals** (unless explicitly adopted later):

- Being an all-in-one style guide for every team.
- Shipping duplicate wrappers around popular plugins without clear benefit.

## Workflow & Quality Gates

**Before merging** (PR checklist expectations):

- Compatibility check: ESLint flat config usage remains valid; TS/import tooling impact assessed.
- Predictability check: change is SemVer-appropriate; no hidden rule behavior changes.
- DX check: README examples and upgrade notes updated if behavior changes.
- Quality check: lint passes; rule/config behavior changes include fixtures/tests.
- Dependencies check: any new dependency is justified and reviewed.
- Tooling check: no new lockfiles; package manager usage remains consistent.

**Review discipline**:

- At least one maintainer approval is required for releases and behavior changes.
- Prefer small PRs with a single intent.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

This constitution supersedes local conventions and ad-hoc practices.

**Amendments**:

- Amendments MUST be proposed via PR.
- The PR MUST include:
	- What changed and why
	- The intended effect on development and releases
	- Any migration guidance (if applicable)

**Versioning policy for this constitution**:

- **MAJOR**: Removing/redefining principles or governance rules in a backwards-incompatible way.
- **MINOR**: Adding a principle or materially expanding expectations.
- **PATCH**: Clarifications, wording improvements, and non-semantic refinements.

**Compliance review expectation**:

- PR reviewers MUST explicitly consider the Core Principles.
- If a PR violates a principle, it MUST include a written justification and a mitigation plan.

**Version**: 1.0.2 | **Ratified**: 2025-12-23 | **Last Amended**: 2025-12-23
