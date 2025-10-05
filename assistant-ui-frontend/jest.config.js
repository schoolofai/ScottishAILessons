module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(@assistant-ui|@langchain|nanoid|node-fetch-native-with-agent|node-appwrite)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  preset: 'ts-jest',
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': ['ts-jest', { useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json']
};