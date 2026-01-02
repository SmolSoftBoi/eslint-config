# Contract: GitHub Actions (ShellCheck)

## CI workflow change

Add a `shellcheck` job to the existing CI workflow that:

- Runs on `pull_request` and `push` (including `main`).
- Uses minimal permissions (at least `contents: read`).
- Runs on `ubuntu-latest`.

## Behavior

### Shell scripts (`*.sh`)

- Lints all repository-tracked `*.sh` files.
- Ensures `scripts/**/*.sh` is included.
- Fails the job when ShellCheck reports **warnings or errors**.
- Does not fail solely on info/style findings.

### Workflow `run:` blocks

- Lints GitHub Actions workflow files.
- Attempts to apply ShellCheck to inline `run:` scripts (best-effort extraction).
- If a `run:` block is linted and produces warnings/errors, the job fails.
- If a `run:` block cannot be confidently linted (non-shell/ambiguous), the job does not fail just for that reason.

## Tooling

- ShellCheck is installed via `apt-get`.
- Use `actionlint` (pinned) to analyze workflow YAML and integrate ShellCheck for `run:` scripts.
