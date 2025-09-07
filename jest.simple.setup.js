// Simple jest setup for TDD testing
global.console = {
    ...console,
    // Comment out to see logs in tests if needed
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}

// Mock database for testing
global.mockDatabase = {
    insert: jest.fn().mockResolvedValue([]),
    select: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue([]),
}
