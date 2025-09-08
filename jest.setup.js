// 🛡️ 測試安全檢查 - 確保不會意外使用正式資料庫
process.env.NODE_ENV = 'test'

// 🚨 重要：禁止在測試中使用正式資料庫
if (process.env.DATABASE_URL?.includes('app.sqlite')) {
    throw new Error('🚨 SECURITY: 禁止在測試中使用正式資料庫！')
}

// 設定測試專用的資料庫路徑
process.env.DATABASE_URL = 'file:./.data/test.sqlite'

// Import testing-library jest-dom custom matchers
import '@testing-library/jest-dom'

// Polyfills for MSW and Node.js environment
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock BroadcastChannel for MSW WebSocket support
global.BroadcastChannel = class MockBroadcastChannel {
    constructor(name) {
        this.name = name
    }
    postMessage() { }
    close() { }
}

// Mock TransformStream for MSW compatibility
global.TransformStream = class MockTransformStream {
    constructor() {
        this.readable = new ReadableStream()
        this.writable = new WritableStream()
    }
}

// Mock Request for MSW
global.Request = class MockRequest {
    constructor(url, init = {}) {
        this.url = url
        this.method = init.method || 'GET'
        this.headers = new Map(Object.entries(init.headers || {}))
        this.body = init.body || null
        this.cache = init.cache || 'default'
        this.credentials = init.credentials || 'same-origin'
        this.destination = init.destination || ''
        this.integrity = init.integrity || ''
        this.keepalive = init.keepalive || false
        this.mode = init.mode || 'cors'
        this.redirect = init.redirect || 'follow'
        this.referrer = init.referrer || 'about:client'
        this.referrerPolicy = init.referrerPolicy || ''
        this.signal = init.signal || null
    }

    clone() {
        return new MockRequest(this.url, this)
    }

    async json() {
        return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }

    async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }
}

// Mock ReadableStream and WritableStream if they don't exist
if (!global.ReadableStream) {
    global.ReadableStream = class MockReadableStream {
        constructor() { }
        getReader() {
            return {
                read: () => Promise.resolve({ done: true, value: undefined }),
                releaseLock: () => { },
                cancel: () => Promise.resolve()
            }
        }
    }
}

if (!global.WritableStream) {
    global.WritableStream = class MockWritableStream {
        constructor() { }
        getWriter() {
            return {
                write: () => Promise.resolve(),
                close: () => Promise.resolve(),
                abort: () => Promise.resolve(),
                releaseLock: () => { }
            }
        }
    }
}

// Mock global Response for API tests
global.Response = global.Response || class MockResponse {
    constructor(body, init = {}) {
        this.body = body
        this.status = init.status || 200
        this.statusText = init.statusText || 'OK'
        this.headers = new Map(Object.entries(init.headers || {}))
        this.ok = this.status >= 200 && this.status < 300
    }

    clone() {
        return new MockResponse(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: Object.fromEntries(this.headers)
        })
    }

    async json() {
        return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }

    async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }

    static json(data, init = {}) {
        return new MockResponse(JSON.stringify(data), {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...init.headers
            }
        })
    }
}

// Mock Next.js Image component
jest.mock('next/image', () => {
    // eslint-disable-next-line react/display-name
    return (props) => {
        // Remove Next.js specific props
        const { priority, loading, ...rest } = props
        return <img {...rest} />
    }
})

// Mock Next.js router
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        refresh: jest.fn(),
        prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/test-path',
}))

// Mock fetch globally
global.fetch = jest.fn()

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-blob-url')
global.URL.revokeObjectURL = jest.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
})

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}

// 設定全域測試超時
jest.setTimeout(30000)

// 全域測試清理
beforeEach(() => {
    // 清理控制台警告（除非是測試本身的輸出）
    if (!process.env.VERBOSE_TESTS) {
        jest.spyOn(console, 'warn').mockImplementation(() => { })
    }
})

afterEach(() => {
    // 恢復 mock
    jest.restoreAllMocks()
})

// 測試結束後清理
afterAll(async () => {
    // 清理過期的測試資料庫
    try {
        const { cleanupOldTestDatabases } = require('./__tests__/helpers/test-database')
        cleanupOldTestDatabases()
    } catch (error) {
        // 忽略清理錯誤
    }
})
