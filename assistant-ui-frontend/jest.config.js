// Determine if running unit tests only (no Appwrite setup needed)
const isUnitTestOnly = process.argv.some(
  (arg) =>
    arg.includes("__tests__/unit") ||
    arg.includes("unit/") ||
    arg.includes("--testPathPattern=.*unit")
);

module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // Only require Appwrite setup for integration tests
  setupFilesAfterEnv: isUnitTestOnly ? [] : ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@assistant-ui|@langchain|nanoid|node-fetch-native-with-agent|node-fetch-native|node-appwrite)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }],
    '^.+\\.(js|jsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      },
      useESM: true
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Allow running unit tests without environment setup
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/__tests__/unit/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
      },
      preset: 'ts-jest',
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      }
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
      },
      preset: 'ts-jest',
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: {
            jsx: 'react-jsx'
          }
        }]
      }
    }
  ]
};