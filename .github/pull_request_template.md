## PR Checklist

- [ ] No lockfile drift (no new lockfiles introduced; package manager remains consistent)
- [ ] If this PR adds a dependency/tool, the PR description includes a short justification
- [ ] Docs updated if behavior/tooling changes (README / quickstart / spec)

## Notes

- If ShellCheck reports a finding that cannot be fixed, prefer a narrow inline suppression with a justification comment rather than disabling rules globally.
