import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { IntroductionDemoList } from '@/components/introduction-demo-list'
import * as imageUtils from '@/lib/image-utils'

// Mock 外部依賴
jest.mock('@/lib/image-utils', () => ({
    getOptimizedImageUrl: jest.fn(),
    preloadOptimizedImages: jest.fn(),
}))

jest.mock('@/components/toggle-run-public-button', () => ({
    ToggleRunPublicButton: () => <div data-testid="toggle-public-button">Toggle Public</div>
}))

jest.mock('@/components/share-runid-button', () => ({
    ShareRunIdButton: () => <div data-testid="share-runid-button">Share</div>
}))

jest.mock('@/components/demo-run-preview', () => ({
    DemoRunPreview: () => <div data-testid="demo-run-preview">Demo Preview</div>
}))

// Mock fetch for API calls
global.fetch = jest.fn()

describe('IntroductionDemoList - 圖片載入優化測試', () => {
    const mockDemoRunIds = ['demo-run-1', 'demo-run-2']
    const mockItemsByRun = {
        'demo-run-1': [
            { r2Key: 'demo-1-image-1.jpg', createdAt: '2024-01-01T12:00:00Z', stepId: 'step-1' },
            { r2Key: 'demo-1-image-2.jpg', createdAt: '2024-01-01T12:01:00Z', stepId: 'step-2' },
            { r2Key: 'demo-1-image-3.jpg', createdAt: '2024-01-01T12:02:00Z', stepId: 'step-3' },
        ],
        'demo-run-2': [
            { r2Key: 'demo-2-image-1.jpg', createdAt: '2024-01-01T13:00:00Z', stepId: 'step-1' },
            { r2Key: 'demo-2-image-2.jpg', createdAt: '2024-01-01T13:01:00Z', stepId: 'step-2' },
        ]
    }

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

            // Mock fetch API response
            ; (global.fetch as jest.Mock).mockResolvedValue({
                json: () => Promise.resolve({
                    itemsByRun: mockItemsByRun
                })
            })

            // Mock getOptimizedImageUrl 返回縮圖 URL
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

    describe('測試1: 應該使用優化的縮圖而非原始 API 路徑', () => {
        test('不應該直接載入 /api/r2/ 路徑的完整圖片', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            // 等待 API 載入完成
            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            // 檢查所有 img 元素的 src
            const images = screen.getAllByRole('img')
            images.forEach((img) => {
                const imageElement = img as HTMLImageElement
                // 不應該直接使用 /api/r2/ 路徑（這會載入完整大小圖片）
                expect(imageElement.src).not.toMatch(/\/api\/r2\//)
                // 應該使用優化的縮圖 URL
                expect(imageElement.src).toMatch(/w=\d+/)
                expect(imageElement.src).toMatch(/q=\d+/)
            })
        })

        test('應該為所有圖片使用適當的縮圖尺寸', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            const images = screen.getAllByRole('img')
            expect(images.length).toBeGreaterThan(0)

            images.forEach((img) => {
                const imageElement = img as HTMLImageElement
                // 應該使用適當的縮圖尺寸（比如 200px 寬度）
                expect(imageElement.src).toMatch(/w=(200|300|400)/)
            })
        })
    })

    describe('測試2: 不應該有背景預載行為', () => {
        test('組件初始化時不應該建立額外的 Image 物件來預載', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            // 等待一點時間讓任何 useEffect 執行
            await new Promise(resolve => setTimeout(resolve, 100))

            // 檢查建立的 Image 物件
            const loadedImageUrls = createdImages
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            console.log('IntroductionDemoList 偵測到的圖片載入:', loadedImageUrls)

            // 不應該有額外的背景預載（只應該有顯示在畫面上的圖片）
            const displayedImages = screen.getAllByRole('img')
            expect(loadedImageUrls.length).toBeLessThanOrEqual(displayedImages.length)
        })

        test('不應該調用 preloadOptimizedImages 進行背景預載', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            // 確認沒有調用預載函數
            expect(imageUtils.preloadOptimizedImages).not.toHaveBeenCalled()
        })
    })

    describe('測試3: 燈箱功能（如果實作的話）', () => {
        test('點擊圖片前不應該載入原始大小圖片', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            // 檢查沒有載入原始大小圖片的請求
            const loadedUrls = createdImages
                .map(img => img.getAttribute('data-test-src'))
                .filter((url): url is string => Boolean(url))

            // 所有載入的圖片都應該是優化過的縮圖
            loadedUrls.forEach(url => {
                expect(url).toMatch(/w=\d+/) // 有寬度參數
                expect(url).toMatch(/q=\d+/) // 有品質參數
            })
        })
    })

    describe('測試4: API 載入行為', () => {
        test('只應該調用一次 items-batch API', async () => {
            render(<IntroductionDemoList demoRunIds={mockDemoRunIds} />)

            await waitFor(() => {
                expect(screen.queryByText('載入中…')).not.toBeInTheDocument()
            })

            // 檢查 fetch 只被調用一次，且是正確的 API
            expect(global.fetch).toHaveBeenCalledTimes(1)
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/runs/public/items-batch',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ runIds: mockDemoRunIds })
                })
            )
        })
    })
})
