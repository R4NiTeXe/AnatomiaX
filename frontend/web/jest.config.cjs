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
    '^@/lib/env$': '<rootDir>/src/lib/env.jest.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lottiefiles/dotlottie-react$':
      '<rootDir>/src/components/animation/__mocks__/dotlottie-react.tsx',
    '^@lottiefiles/dotlottie-web$': '<rootDir>/src/components/animation/__mocks__/dotlottie-web.ts',
    '^@rive-app/react-canvas$':
      '<rootDir>/src/components/animation/__mocks__/rive-react-canvas.tsx',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 10000,
  maxWorkers: '50%',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-setup.ts',
    '!src/vite-env.d.ts',
    '!src/lib/env.ts',
    '!src/lib/env.jest.ts',
    '!src/features/anatomy/components/AnatomySystem.tsx',
    '!src/features/anatomy/components/AnatomyViewer.tsx',
    '!src/features/anatomy/components/OptimizedModelStage.tsx',
    '!src/features/anatomy/components/AnatomyFocusController.tsx',
    '!src/features/anatomy/components/VerticalCameraHandler.tsx',
    '!src/features/anatomy/pages/HumanTestPage.tsx',
    '!src/main.tsx',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
