const path = require('path');
const tsJestPath = path.join(__dirname, '..', '..', 'node_modules', 'ts-jest');
module.exports = {
  preset: tsJestPath,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': [tsJestPath, { diagnostics: false }],
  },
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.e2e.spec.ts',
    // Bootstrap entry: untestable by design (starts server/DB); covered by boot smoke, not unit tests.
    '!src/main.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  // tdd-workflow gate: CI runs with --coverage; main.ts (bootstrap entry)
  // is excluded from collection above.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
