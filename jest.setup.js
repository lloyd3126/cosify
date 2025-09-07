// Import testing-library jest-dom custom matchers
import '@testing-library/jest-dom'

// Mock global Response for API tests
global.Response = global.Response || class MockResponse {
    constructor(body, init = {}) {
        this.body = body
        this.status = init.status || 200
        this.statusText = init.statusText || 'OK'
        this.headers = new Map(Object.entries(init.headers || {}))
        this.ok = this.status >= 200 && this.status < 300
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
