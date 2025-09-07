// API 測試專用 setup - 不包含 DOM 相關設定

// Mock 環境變數
process.env.NODE_ENV = 'test'
process.env.BETTER_AUTH_URL = 'http://localhost:3000/api/auth'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

// Mock Better Auth for API tests
jest.mock('@/server/auth', () => ({
    auth: {
        api: {
            getSession: jest.fn()
        }
    }
}))

// Mock database for API tests
jest.mock('@/server/db', () => ({
    db: {
        select: jest.fn(),
        from: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        offset: jest.fn(),
        leftJoin: jest.fn()
    }
}))

// Mock services for API tests
jest.mock('@/server/services/auth-service')
jest.mock('@/server/services/credit-service')
jest.mock('@/server/services/invite-code-service')
jest.mock('@/server/services/admin-service')
