// @ts-check

import config from "./index.mjs";
import typescriptEslint from 'typescript-eslint';
import eslintConfigPrettier from "eslint-config-prettier";

export default typescriptEslint.config(
  config,
  eslintConfigPrettier,
  {
    ignores: ['.pnp.cjs', '.pnp.loader.mjs', 'node_modules/', 'dist/', 'build/', 'coverage/', '.yarn/']
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  },
  {
    // Ensure eslint-plugin-import can resolve ESM + TS ecosystem deps in this repo.
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx']
        },
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  }
);
