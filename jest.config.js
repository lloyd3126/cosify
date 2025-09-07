const nextJest = require('next/jest')

const createJestConfig = nextJest({
    dir: './',
})

const config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
    testMatch: ['**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        'app/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!app/**/*.d.ts',
    ],
    // TDD 專用設定
    verbose: true,
    bail: false,
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        }
    },
    maxWorkers: '50%',
    cache: true,
    testTimeout: 10000,
}

module.exports = createJestConfig(config)
