/**
 * Test utilities for Plan 8 TDD development
 * 
 * This file contains helper functions and utilities for testing
 * the credit system and admin backend functionality.
 */

// Simple ID generator to replace nanoid for testing
const generateTestId = () => Math.random().toString(36).substring(2, 15)

// Test data factories for creating consistent test data
export const TestDataFactory = {
  createUser: (overrides: Partial<any> = {}) => ({
    id: generateTestId(),
    email: `test-${generateTestId()}@example.com`,
    name: 'Test User',
    emailVerified: false,
    credits: 0,
    hasGoogleApiKey: false,
    dailyLimit: 100,
    signupBonusClaimed: false,
    role: 'free_user' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createCreditTransaction: (overrides: Partial<any> = {}) => ({
    id: generateTestId(),
    userId: 'test-user',
    amount: 100,
    type: 'purchase' as const,
    description: 'Test credit transaction',
    metadata: JSON.stringify({ test: true }),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  }),

  createDailyUsage: (overrides: Partial<any> = {}) => ({
    id: generateTestId(),
    userId: 'test-user',
    usageDate: new Date(),
    creditsConsumed: 0,
    createdAt: new Date(),
    ...overrides,
  }),

  createInviteCode: (overrides: Partial<any> = {}) => ({
    code: `TEST${generateTestId().slice(0, 6).toUpperCase()}`,
    createdByAdminId: 'admin-1',
    creditsValue: 100,
    creditsExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    usedByUserId: null,
    usedAt: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  }),
}

// Test utilities for database setup and cleanup
export const TestUtils = {
  createMockDatabase: () => {
    // Mock database implementation for testing
    // This will be a simplified mock that simulates database operations
    const mockData: {
      users: any[]
      creditTransactions: any[]
      dailyUsage: any[]
      inviteCodes: any[]
    } = {
      users: [],
      creditTransactions: [],
      dailyUsage: [],
      inviteCodes: [],
    }

    return {
      mockData,
      // Mock database operations
      insert: jest.fn().mockImplementation((table: string, data: any) => {
        (mockData as any)[table].push(data)
        return Promise.resolve([data])
      }),
      select: jest.fn().mockImplementation((table: string, conditions?: any) => {
        return Promise.resolve((mockData as any)[table])
      }),
      update: jest.fn().mockImplementation(() => Promise.resolve([])),
      delete: jest.fn().mockImplementation(() => Promise.resolve([])),
    }
  },

  createFailingDatabase: () => {
    // Mock database that simulates connection failures
    return {
      insert: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      select: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      update: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      delete: jest.fn().mockRejectedValue(new Error('Database connection failed')),
    }
  },

  cleanDatabase: async (mockDb: any) => {
    // Reset mock database state
    if (mockDb.mockData) {
      mockDb.mockData.users = []
      mockDb.mockData.creditTransactions = []
      mockDb.mockData.dailyUsage = []
      mockDb.mockData.inviteCodes = []
    }
    return Promise.resolve()
  },

  insertTestData: async (mockDb: any, dataArray: any[]) => {
    // Insert test data into mock database
    for (const item of dataArray) {
      // Determine table based on data structure
      if (item.email) {
        mockDb.mockData.users.push(item)
      } else if (item.amount && item.type) {
        mockDb.mockData.creditTransactions.push(item)
      } else if (item.usageDate) {
        mockDb.mockData.dailyUsage.push(item)
      } else if (item.code) {
        mockDb.mockData.inviteCodes.push(item)
      }
    }
    return Promise.resolve()
  },
}

// Mock helpers for authentication and API calls
export const MockHelpers = {
  mockAuthenticatedUser: (userId: string, role: string = 'free_user') => {
    // Mock authentication context
    return {
      user: { id: userId, role },
      session: { token: 'mock-token' }
    }
  },

  mockApiResponse: (data: any, status: number = 200) => {
    return {
      status,
      json: () => Promise.resolve(data),
      ok: status >= 200 && status < 300,
    }
  },
}
