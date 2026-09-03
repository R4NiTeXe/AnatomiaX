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
};
