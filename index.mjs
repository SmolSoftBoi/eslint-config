// @ts-check

import eslint from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import { importX } from 'eslint-plugin-import-x';

export default typescriptEslint.config(
  eslint.configs.recommended,
  typescriptEslint.configs.recommended,
  importX.flatConfigs.recommended,
);
