import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RunImageGrid, type RunImageGridRun, type RunImageGridConfig } from '@/components/run-image-grid'
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

jest.mock('@/components/toggle-run-public-button', () => ({
    ToggleRunPublicButton: ({ runId }: any) => (
        <button data-testid={`toggle-public-${runId}`}>Toggle Public</button>
    ),
}))

jest.mock('@/components/share-runid-button', () => ({
    ShareRunIdButton: ({ runId }: any) => (
        <button data-testid={`share-${runId}`}>Share</button>
    ),
}))

describe('RunImageGrid - 統一圖片網格元件測試', () => {
    const mockRuns: RunImageGridRun[] = [
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
                { r2Key: 'all-4.jpg', createdAt: '2024-01-01T12:03:00Z' },
                { r2Key: 'all-5.jpg', createdAt: '2024-01-01T12:04:00Z' },
            ],
        },
    ]

    beforeEach(() => {
        jest.clearAllMocks()
            ; (imageUtils.getOptimizedImageUrl as jest.Mock).mockImplementation(
                (key: string) => `https://optimized.example.com/${key}`
            )
    })

    test('基本渲染 - 預設配置下不顯示任何按鈕', () => {
        render(<RunImageGrid runs={mockRuns} />)

        // 不應該有任何功能按鈕
        expect(screen.queryByTestId('share-test-run-1')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('設定')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('展開')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('載入')).not.toBeInTheDocument()

        // 應該只顯示圖片
        expect(screen.getAllByRole('img')).toHaveLength(3) // 預覽圖片
    })

    test('簡潔展示模式 - 僅分享功能', () => {
        const config: RunImageGridConfig = {
            showShare: true
        }

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 應該有分享按鈕
        expect(screen.getByTestId('share-test-run-1')).toBeInTheDocument()

        // 不應該有其他按鈕
        expect(screen.queryByLabelText('設定')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('展開')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('載入')).not.toBeInTheDocument()
    })

    test('完整管理模式 - 所有功能啟用', () => {
        const config: RunImageGridConfig = {
            showShare: true,
            showDelete: true,
            showSettings: true,
            showDownload: true,
            showExpand: true,
            showLightbox: true,
            showPlay: true,
            showTogglePublic: true,
            showTimestamp: true
        }

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 應該有所有主要按鈕
        expect(screen.getByTestId('share-test-run-1')).toBeInTheDocument()
        expect(screen.getByLabelText('設定')).toBeInTheDocument()
        expect(screen.getByLabelText('展開')).toBeInTheDocument()
        expect(screen.getByLabelText('載入')).toBeInTheDocument()

        // 應該顯示時間戳
        expect(screen.getByText(/2024\/01\/01/)).toBeInTheDocument()

        // 點擊設定按鈕應該顯示設定選單
        fireEvent.click(screen.getByLabelText('設定'))

        // 設定選單內應該有公開切換和刪除按鈕
        expect(screen.getByTestId('toggle-public-test-run-1')).toBeInTheDocument()
        expect(screen.getByLabelText('刪除')).toBeInTheDocument()
    })

    test('展開/收合功能', async () => {
        const config: RunImageGridConfig = {
            showExpand: true
        }

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 初始狀態：只顯示預覽圖片 (3張)
        expect(screen.getAllByRole('img')).toHaveLength(3)

        // 點擊展開按鈕
        fireEvent.click(screen.getByLabelText('展開'))

        // 展開後：應該顯示所有圖片 (5張)
        await waitFor(() => {
            expect(screen.getAllByRole('img')).toHaveLength(5)
        })

        // 按鈕文字應該變為收合
        expect(screen.getByLabelText('收合')).toBeInTheDocument()

        // 點擊收合按鈕
        fireEvent.click(screen.getByLabelText('收合'))

        // 收合後：回到預覽狀態 (3張)
        await waitFor(() => {
            expect(screen.getAllByRole('img')).toHaveLength(3)
        })
    })

    test('自訂回調函數', () => {
        const mockImageClick = jest.fn()
        const mockToggleExpand = jest.fn()
        const mockPlay = jest.fn()
        const mockDelete = jest.fn()

        const config: RunImageGridConfig = {
            showExpand: true,
            showPlay: true,
            showDelete: true,
            showSettings: true,
            onImageClick: mockImageClick,
            onToggleExpand: mockToggleExpand,
            onPlay: mockPlay,
            onDelete: mockDelete
        }

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 點擊圖片
        fireEvent.click(screen.getAllByRole('img')[0])
        expect(mockImageClick).toHaveBeenCalledWith('test-run-1', 'preview-1.jpg')

        // 點擊展開按鈕
        fireEvent.click(screen.getByLabelText('展開'))
        expect(mockToggleExpand).toHaveBeenCalledWith('test-run-1')

        // 點擊播放按鈕
        fireEvent.click(screen.getByLabelText('載入'))
        expect(mockPlay).toHaveBeenCalledWith('test-run-1')

        // 點擊設定按鈕開啟選單，然後點擊刪除
        fireEvent.click(screen.getByLabelText('設定'))
        fireEvent.click(screen.getByLabelText('刪除'))
        expect(mockDelete).toHaveBeenCalledWith('test-run-1')
    })

    test('響應式網格配置', () => {
        const config: RunImageGridConfig = {
            gridCols: {
                mobile: 2,
                tablet: 4,
                desktop: 8
            }
        }

        const { container } = render(<RunImageGrid runs={mockRuns} config={config} />)

        // 檢查 CSS 類名包含正確的網格配置
        const gridElement = container.querySelector('.grid')
        expect(gridElement).toHaveClass('grid-cols-2', 'md:grid-cols-4', 'lg:grid-cols-8')
    })

    test('圖片優化和載入狀態', async () => {
        const config: RunImageGridConfig = {
            showExpand: true
        }

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 驗證預覽圖片使用優化 URL
        expect(imageUtils.getOptimizedImageUrl).toHaveBeenCalledWith(
            'preview-1.jpg',
            { width: 200, quality: 100 }
        )

        // 點擊展開，新圖片應該有載入狀態
        fireEvent.click(screen.getByLabelText('展開'))

        // 新圖片應該有 Skeleton 載入狀態
        await waitFor(() => {
            expect(screen.getAllByTestId('skeleton')).toHaveLength(2) // 2張新圖片
        })
    })

    test('Lightbox 功能', async () => {
        const config: RunImageGridConfig = {
            showLightbox: true
        }

        // Mock fetch for blob URLs
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' }))
        })

        render(<RunImageGrid runs={mockRuns} config={config} />)

        // 點擊圖片應該開啟 lightbox
        fireEvent.click(screen.getAllByRole('img')[0])

        await waitFor(() => {
            expect(screen.getByTestId('lightbox')).toBeInTheDocument()
        })

        // 關閉 lightbox
        fireEvent.click(screen.getByText('Close Lightbox'))

        await waitFor(() => {
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
        })
    })
})
