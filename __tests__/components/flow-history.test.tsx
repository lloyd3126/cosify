import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import FlowHistory from '@/components/flow-history'
import * as imageUtils from '@/lib/image-utils'

// Mock router
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
}))

// Mock 外部依賴
jest.mock('@/lib/image-utils', () => ({
    getOptimizedImageUrl: jest.fn(),
    preloadOptimizedImages: jest.fn(),
}))

jest.mock('@/components/flow-history-list', () => ({
    FlowHistoryList: ({ runs, onToggleExpand, currentExpanded, onImageClick }: any) => (
        <div data-testid="flow-history-list">
            {runs.map((run: any) => (
                <div key={run.runId} data-testid={`run-${run.runId}`}>
                    <div>{run.runId}</div>
                    <button
                        onClick={() => onToggleExpand?.(run.runId)}
                        data-testid={`expand-${run.runId}`}
                    >
                        {currentExpanded?.[run.runId] ? 'Collapse' : 'Expand'}
                    </button>
                    {run.itemsPreview?.map((item: any) => (
                        <button
                            key={item.r2Key}
                            onClick={() => onImageClick?.(run.runId, item.r2Key)}
                            data-testid={`image-${item.r2Key}`}
                        >
                            {item.r2Key}
                        </button>
                    ))}
                </div>
            ))}
            {runs.length === 0 && <div data-testid="no-runs">No runs loaded</div>}
        </div>
    )
}))

jest.mock('@/components/ui/lightbox', () => ({
    __esModule: true,
    default: ({ open, onClose }: any) =>
        open ? <div data-testid="lightbox" onClick={onClose}>Lightbox</div> : null
}))

jest.mock('@/components/ui/confirm-dialog', () => ({
    __esModule: true,
    default: ({ open, onConfirm, onCancel }: any) =>
        open ? (
            <div data-testid="confirm-dialog">
                <button onClick={onConfirm}>Confirm</button>
                <button onClick={onCancel}>Cancel</button>
            </div>
        ) : null
}))

