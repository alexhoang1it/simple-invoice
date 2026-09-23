import type { Config } from 'jest';

const config: Config = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  setupFiles: ['<rootDir>/../jest.setup.ts'],
  restoreMocks: true,
  clearMocks: true,

  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '**/*.ts',
    // Nest wiring and the bootstrapper have nothing to assert that the e2e run
    // does not already prove.
    '!**/*.module.ts',
    '!main.ts',
    '!database/seed/**',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { statements: 60, branches: 60, functions: 60, lines: 60 },
  },
};

export default config;
