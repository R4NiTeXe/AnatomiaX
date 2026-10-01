/**
 * ESLint flat config — verification-loop Phase 3 gate (`npm run lint`,
 * zero warnings via --max-warnings 0).
 *
 * Layers: core recommended + typescript recommended (non-type-checked, fast)
 * everywhere; react-hooks recommended for the React apps; Node script
 * parsing for CommonJS tooling; jest globals for test files.
 */
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
    // recommended-latest is the flat-config shape (recommended is legacy).
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
    // CommonJS tooling: explicit script source (default would parse as ESM).
    // `require()` is the correct module system here, not a smell.
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
    // Eleventy data files run in Node at build time (process/module available).
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
    // Browser-only marketing animation source (no build step, runs in page).
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
      // Tests use `any` for fakes/mocks/fixtures (FakeDb, supertest bodies).
      // tsc strict still type-checks everything else in these files.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
