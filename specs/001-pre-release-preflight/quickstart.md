# Quickstart: Pre-release Preflight

## Local usage

- Run full pre-release validation:
  - `yarn prerelease`

- Run only repository checks:
  - `yarn preflight`

- Run packaging validation only:
  - `yarn pack:check`
  - `yarn smoke:import`

## Notes

- The pre-release flow uses `npm pack --json` to validate packaged contents.
- Smoke import tests should be run from a clean working tree.
- CI runs `yarn prerelease` on both current Node LTS and current Node.
