const nextJest = require('next/jest')

const createJestConfig = nextJest({
    dir: './',
})

const config = {
    coverageProvider: 'v8',
    testEnvironment: 'node', // API 測試需要 node 環境
    setupFilesAfterEnv: ['<rootDir>/jest.setup.api.js'], // 使用 API 專用 setup
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
    testMatch: ['**/__tests__/api/**/*.test.{js,jsx,ts,tsx}'], // 只針對 API 測試
    collectCoverageFrom: [
        'app/api/**/*.{js,jsx,ts,tsx}',
        '!app/api/**/*.d.ts',
    ],
    verbose: true,
    bail: false,
    testTimeout: 15000,
    // ES 模組相容性
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(nanoid)/)',
    ]
}

module.exports = createJestConfig(config)
