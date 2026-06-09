import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/server.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          types: ['jest', 'node'],
          esModuleInterop: true,
        },
      },
    ],
  },
};

export default config;
