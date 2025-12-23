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