jest.mock('sonner', () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
    Toaster: () => <div data-testid="toaster" />
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('FlowHistory - 圖片載入優化測試', () => {
    const mockRuns = [
        {
            runId: 'run-1',
            createdAt: '2024-01-01T12:00:00Z',
            itemsTotal: 3,
            itemsPreview: [
                { r2Key: 'run-1-preview-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                { r2Key: 'run-1-preview-2.jpg', createdAt: '2024-01-01T12:01:00Z' },
            ]
        },
        {
            runId: 'run-2',
            createdAt: '2024-01-01T13:00:00Z',
            itemsTotal: 2,
            itemsPreview: [
                { r2Key: 'run-2-preview-1.jpg', createdAt: '2024-01-01T13:00:00Z' },
            ]
        }
    ]

    // 追蹤所有透過 Image 或 document.createElement 建立的圖片載入
    let createdImages: HTMLImageElement[] = []
    const originalImage = global.Image
    let originalCreateElement: typeof document.createElement

    beforeEach(() => {
        jest.clearAllMocks()
        createdImages = []

        // Mock Image constructor 來追蹤圖片載入
        global.Image = jest.fn().mockImplementation(() => {
            const img = new originalImage()
            createdImages.push(img)

            // 監聽 src 設定，記錄載入的 URL
            Object.defineProperty(img, 'src', {
                set: function (value) {
                    img.setAttribute('data-test-src', value)
                    Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')?.set?.call(this, value)
                },
                get: function () {
                    return Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')?.get?.call(this) || ''
                }
            })

            return img
        }) as any

        // Mock document.createElement 來追蹤透過 createElement 建立的圖片
        originalCreateElement = document.createElement
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'img') {
                const img = originalCreateElement.call(document, tagName) as HTMLImageElement
                createdImages.push(img)

                const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
                Object.defineProperty(img, 'src', {
                    set: function (value) {
                        img.setAttribute('data-test-src', value)
                        originalSrcDescriptor?.set?.call(this, value)
                    },
                    get: function () {
                        return originalSrcDescriptor?.get?.call(this) || ''
                    }
                })

                return img
            }
            return originalCreateElement.call(document, tagName)
        })

            // Mock fetch responses
            ; (global.fetch as jest.Mock).mockImplementation((url: string) => {
                if (url.includes('/history?')) {
                    // Mock history API response
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            runs: mockRuns,
                            nextCursor: null
                        })
                    })
                }
                if (url.includes('/history/') && url.includes('/items')) {
                    // Mock items API response
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            items: [
                                { r2Key: 'run-1-item-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                                { r2Key: 'run-1-item-2.jpg', createdAt: '2024-01-01T12:01:00Z' },
                                { r2Key: 'run-1-item-3.jpg', createdAt: '2024-01-01T12:02:00Z' },
                            ]
                        })
                    })
                }
                if (url.includes('/api/r2/')) {
                    // Mock blob download
                    return Promise.resolve({
                        ok: true,
                        blob: () => Promise.resolve(new Blob(['mock image data'], { type: 'image/jpeg' }))
                    })
                }
                return Promise.reject(new Error('Unknown URL'))
            })

            // Mock getOptimizedImageUrl
            ; (imageUtils.getOptimizedImageUrl as jest.Mock).mockImplementation(
                (r2Key: string, options: any) => {
                    const width = options?.width || 200
                    return `https://optimized.example.com/${r2Key}?w=${width}&q=80`
                }
            )

            // Mock preloadOptimizedImages 
            ; (imageUtils.preloadOptimizedImages as jest.Mock).mockResolvedValue(undefined)
    })

    afterEach(() => {
        global.Image = originalImage
        jest.restoreAllMocks()
    })

    describe('測試1: 初始載入不應該預載 blob 圖片', () => {
        test('組件初始化時不應該下載原始圖片 blob', async () => {
            render(<FlowHistory slug="test-slug" flowName="Test Flow" />)

            // 等待初始載入完成
            await waitFor(() => {
                expect(screen.getByTestId('flow-history-list')).toBeInTheDocument()
            })

            // 等待一點時間讓任何非同步操作完成
            await new Promise(resolve => setTimeout(resolve, 100))

            // 檢查是否有 /api/r2/ 的請求（這些應該只在點擊燈箱時發生）
            const fetchCalls = (global.fetch as jest.Mock).mock.calls
            const r2Calls = fetchCalls.filter(call =>
                typeof call[0] === 'string' && call[0].includes('/api/r2/')
            )

            expect(r2Calls).toHaveLength(0) // 初始載入時不應該有 blob 下載
        })

        test('組件初始化時不應該建立額外的 Image 物件', async () => {
            render(<FlowHistory slug="test-slug" flowName="Test Flow" />)

            await waitFor(() => {
                expect(screen.getByTestId('flow-history-list')).toBeInTheDocument()
            })

            // 等待一點時間
            await new Promise(resolve => setTimeout(resolve, 100))

            // FlowHistory 本身不應該建立額外的 Image 物件
            // （FlowHistoryList 中的 Image 組件是正常的）
            const loadedImageUrls = createdImages
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            console.log('FlowHistory 偵測到的圖片載入:', loadedImageUrls)

            // 應該沒有額外的圖片載入（FlowHistoryList 的載入已在其他測試中檢查）
            expect(loadedImageUrls.length).toBeLessThanOrEqual(2) // 僅有 preview 圖片
        })
    })

    describe('測試2: 展開時的載入行為', () => {
        test('展開時不應該立即下載所有 blob 圖片', async () => {
            render(<FlowHistory slug="test-slug" flowName="Test Flow" />)

            // 等待數據載入完成
            await waitFor(() => {
                expect(screen.getByTestId('run-run-1')).toBeInTheDocument()
            }, { timeout: 3000 })

            // 點擊展開按鈕
            const expandButton = screen.getByTestId('expand-run-1')
            fireEvent.click(expandButton)

            // 等待展開 API 完成
            await waitFor(() => {
                const fetchCalls = (global.fetch as jest.Mock).mock.calls
                const itemsCalls = fetchCalls.filter(call =>
                    typeof call[0] === 'string' && call[0].includes('/items')
                )
                expect(itemsCalls.length).toBeGreaterThan(0)
            })

            // 檢查是否有 blob 下載請求
            const fetchCalls = (global.fetch as jest.Mock).mock.calls
            const r2Calls = fetchCalls.filter(call =>
                typeof call[0] === 'string' && call[0].includes('/api/r2/')
            )

            expect(r2Calls).toHaveLength(0) // 展開時還不應該下載 blob
        })
    })

    describe('測試3: 燈箱點擊時的載入行為', () => {
        test('只有點擊圖片開啟燈箱時才應該下載 blob', async () => {
            render(<FlowHistory slug="test-slug" flowName="Test Flow" />)

            // 等待數據載入完成
            await waitFor(() => {
                expect(screen.getByTestId('run-run-1')).toBeInTheDocument()
            }, { timeout: 3000 })

            // 點擊圖片開啟燈箱
            const imageButton = screen.getByTestId('image-run-1-preview-1.jpg')
            fireEvent.click(imageButton)

            // 等待 blob 下載
            await waitFor(() => {
                const fetchCalls = (global.fetch as jest.Mock).mock.calls
                const r2Calls = fetchCalls.filter(call =>
                    typeof call[0] === 'string' && call[0].includes('/api/r2/')
                )
                expect(r2Calls.length).toBeGreaterThan(0) // 現在應該有 blob 下載
            })

            // 檢查燈箱是否開啟
            await waitFor(() => {
                expect(screen.getByTestId('lightbox')).toBeInTheDocument()
            })
        })
    })

    describe('測試4: blob URL 管理', () => {
        test('應該正確管理 blob URL 的生命週期', async () => {
            const { unmount } = render(<FlowHistory slug="test-slug" flowName="Test Flow" />)

            // 等待數據載入完成
            await waitFor(() => {
                expect(screen.getByTestId('run-run-1')).toBeInTheDocument()
            }, { timeout: 3000 })

            // 點擊圖片觸發 blob 下載
            const imageButton = screen.getByTestId('image-run-1-preview-1.jpg')
            fireEvent.click(imageButton)

            await waitFor(() => {
                expect(global.URL.createObjectURL).toHaveBeenCalled()
            })

            // 卸載組件
            unmount()

            // 應該清理 blob URLs
            expect(global.URL.revokeObjectURL).toHaveBeenCalled()
        })
    })
})
