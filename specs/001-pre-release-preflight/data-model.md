# Data Model: Pre-release Preflight

## Entities

### ScriptConfig

Represents the structured inputs used by pre-release scripts.

- **name**: string (script name)
- **command**: string (yarn/npm script command)
- **required**: boolean (whether the script is mandatory)
- **description**: string (human-readable purpose)

### PackCheckResult

Represents the results from the packaging validation step.

- **tarballName**: string
- **files**: array of string (files listed in `npm pack --json`)
- **missingRequiredFiles**: array of string
- **entrypoints**: array of string (from `package.json` exports/main)
- **importCheckPassed**: boolean

### RequiredFiles

Minimum set of files that must exist in the release archive.

- **files**: array of string
  - `eslint.config.mjs`
  - `index.mjs`
  - `README.md`
  - `LICENSE`

## Validation Rules

- `missingRequiredFiles` must be empty for a successful pack check (only the RequiredFiles list is enforced).
- Files listed by `npm pack --json` are treated as informational; absence of any non-required file does not fail the check unless it is a declared entrypoint.
- `entrypoints` must resolve to paths present in the package file list when applicable.
- `importCheckPassed` must be true for successful smoke import.
