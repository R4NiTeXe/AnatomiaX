const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/_site/**',
      '**/next-env.d.ts',
      'frontend/web/public/**',
      '3d-assets/**',
      'package-lock.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['frontend/web/**/*.{ts,tsx}', 'frontend/admin/**/*.{ts,tsx}'],
    ...reactHooks.configs['recommended-latest'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['backend/**/*.ts', 'frontend/packages/*/src/**/*.ts', 'backend/packages/*/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: [
      'scripts/**/*.js',
      'frontend/marketing/*.js',
      '*.config.js',
      'frontend/*/postcss.config.js',
      'frontend/*/tailwind.config.js',
      '**/jest.config.cjs',
      'frontend/admin/__mocks__/*.js',
      'eslint.config.js',
    ],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['frontend/marketing/src/_data/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['frontend/marketing/src/scripts/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/test-setup.ts',
      'e2e/**/*.ts',
      'playwright.config.ts',
    ],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
