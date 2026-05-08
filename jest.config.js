/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/extension/agents/**/*.ts',
    'src/extension/orchestrator/**/*.ts',
    '!src/extension/**/__tests__/**',
    '!src/extension/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/extension/__mocks__/vscode.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  testTimeout: 10000,
  verbose: true,
};
