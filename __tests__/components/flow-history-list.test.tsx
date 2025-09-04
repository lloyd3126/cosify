import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FlowHistoryList, FlowHistoryListRun } from '@/components/flow-history-list'
import * as imageUtils from '@/lib/image-utils'

// Mock 工具函數
jest.mock('@/lib/image-utils', () => ({
    getOptimizedImageUrl: jest.fn(),
    preloadOptimizedImages: jest.fn(),
}))

// Mock toast 
jest.mock('sonner', () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
    Toaster: () => <div data-testid="toaster" />,
}))

// Mock UI components
jest.mock('@/components/ui/lightbox', () => {
    return function MockLightbox({ open, src, onClose }: any) {
        return open ? (
            <div data-testid="lightbox" data-src={src}>
                <button onClick={onClose}>Close Lightbox</button>
            </div>
        ) : null
    }
})

jest.mock('@/components/ui/skeleton', () => ({
    Skeleton: ({ className, ...props }: any) => (
        <div data-testid="skeleton" className={className} {...props} />
    ),
}))

describe('FlowHistoryList - 圖片載入優化測試', () => {
    const mockRuns: FlowHistoryListRun[] = [
        {
            runId: 'test-run-1',
            createdAt: '2024-01-01T12:00:00Z',
            itemsTotal: 10,
            itemsPreview: [
                { r2Key: 'preview-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                { r2Key: 'preview-2.jpg', createdAt: '2024-01-01T12:01:00Z' },
                { r2Key: 'preview-3.jpg', createdAt: '2024-01-01T12:02:00Z' },
            ],
            allItems: [
                { r2Key: 'preview-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                { r2Key: 'preview-2.jpg', createdAt: '2024-01-01T12:01:00Z' },
                { r2Key: 'preview-3.jpg', createdAt: '2024-01-01T12:02:00Z' },
                { r2Key: 'full-4.jpg', createdAt: '2024-01-01T12:03:00Z' },
                { r2Key: 'full-5.jpg', createdAt: '2024-01-01T12:04:00Z' },
                { r2Key: 'full-6.jpg', createdAt: '2024-01-01T12:05:00Z' },
            ],
        },
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
                    // 記錄這個 URL 被設定
                    img.setAttribute('data-test-src', value)
                    // 調用原始的 src setter
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

                // 同樣監聽 src 設定
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

            // Mock getOptimizedImageUrl 返回縮圖 URL
            ; (imageUtils.getOptimizedImageUrl as jest.Mock).mockImplementation(
                (r2Key: string, options: any) => {
                    const width = options?.width || 800
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

    describe('測試1: 展開時只會載入縮圖', () => {
        test('當點擊展開按鈕時，所有 Image 組件的 src 都應該是縮圖版本的 URL', async () => {
            const mockToggleExpand = jest.fn()
            const expandedState = { 'test-run-1': false }

            const { rerender } = render(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={expandedState}
                />
            )

            // 點擊展開按鈕
            const expandButton = screen.getByLabelText('展開')
            fireEvent.click(expandButton)

            expect(mockToggleExpand).toHaveBeenCalledWith('test-run-1')

            // 模擬展開後的狀態
            rerender(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': true }}
                />
            )

            // 等待渲染完成
            await waitFor(() => {
                const images = screen.getAllByRole('img')
                expect(images.length).toBeGreaterThan(0)
            })

            // 檢查所有圖片的 src 都是縮圖版本（寬度為 200px）
            const images = screen.getAllByRole('img')
            images.forEach((img) => {
                const imageElement = img as HTMLImageElement
                expect(imageElement.src).toMatch(/w=200/)
                expect(imageElement.src).toMatch(/q=80/)
                expect(imageElement.src).toContain('https://optimized.example.com/')
            })

            // 驗證 getOptimizedImageUrl 被調用時都使用了縮圖尺寸
            expect(imageUtils.getOptimizedImageUrl).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ width: 200, quality: 80 })
            )
        })

        test('展開前只顯示預覽圖片，展開後顯示所有圖片', async () => {
            const mockToggleExpand = jest.fn()

            const { rerender } = render(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': false }}
                />
            )

            // 展開前：只有預覽圖片 (3張)
            let images = screen.getAllByRole('img')
            expect(images).toHaveLength(3)

            // 點擊展開
            const expandButton = screen.getByLabelText('展開')
            fireEvent.click(expandButton)

            // 模擬展開後的狀態
            rerender(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': true }}
                />
            )

            // 展開後：顯示所有圖片 (6張)
            await waitFor(() => {
                images = screen.getAllByRole('img')
                expect(images).toHaveLength(6)
            })

            // 所有圖片都應該使用縮圖 URL
            images.forEach((img) => {
                const imageElement = img as HTMLImageElement
                expect(imageElement.src).toMatch(/w=200/)
            })
        })
    })

    describe('測試2: 不會再有背景的大量圖片預載請求', () => {
        test('組件初始化時不應該自動預載所有圖片', async () => {
            console.log('=== 測試開始：檢查圖片預載 ===')
            render(<FlowHistoryList runs={mockRuns} />)

            // 等待一個 tick 讓任何立即執行的 effect 完成
            await waitFor(() => {
                expect(screen.getByText(/2024\/01\/01.*10 張/)).toBeInTheDocument()
            })

            // 再等待一點時間讓所有 useEffect 執行完成
            await new Promise(resolve => setTimeout(resolve, 100))

            // 檢查是否有不當的圖片載入
            const loadedImageUrls = createdImages
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            console.log('偵測到的圖片載入:', loadedImageUrls)
            console.log('總共建立的 Image 元素數量:', createdImages.length)

            // 顯示每個 Image 元素的詳細資訊
            createdImages.forEach((img, index) => {
                console.log(`Image ${index}: src="${img.getAttribute('data-test-src')}", naturalSrc="${img.src}"`)
            })

            // 應該只載入展示的縮圖，不應該載入所有圖片或原始大小圖片
            expect(loadedImageUrls.length).toBeLessThanOrEqual(3) // 只有 preview 的 3 張縮圖

            // 所有載入的圖片都應該是優化過的縮圖（包含 width 參數）
            loadedImageUrls.forEach(url => {
                expect(url).toMatch(/w=\d+/)
                expect(url).toMatch(/q=\d+/)
            })
        })

        test('展開前不應該預載 allItems 中的圖片', async () => {
            render(<FlowHistoryList runs={mockRuns} />)

            await waitFor(() => {
                expect(screen.getByText(/2024\/01\/01.*10 張/)).toBeInTheDocument()
            })

            // 記錄展開前載入的圖片
            const imagesBeforeExpand = [...createdImages]

            // 檢查不應該載入 allItems 中額外的圖片
            const loadedUrls = imagesBeforeExpand
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            // 不應該載入 full-4.jpg, full-5.jpg, full-6.jpg
            expect(loadedUrls.every(url => !url.includes('full-4.jpg'))).toBe(true)
            expect(loadedUrls.every(url => !url.includes('full-5.jpg'))).toBe(true)
            expect(loadedUrls.every(url => !url.includes('full-6.jpg'))).toBe(true)
        })

        test('展開時不應該調用 preloadOptimizedImages 進行背景預載', async () => {
            const mockToggleExpand = jest.fn()

            const { rerender } = render(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': false }}
                />
            )

            // 點擊展開
            const expandButton = screen.getByLabelText('展開')
            fireEvent.click(expandButton)

            // 模擬展開後的狀態
            rerender(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': true }}
                />
            )

            // 等待一段時間確保沒有背景預載
            await waitFor(() => {
                expect(imageUtils.preloadOptimizedImages).not.toHaveBeenCalled()
            }, { timeout: 1000 })
        })

        test('【新增】點擊展開時不應該載入原始大小圖片', async () => {
            // 使用內建的 toggleExpand 來測試真實行為
            render(<FlowHistoryList runs={mockRuns} />)

            // 記錄展開前的圖片載入狀態
            const imagesBeforeExpand = [...createdImages]

            // 點擊展開（使用內建的 toggleExpand）
            const expandButton = screen.getByLabelText('展開')
            fireEvent.click(expandButton)

            // 等待一段時間讓展開邏輯執行
            await new Promise(resolve => setTimeout(resolve, 200))

            // 檢查是否調用了 preloadOptimizedImages
            expect(imageUtils.preloadOptimizedImages).not.toHaveBeenCalled()

            // 檢查展開後是否有新的圖片載入
            const imagesAfterExpand = createdImages.slice(imagesBeforeExpand.length)
            const newLoadedUrls = imagesAfterExpand
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            console.log('展開後新載入的圖片:', newLoadedUrls)

            // 展開時不應該載入原始 /api/r2/ 路徑圖片
            newLoadedUrls.forEach(url => {
                expect(url).not.toMatch(/\/api\/r2\//)
            })

            // 如果有載入圖片，都應該是優化過的縮圖
            newLoadedUrls.forEach(url => {
                expect(url).toMatch(/w=\d+/)
                expect(url).toMatch(/q=\d+/)
            })
        })

        test('展開多個 run 時，每個 run 都不應該觸發背景預載', async () => {
            const multipleRuns = [
                ...mockRuns,
                {
                    ...mockRuns[0],
                    runId: 'test-run-2',
                    itemsPreview: [
                        { r2Key: 'run2-preview-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                    ],
                    allItems: [
                        { r2Key: 'run2-preview-1.jpg', createdAt: '2024-01-01T12:00:00Z' },
                        { r2Key: 'run2-full-2.jpg', createdAt: '2024-01-01T12:01:00Z' },
                    ],
                },
            ]

            const mockToggleExpand = jest.fn()
            const { rerender } = render(
                <FlowHistoryList
                    runs={multipleRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': false, 'test-run-2': false }}
                />
            )

            // 展開第一個 run
            const expandButtons = screen.getAllByLabelText('展開')
            fireEvent.click(expandButtons[0])

            rerender(
                <FlowHistoryList
                    runs={multipleRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': true, 'test-run-2': false }}
                />
            )

            // 展開第二個 run  
            fireEvent.click(expandButtons[1])

            rerender(
                <FlowHistoryList
                    runs={multipleRuns}
                    onToggleExpand={mockToggleExpand}
                    currentExpanded={{ 'test-run-1': true, 'test-run-2': true }}
                />
            )

            // 確保沒有背景預載被觸發
            await waitFor(() => {
                expect(imageUtils.preloadOptimizedImages).not.toHaveBeenCalled()
            })
        })
    })

    describe('測試3: 只有點擊開啟燈箱時才會載入原始大小圖片', () => {
        test('點擊圖片開啟燈箱時，應該發送請求取得原始圖片', async () => {
            // Mock fetch 返回 blob 數據
            const mockBlob = new Blob(['fake image data'], { type: 'image/jpeg' })
                ; (global.fetch as jest.Mock).mockResolvedValue({
                    ok: true,
                    blob: () => Promise.resolve(mockBlob),
                })

            render(
                <FlowHistoryList
                    runs={mockRuns}
                    currentExpanded={{ 'test-run-1': true }}
                />
            )

            await waitFor(() => {
                const images = screen.getAllByRole('img')
                expect(images.length).toBeGreaterThan(0)
            })

            // 點擊第一張圖片
            const firstImage = screen.getAllByRole('button', { name: '預覽' })[0]
            fireEvent.click(firstImage)

            // 驗證 fetch 被調用以取得原始圖片
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/r2/preview-1.jpg',
                    { cache: 'no-store' }
                )
            })

            // 檢查燈箱被開啟 (檢查 lightbox 是否開啟，而不是檢查 DOM 元素)
            await waitFor(() => {
                expect(screen.getByTestId('lightbox')).toBeInTheDocument()
            })
        })

        test('在燈箱開啟前，不應該有任何原始圖片的請求', async () => {
            const { rerender } = render(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={jest.fn()}
                    currentExpanded={{ 'test-run-1': false }}
                />
            )

            // 點擊展開
            const expandButton = screen.getByLabelText('展開')
            fireEvent.click(expandButton)

            // 模擬展開後的狀態
            rerender(
                <FlowHistoryList
                    runs={mockRuns}
                    onToggleExpand={jest.fn()}
                    currentExpanded={{ 'test-run-1': true }}
                />
            )

            // 等待渲染完成
            await waitFor(() => {
                const images = screen.getAllByRole('img')
                expect(images.length).toBeGreaterThan(0)
            })

            // 在這個階段，應該沒有對 /api/r2/ 的請求（原始圖片）
            expect(global.fetch).not.toHaveBeenCalledWith(
                expect.stringMatching(/\/api\/r2\//),
                expect.any(Object)
            )
        })

        test('使用外部 onImageClick 時，應該調用外部處理函數而非內建燈箱', async () => {
            const mockOnImageClick = jest.fn()

            render(
                <FlowHistoryList
                    runs={mockRuns}
                    currentExpanded={{ 'test-run-1': true }}
                    onImageClick={mockOnImageClick}
                />
            )

            await waitFor(() => {
                const images = screen.getAllByRole('img')
                expect(images.length).toBeGreaterThan(0)
            })

            // 點擊第一張圖片
            const firstImage = screen.getAllByRole('button', { name: '預覽' })[0]
            fireEvent.click(firstImage)

            // 應該調用外部處理函數
            expect(mockOnImageClick).toHaveBeenCalledWith('test-run-1', 'preview-1.jpg')

            // 不應該有 fetch 請求（因為使用外部處理）
            expect(global.fetch).not.toHaveBeenCalled()

            // 不應該顯示內建燈箱
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
        })
    })
})
