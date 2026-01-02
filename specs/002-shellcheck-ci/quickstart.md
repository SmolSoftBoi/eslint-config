# Quickstart: ShellCheck Linting

## Prerequisites

- ShellCheck installed locally (e.g., via your OS package manager)

## Run locally

- `yarn lint:shell`

## Expected results

- Exit code 0 when no ShellCheck warnings/errors are found.
- Non-zero exit code when ShellCheck warnings/errors are found.

## Notes

- CI also lints GitHub Actions workflow `run:` blocks (best-effort) to catch obvious shell bugs introduced in workflows.

## If ShellCheck fails

- Prefer fixing the underlying issue.
- If a finding cannot be fixed (e.g., intentional behavior or a false positive), use a **narrow** inline suppression with a justification comment, for example:

	- `# shellcheck disable=SC#### -- <why this is safe/intentional>`

- Avoid globally disabling checks in `.shellcheckrc`.

See `README.md` for contributor-facing guidance.
