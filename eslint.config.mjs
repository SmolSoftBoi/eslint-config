// @ts-check

import config from "./index.mjs";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import typescriptEslint from 'typescript-eslint';
import { createNodeResolver } from "eslint-plugin-import-x";
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
    // Ensure eslint-plugin-import-x can resolve ESM + TS ecosystem deps in this repo.
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true
        }),
        createNodeResolver({
          extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx']
        })
      ]
    }
  }
);
