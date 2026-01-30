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

- `missingRequiredFiles` must be empty for a successful pack check; this enforces the RequiredFiles list. Entrypoint enforcement is handled by the "Declared entrypoints are mandatory" and "`entrypoints` must resolve to paths present in the package file list when applicable" rules below.
- The file list from `npm pack --json` is the authoritative packaged set; RequiredFiles and declared entrypoints are validated against this list.
- Declared entrypoints are mandatory: for each declared entrypoint, the corresponding file **must** be present in the package file list; a missing entrypoint file is always a validation failure.
- `entrypoints` must resolve to paths present in the package file list when applicable.
- `importCheckPassed` must be true for successful smoke import.
