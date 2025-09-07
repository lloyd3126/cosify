/**
 * Test Wrapper for Admin Components
 * Provides necessary context and providers for testing
 */

import React from 'react'
import { SWRConfig } from 'swr'

// Mock SWR configuration for testing
const swrConfig = {
    dedupingInterval: 0,
    provider: () => new Map(),
    // Disable all network requests during testing
    fetcher: () => {
        throw new Error('SWR fetcher should be mocked in tests')
    }
}

interface TestWrapperProps {
    children: React.ReactNode
}

export const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => {
    return (
        <SWRConfig value={swrConfig}>
            {children}
        </SWRConfig>
    )
}
