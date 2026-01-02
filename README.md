# ESLint Config

![GitHub release (latest by date)](https://img.shields.io/github/v/release/SmolSoftBoi/eslint-config)

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Support](#support)
- [Contributing](#contributing)

## Installation

Follow these steps to get a copy of the config up and running.

### Prerequisites

```bash
yarn add --dev \
  @smolpack/eslint-config \
  eslint \
  @eslint/js \
  typescript \
  typescript-eslint \
  eslint-plugin-import \
  eslint-import-resolver-typescript \
  eslint-config-prettier
```

## Usage

This package is an **ESM** ESLint **flat config** preset.

1. Create (or update) your project’s `eslint.config.mjs`:

### Minimal

```js
// eslint.config.mjs
export { default } from '@smolpack/eslint-config';
```

### With local overrides

```js
// eslint.config.mjs
import smolpack from '@smolpack/eslint-config';

export default [
  ...smolpack,
  {
    ignores: ['dist/', 'coverage/', '.yarn/'],
  },
  {
    rules: {
      // Your local project overrides go here
    },
  },
];
```

2. Run ESLint:

```bash
yarn eslint .
```

## Support

If you have any questions or run into any trouble, here's a  way you can get help:

- **Issue Tracker**: Check out the [issue tracker](https://github.com/SmolSoftBoi/eslint-config/issues) for this project to see if anyone else has had the same problem or to open a new issue.

Remember, the best way to get help is to provide as much information as you can about what you're trying to do, what steps you've taken, and what problems you're running into.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### ShellCheck (shell script linting)

This repo uses **ShellCheck** to lint repository-tracked `*.sh` scripts.

#### Run locally

- This repo is pinned to Yarn via the `packageManager` field; if you see a Yarn version mismatch error, enable Corepack.
- Install ShellCheck (https://www.shellcheck.net/) via your OS package manager.
- Run:

  - `yarn lint:shell`

#### What to do when ShellCheck fails

- Prefer fixing the underlying issue.
- If you need to suppress a specific warning, use a **narrow** inline suppression with a justification comment, e.g.:

  - `# shellcheck disable=SC#### -- <why this is safe/intentional>`

- Avoid global disables in `.shellcheckrc`.

## Releasing

Publishing is **GitHub Release-driven**.

### Prerequisites

- Configure the repository secret `NPM_TOKEN` with an npm automation token that has publish rights for `@smolpack/eslint-config`.

### Release flow

1. Bump `package.json#version` and commit.
2. Create a semver tag like `vX.Y.Z` (or prerelease `vX.Y.Z-rc.1`) pointing at that commit.
3. Create a GitHub Release for that tag and include human-readable release notes.
4. GitHub Actions runs `.github/workflows/release.yml` to validate and publish.
