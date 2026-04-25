// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'legacy/**',
      'node_modules/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'postcss.config.cjs',
            'tests/setup/*.ts',
            'scripts/*.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // No raw-HTML injection anywhere, per specs/security.md §3.
      'react/no-danger': 'error',
      // Unused imports should be removed, not silenced.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Forbid direct stdio-transport import; tree-shake protection.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@modelcontextprotocol/sdk/client/stdio.js',
              message:
                'The stdio transport pulls Node-only deps. Browser builds must not import it.',
            },
            {
              name: '@modelcontextprotocol/sdk',
              message:
                'Use deep imports (e.g. @modelcontextprotocol/sdk/client/index.js) — see src/README.md.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Mock implementations need async to match the interface they mimic,
      // even if the body doesn't actually await anything.
      '@typescript-eslint/require-await': 'off',
      // Tests often carry deliberate casts to keep fixtures readable.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },

  {
    files: [
      '*.config.{ts,mjs,js,cjs}',
      '*.config.*.{ts,mjs,js,cjs}',
      'eslint.config.mjs',
      'postcss.config.cjs',
      'scripts/*.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
