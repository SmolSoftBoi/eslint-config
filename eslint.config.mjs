// @ts-check

import config from "./index.mjs";
import typescriptEslint from 'typescript-eslint';
import eslintConfigPrettier from "eslint-config-prettier";

export default typescriptEslint.config(
  config,
  eslintConfigPrettier,
  {
    ignores: ['.pnp.cjs', '.pnp.loader.mjs']
  }
);
