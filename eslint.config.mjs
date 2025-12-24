// @ts-check

import config from "./index.mjs";
import typescriptEslint from 'typescript-eslint';
import eslintConfigPrettier from "eslint-config-prettier";

export default typescriptEslint.config(
  config,
  eslintConfigPrettier,
  {
    ignores: ['.pnp.cjs', '.pnp.loader.mjs']
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module'
    }
  },
  {
    // Ensure eslint-plugin-import can resolve ESM + TS ecosystem deps in this repo.
    settings: {
      'import/resolver': {
        node: true,
        typescript: true
      }
    }
  }
);
