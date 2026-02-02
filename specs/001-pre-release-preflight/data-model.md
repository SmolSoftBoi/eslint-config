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

- **Pack file list authority & error handling**
  - The file list from `npm pack --json` is considered the authoritative packaged set **only if all of the following are true**:
    - the command completes successfully (zero exit code)
    - the command produces non-empty JSON output
    - the JSON output can be parsed into the expected file list structure
  - When **any** of these conditions is not met:
    - the pack check **MUST treat this as an error condition**
    - it MUST surface a clear failure explaining the cause (exit status, missing output, or parse error)
    - it MUST skip or abort validations that depend on the authoritative file list, rather than defaulting to an empty or partial list
  - When an authoritative file list is available:
    - `missingRequiredFiles` MUST be empty for a successful pack check. This enforces the RequiredFiles list. Entrypoint enforcement is handled by the entrypoint validation rule below.
- Declared entrypoints are mandatory: when `exports` or `main` fields are defined in `package.json`, all resulting `entrypoints` MUST resolve to paths present in the package file list, and for each declared entrypoint the corresponding file **MUST** be present in the package file list.
- A missing entrypoint file is always a validation failure.
- `importCheckPassed` must be true for successful smoke import.
