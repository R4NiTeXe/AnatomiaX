/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  moduleNameMapper: {
    // The real env module reads static `import.meta.env` (Vite replaces it at
    // bundle time); ts-jest CJS cannot parse `import.meta`, so Jest maps the
    // module to a process.env shim. Must come before the generic @/ alias.
    '^@/lib/env$': '<rootDir>/src/lib/env.jest.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock animation player packages — jsdom lacks the canvas/WASM runtime
    // they need, so every test that touches a component importing these
    // packages fails without a mock.
    '^@lottiefiles/dotlottie-react$':
      '<rootDir>/src/components/animation/__mocks__/dotlottie-react.tsx',
    '^@lottiefiles/dotlottie-web$': '<rootDir>/src/components/animation/__mocks__/dotlottie-web.ts',
    '^@rive-app/react-canvas$':
      '<rootDir>/src/components/animation/__mocks__/rive-react-canvas.tsx',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  // STEP 8.20.9.1: deterministic parallel execution.
  // - setupFiles polyfills ResizeObserver/canvas/matchMedia before any
  //   three/R3F import so dynamicHuman import does not race the per-test timeout.
  // - testTimeout 10000 replaces the 5000 default: measured parallel run
  //   is ~76s total and the heavy /human import alone is >5s under worker
  //   contention (passes isolated/runInBand at ~0.5s). 10s is not arbitrary —
  //   it is the minimum that survives full parallel contention without hiding
  //   real hangs (still fails fast). Global, not per-test, so all suites share.
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 10000,
  // Limit parallel workers to half the CPUs — still parallel but reduces
  // ts-jest + three parse contention that pushed the /human import over 5s.
  maxWorkers: '50%',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-setup.ts',
    '!src/vite-env.d.ts',
    // Never loadable under Jest: env.ts is always moduleNameMapper-mapped to
    // env.jest.ts (static `import.meta` cannot parse in ts-jest CJS output).
    '!src/lib/env.ts',
    '!src/lib/env.jest.ts',
    // Three.js Canvas-bound modules: unrenderable in jsdom (no WebGL). Their
    // paths are covered by Playwright in a real browser (human-model-switch,
    // web deep-link specs) instead of unit coverage.
    '!src/components/anatomy/AnatomySystem.tsx',
    '!src/components/anatomy/AnatomyViewer.tsx',
    '!src/components/anatomy/OptimizedModelStage.tsx',
    '!src/components/anatomy/AnatomyFocusController.tsx',
    '!src/components/anatomy/VerticalCameraHandler.tsx',
    // Dev-only asset browser (dev-gated out of production bundles).
    '!src/pages/HumanTestPage.tsx',
    // Application entry bootstrap (imports + render call only).
    '!src/main.tsx',
  ],
  coverageReporters: ['text', 'lcov'],
  // tdd-workflow gate: unit + integration + E2E (Playwright covers the
  // Canvas-bound paths excluded above). CI runs with --coverage.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
