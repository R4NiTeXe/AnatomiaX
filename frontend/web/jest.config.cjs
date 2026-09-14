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
    '^@/(.*)$': '<rootDir>/src/$1',
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
};
