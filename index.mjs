// @ts-check

import eslint from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default typescriptEslint.config(
  eslint.configs.recommended,
  typescriptEslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
);
