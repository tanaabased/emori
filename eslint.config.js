import { builtinModules } from 'node:module';

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

const restrictedBuiltinImports = builtinModules
  .filter((name) => !name.startsWith('_') && !name.startsWith('node:'))
  .map((name) => ({
    name,
    message: `Use node:${name} instead of bare builtin imports.`,
  }));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/temp/**',
    '**/cache/**',
    '**/dist/**',
    '**/_site/**',
    '**/coverage/**',
    '**/.vitepress/cache/**',
    '**/.vitepress/dist/**',
  ]),
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedBuiltinImports,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='require']",
          message: 'Use ESM imports instead of require() in module files.',
        },
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.type='Identifier'][left.object.name='module'][left.property.type='Identifier'][left.property.name='exports']",
          message: 'Use ESM exports instead of module.exports in module files.',
        },
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.object.type='Identifier'][left.object.name='exports']",
          message: 'Use ESM named exports instead of exports.* assignments in module files.',
        },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
  {
    files: ['test/**/*.{js,mjs,cjs}', '**/*.{spec,test}.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.mocha,
    },
  },
]);
